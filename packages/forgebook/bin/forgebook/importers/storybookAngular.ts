/**
 * What `forgebook init --from storybook` reads of an Angular project besides `.storybook`: the TypeScript configuration
 * the stories are compiled with, and the builder options of `angular.json` it cannot carry over.
 *
 * @remarks
 * Storybook's Angular builders compile the stories with `.storybook/tsconfig.json` unless `angular.json` or the
 * framework's options name another; Forgebook's Angular adapter takes the same file as its `tsconfig` option, so the
 * components compile as they did. The builders' `styles` and `compodoc` live in `angular.json`, which Forgebook does not
 * read: each is named in the notes, with what to do instead.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** What the Angular adapter's options take from the project, and what was not read. */
export type AngularImport = {
  /** The adapter's options, as `angular({ … })` writes them; none for the defaults. */
  readonly options: Readonly<Record<string, string>> | undefined;
  /** What was not read, each a sentence for the person who runs the command. */
  readonly notes: readonly string[];
};

/** The builders whose options hold a Storybook's own settings, by their names in `angular.json`. */
const STORYBOOK_BUILDERS = [
  "@storybook/angular:start-storybook",
  "@analogjs/storybook-angular:start-storybook"
];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The options of the `angular.json` targets that start a Storybook.
 *
 * @param projectDir - the project's folder.
 */
const storybookTargets = (projectDir: string): Readonly<Record<string, unknown>>[] => {
  const file = join(projectDir, "angular.json");
  if (!existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const projects = isRecord(parsed) && isRecord(parsed["projects"]) ? Object.values(parsed["projects"]) : [];
  return projects.flatMap((project) => {
    const targets = isRecord(project) ? (project["architect"] ?? project["targets"]) : undefined;
    if (!isRecord(targets)) return [];
    return Object.values(targets).flatMap((target) =>
      isRecord(target) &&
      STORYBOOK_BUILDERS.includes(String(target["builder"] ?? target["executor"])) &&
      isRecord(target["options"])
        ? [target["options"]]
        : []
    );
  });
};

/**
 * The TypeScript configuration the stories were compiled with, from the project's folder: the framework's `tsconfig`
 * option, the builder's `tsConfig`, or Storybook's default beside `main`.
 *
 * @param projectDir - the project's folder, absolute.
 * @param storybookDir - the `.storybook` folder, absolute.
 * @param frameworkOptions - the options `main` gives its framework.
 * @param targets - the builders' options.
 */
const tsconfigOf = (
  projectDir: string,
  storybookDir: string,
  frameworkOptions: Readonly<Record<string, unknown>>,
  targets: readonly Readonly<Record<string, unknown>>[]
): string | undefined => {
  const named = frameworkOptions["tsconfig"];
  if (typeof named === "string") return relative(projectDir, resolve(storybookDir, named));
  // a builder's path is from the workspace's folder, and only a single Storybook says which project is meant
  const fromBuilder = targets.length === 1 ? targets[0]?.["tsConfig"] : undefined;
  if (typeof fromBuilder === "string") return fromBuilder;
  const beside = join(storybookDir, "tsconfig.json");
  return existsSync(beside) ? relative(projectDir, beside) : undefined;
};

/**
 * Reads what an Angular project's Storybook adds to `.storybook`.
 *
 * @param projectDir - the project's folder, absolute.
 * @param storybookDir - the `.storybook` folder, absolute.
 * @param frameworkOptions - the options `main` gives its framework (`{ name, options }`'s `options`).
 */
export const importAngular = (
  projectDir: string,
  storybookDir: string,
  frameworkOptions: Readonly<Record<string, unknown>>
): AngularImport => {
  const targets = storybookTargets(projectDir);
  const tsconfig = tsconfigOf(projectDir, storybookDir, frameworkOptions, targets);
  const styles = [
    ...new Set(
      targets.flatMap((options) =>
        Array.isArray(options["styles"]) ? options["styles"].filter((style) => typeof style === "string") : []
      )
    )
  ];
  const notes = [
    ...(styles.length === 0
      ? []
      : [
          `angular.json's Storybook styles are not loaded (${styles.join(", ")}): import them in the preview`
        ]),
    ...(targets.some((options) => options["compodoc"] === true)
      ? ["Compodoc is not run: Forgebook reads the components' inputs, outputs and content from their types"]
      : [])
  ];
  return {
    options: tsconfig === undefined ? undefined : { tsconfig: tsconfig.split("\\").join("/") },
    notes
  };
};
