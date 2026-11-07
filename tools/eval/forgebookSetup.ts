/**
 * Forgebook put into an app the way a user would: its packages added with the app's package manager, then
 * `forgebook init`, with `--agents` in the arm with Forgebook, without it in the measurement copy.
 *
 * @remarks
 * The packages are this checkout's, packed, or a published release: the app's manifest points the core's own
 * dependencies on Forgebook at the same tarballs, so one version of each runs. `init` runs with `--browser --draw`, as
 * its help tells an agent to set up unattended: it installs the browser the checks run on, and keeps a story that
 * drew. The browser lands in the work folder's own browsers folder, never the person's: Playwright's install removes
 * the browsers of its folder that no installed Playwright names, which would reach other projects' browsers.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { EvalApp } from "./eval.types.ts";
import { runCommand } from "./workspace.ts";

/** Forgebook's packages an app needs beside the core, by framework, as folders under `packages/`. */
const FRAMEWORK_PACKAGES: Readonly<Record<string, readonly string[]>> = {
  react: ["react"],
  nextjs: ["nextjs", "react"],
  vue: ["vue"],
  nuxt: ["nuxt", "vue"],
  svelte: ["svelte"],
  sveltekit: ["sveltekit", "svelte"],
  solid: ["solid"],
  preact: ["preact"],
  angular: ["angular"],
  html: ["html"],
  "web-components": ["web-components"],
  "react-native-web": ["react-native-web", "react"]
};

/**
 * The packages an app's framework needs, as folders under `packages/`: the core, the story format, the testing package
 * the checks run on, and the framework's.
 *
 * @param framework - the app's framework.
 * @throws when Forgebook has no package for it.
 */
export const packagesFor = (framework: string): readonly string[] => {
  const own = FRAMEWORK_PACKAGES[framework];
  if (own === undefined) throw new Error(`Forgebook has no package for the framework ${framework}`);
  return ["story-format", "forgebook", "testing", ...own];
};

/** The manifest's field that pins a dependency's dependencies, per package manager. */
const PIN_FIELD = { npm: "overrides", pnpm: "pnpm", yarn: "resolutions" } as const;

/**
 * The app's manifest with Forgebook's packages pinned wherever they are depended on, so the core's dependency on the
 * story format resolves to the same tarball.
 *
 * @param manifest - the manifest's text.
 * @param packages - each package's specifier, by name.
 * @param manager - the app's package manager.
 */
export const pinnedManifest = (
  manifest: string,
  packages: Readonly<Record<string, string>>,
  manager: EvalApp["packageManager"]
): string => {
  const value: unknown = JSON.parse(manifest);
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("the app's package.json is not an object");
  const fields: Record<string, unknown> = { ...value };
  const field = PIN_FIELD[manager];
  const existing = fields[field];
  const current = typeof existing === "object" && existing !== null ? existing : {};
  if (manager === "pnpm") {
    const overrides =
      "overrides" in current && typeof current.overrides === "object" ? current.overrides : {};
    fields[field] = { ...current, overrides: { ...overrides, ...packages } };
  } else {
    fields[field] = { ...current, ...packages };
  }
  return `${JSON.stringify(fields, null, 2)}\n`;
};

/** The words that add development dependencies, per package manager. */
const ADD = { npm: ["install", "--save-dev"], pnpm: ["add", "--save-dev"], yarn: ["add", "--dev"] } as const;

/** What `setUpForgebook` needs. */
export type SetupRequest = {
  /** The app. */
  readonly app: EvalApp;
  /** The folder to set up. */
  readonly folder: string;
  /** Each package's specifier, by name: `file:` tarballs or a version. */
  readonly packages: Readonly<Record<string, string>>;
  /** Whether to set up the agents too (`init --agents`). */
  readonly isForAgents: boolean;
  /** `init`'s `--hooks`, with `--agents`; its own choice when absent. */
  readonly hooks?: string;
  /** Variables every command of the app gets (the browsers' folder). */
  readonly env: Readonly<Record<string, string>>;
  /** Where `init`'s answer is written. */
  readonly answerFile: string;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/**
 * Adds Forgebook to an app and runs `forgebook init`, as a person following the README would.
 *
 * @param request - what to set up, and where.
 */
export const setUpForgebook = async (request: SetupRequest): Promise<void> => {
  const { app, folder, packages, env, io } = request;
  const manifestFile = join(folder, "package.json");
  await writeFile(
    manifestFile,
    pinnedManifest(await readFile(manifestFile, "utf8"), packages, app.packageManager)
  );
  const scriptsOff = { npm_config_ignore_scripts: "true", YARN_ENABLE_SCRIPTS: "false" };
  const specifiers = Object.entries(packages).map(([name, specifier]) =>
    specifier.startsWith("file:") ? specifier : `${name}@${specifier}`
  );
  await runCommand([app.packageManager, ...ADD[app.packageManager], ...specifiers], {
    cwd: folder,
    io,
    env: { ...env, ...scriptsOff }
  });
  const agents = request.isForAgents
    ? ["--agents", ...(request.hooks === undefined ? [] : ["--hooks", request.hooks])]
    : [];
  const answer = await runCommand(
    [join(folder, "node_modules", ".bin", "forgebook"), "init", ...agents, "--browser", "--draw", "--json"],
    // --draw exits 1 when no component draws, and the files it wrote are still what a user would have
    { cwd: folder, io, env, check: false }
  );
  await writeFile(request.answerFile, answer);
  // what --draw's finding no component leaves is still a set-up; no configuration written is a failed one
  if (!existsSync(join(folder, "forgebook.config.ts")))
    throw new Error(`forgebook init wrote no configuration in ${folder}: ${answer.slice(-600)}`);
};
