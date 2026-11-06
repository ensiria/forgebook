/**
 * What `forgebook init` writes for a project with no Storybook: its framework read from `package.json`, the adapter's
 * options, the story globs, and the preview that loads the app's global style sheets.
 *
 * @remarks
 * Nothing is written here: the plan comes back whole, so a refusal leaves the project as it was. Story globs carry the
 * extension `forgebook new` writes for the framework, and any folder that already has story files. A project with `src`
 * keeps its components there; one without lists every usual folder, an absent one included, since create-next-app's
 * `components` appears later and a glob over nothing costs nothing. The preview
 * is `.tsx` where stories are, so the decorator a next step asks for needs no rename.
 *
 * @module
 */
import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { STORY_FILE } from "../../../src/vite/autoTitle.ts";
import { projectTitle } from "../importers/storybook.ts";
import type { ImportedFramework } from "../importers/storybookFrameworks.ts";
import type { NextStep } from "./newProject.types.ts";
import { PROJECT_FRAMEWORKS } from "./projectFrameworks.ts";
import { hasPostcssConfig, readProjectLook } from "./projectLook.ts";
import { declaredPackages, installedVersion } from "./projectPackages.ts";

/** The folders never searched for story files: what is installed, built, or the tools' own. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", "build", "out", "coverage", "public"]);

/** How many folders a search for story files goes through, so a huge repository's first run stays quick. */
const SEARCH_LIMIT = 5000;

/** What `forgebook init` will write for a project. */
export type NewProjectPlan = {
  /** The framework. */
  readonly framework: ImportedFramework;
  /** Its adapter's options; none for the defaults. */
  readonly frameworkOptions: Readonly<Record<string, unknown>> | undefined;
  /** The catalogue's name. */
  readonly title: string;
  /** The story globs. */
  readonly stories: readonly string[];
  /** The preview, when the project has something for it to load. */
  readonly preview: { readonly file: string; readonly text: string } | undefined;
  /** What was left to do. */
  readonly nextSteps: readonly NextStep[];
  /** The packages the project's own setup asks for, beyond the adapter's. */
  readonly extraPeers: readonly string[];
};

/** A folder's entries; none for one the command may not read, which only leaves its stories out. */
const readableEntries = (dir: string): readonly Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** A folder in the search for story files, with the project's top folder it is under (`""` for the project's own). */
type SearchedFolder = { readonly dir: string; readonly top: string };

/** The folders to search below a folder. */
const foldersBelow = ({ dir, top }: SearchedFolder, entries: readonly Dirent[]): readonly SearchedFolder[] =>
  entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_FOLDERS.has(entry.name))
    .map((entry) => ({ dir: join(dir, entry.name), top: top || entry.name }));

/** The folders holding story files already, and those files' extensions. */
const existingStories = (
  projectDir: string
): {
  readonly folders: ReadonlySet<string>;
  readonly extensions: ReadonlySet<string>;
  readonly isCut: boolean;
} => {
  const folders = new Set<string>();
  const extensions = new Set<string>();
  const queue: SearchedFolder[] = [{ dir: projectDir, top: "" }];
  for (const current of queue) {
    if (queue.length > SEARCH_LIMIT) break;
    const entries = readableEntries(current.dir);
    for (const folder of foldersBelow(current, entries)) queue.push(folder);
    for (const { name } of entries.filter((entry) => entry.isFile() && STORY_FILE.test(entry.name))) {
      folders.add(current.top);
      extensions.add(name.slice(name.lastIndexOf(".") + 1));
    }
  }
  return { folders, extensions, isCut: queue.length > SEARCH_LIMIT };
};

/**
 * The configuration's story globs, and whether the search for story files stopped short.
 *
 * @param projectDir - the project's folder.
 * @param framework - its framework.
 */
export const storyGlobsOf = (
  projectDir: string,
  framework: ImportedFramework
): { readonly globs: readonly string[]; readonly isCut: boolean } => {
  const { sourceFolders, storyExtension } = PROJECT_FRAMEWORKS[framework];
  const isThere = (folder: string): boolean => existsSync(join(projectDir, folder));
  const hasSrc = sourceFolders.includes("src") && isThere("src");
  const listed = hasSrc
    ? ["src"]
    : [...sourceFolders].sort((a, b) => Number(isThere(b)) - Number(isThere(a)));
  const stories = existingStories(projectDir);
  const extensions = [...new Set([storyExtension, ...stories.extensions])];
  const globs = [...new Set([...listed, ...stories.folders])].flatMap((folder) =>
    extensions.map((extension) =>
      folder === "" ? `*.stories.${extension}` : `${folder}/**/*.stories.${extension}`
    )
  );
  return { globs, isCut: stories.isCut };
};

/**
 * What React Native's adapter must be told of a project: the JSX runtime of NativeWind, and the Babel plugin that
 * compiles Reanimated's worklets, which Metro runs on the device and the catalogue must run here.
 *
 * @param projectDir - the project's folder.
 * @param declared - the packages it declares.
 */
const reactNativeOptions = (
  projectDir: string,
  declared: ReadonlyMap<string, string>
): Readonly<Record<string, unknown>> | undefined => {
  const reanimated =
    installedVersion(projectDir, "react-native-reanimated") ?? declared.get("react-native-reanimated");
  const major = Number(reanimated?.match(/\d+/)?.[0] ?? 0);
  const plugin = major >= 4 ? "react-native-worklets/plugin" : "react-native-reanimated/plugin";
  const options = {
    ...(declared.has("nativewind") ? { jsxImportSource: "nativewind" } : {}),
    ...(reanimated === undefined ? {} : { babel: { plugins: [plugin] } })
  };
  return Object.keys(options).length === 0 ? undefined : options;
};

/** What a framework asks of a project besides the catalogue's own files. */
const frameworkSteps = (projectDir: string, framework: ImportedFramework): readonly NextStep[] => {
  if (framework === "nuxt")
    return [
      {
        kind: "provider",
        file: "nuxt.config",
        message:
          "Nuxt's modules and plugins are not run: a component that needs what one provides (a store, i18n) gets it from a decorator in forgebook.preview.ts"
      }
    ];
  if (framework === "sveltekit" && !existsSync(join(projectDir, ".svelte-kit")))
    return [
      {
        kind: "setup",
        file: "tsconfig.json",
        message:
          "Run `svelte-kit sync` before the catalogue: the project's tsconfig.json extends what it writes"
      }
    ];
  if (framework === "react-native-web") {
    const read = ["babel.config.js", "metro.config.js"].filter((name) => existsSync(join(projectDir, name)));
    return read.length === 0
      ? []
      : [
          {
            kind: "setup",
            file: read[0],
            message: `${read.join(" and ")} ${read.length === 1 ? "is" : "are"} not read: a plugin stories need goes to reactNativeWeb({ babel }) in the configuration`
          }
        ];
  }
  return [];
};

/** The text of the preview that loads the app's style sheets. */
const previewText = (styleSheets: readonly string[]): string =>
  [
    "/**",
    " * The catalogue's preview: what every story's frame loads, as the app's entry does. Written by `forgebook init`;",
    " * decorators, a provider around every story and the like go here too.",
    " *",
    " * @module",
    " */",
    ...styleSheets.map((sheet) => `import ${JSON.stringify(sheet)};`),
    ""
  ].join("\n");

/**
 * What `forgebook init` will write for a project.
 *
 * @param projectDir - the project's folder, absolute.
 * @param framework - its framework.
 */
export const planNewProject = (projectDir: string, framework: ImportedFramework): NewProjectPlan => {
  const declared = declaredPackages(projectDir);
  const look = readProjectLook(projectDir, framework, declared);
  const { globs, isCut } = storyGlobsOf(projectDir, framework);
  return {
    framework,
    frameworkOptions: framework === "react-native-web" ? reactNativeOptions(projectDir, declared) : undefined,
    title: projectTitle(projectDir),
    stories: globs,
    preview:
      look.styleSheets.length === 0
        ? undefined
        : {
            file: `forgebook.preview.${PROJECT_FRAMEWORKS[framework].storyExtension}`,
            text: previewText(look.styleSheets)
          },
    nextSteps: [
      ...frameworkSteps(projectDir, framework),
      ...look.nextSteps,
      ...(isCut
        ? [
            {
              kind: "setup" as const,
              file: undefined,
              message: `The search for story files stopped after ${SEARCH_LIMIT} folders: add the globs of any it missed`
            }
          ]
        : [])
    ],
    // React Native's adapter imports PostCSS when the project has a configuration for it
    extraPeers: framework === "react-native-web" && hasPostcssConfig(projectDir) ? ["postcss"] : []
  };
};
