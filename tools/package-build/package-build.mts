#!/usr/bin/env node
/**
 * The `package-build` command: builds a package for npm (`build`: its JavaScript, declarations and compiled style
 * sheets in `dist/`), writes and checks its published manifest (`manifest`: pnpm's `publishConfig`, made from its
 * workspace `exports` and `bin`), or gets it ready to pack (`prepack`: only under pnpm, the manifest checked, then
 * built).
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { plural } from "@ensiria/cli-kit/format";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";
import { compile } from "sass-embedded";

import {
  DIST,
  distPath,
  isCompiled,
  isPackedByPnpm,
  isPublished,
  publishConfigOf,
  withCompiledStyles
} from "./packageBuild.ts";
import type { PublishConfig, PublishedTarget } from "./packageBuild.types.ts";

/** The command, as the hints print it. */
const COMMAND = "package-build";

/** The folders a package's published files come from. */
const SOURCE_FOLDERS = "{src,bin}";

/** A package's manifest, as far as the build reads it; the rest is kept as it is when the manifest is written. */
type Manifest = {
  /** Every field, as the file has them. */
  readonly fields: Readonly<Record<string, unknown>>;
  /** The package's name. */
  readonly name: string;
  /** Its workspace `exports`, subpath to source. */
  readonly exports: Readonly<Record<string, string>>;
  /** Its workspace `bin`, command to source; none without commands. */
  readonly bin: Readonly<Record<string, string>> | undefined;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is an object of texts by name (`exports`, `bin`). */
const isTexts = (value: unknown): value is Readonly<Record<string, string>> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((text) => typeof text === "string");

/**
 * A package's manifest.
 *
 * @param packageDir - the package's folder.
 * @throws a `ScriptError` when it has no `package.json`.
 */
const readManifest = (packageDir: string): Manifest => {
  const file = join(packageDir, "package.json");
  if (!existsSync(file)) throw new ScriptError(`No package.json in ${packageDir}`);
  const fields: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isRecord(fields)) throw new ScriptError(`${file} is not an object`);
  const { name, exports, bin } = fields;
  if (typeof name !== "string") throw new ScriptError(`${file} names no package`);
  if (!isTexts(exports))
    throw new ScriptError(`${file}'s exports must name one source per subpath`, {
      hint: "The published exports are made from them: no conditions in the workspace's"
    });
  if (bin !== undefined && !isTexts(bin))
    throw new ScriptError(`${file}'s bin must name one source per command`);
  return { fields, name, exports, bin };
};

/** Every path a published target names. */
const targetPaths = (target: PublishedTarget): string[] =>
  typeof target === "string"
    ? [target]
    : [target.types, ...(target.default === undefined ? [] : [target.default])];

/**
 * The published manifest's fields of a package, from its manifest.
 *
 * @param manifest - the package's manifest.
 */
const publishConfigFor = (manifest: Manifest): PublishConfig =>
  publishConfigOf(manifest.exports, manifest.bin);

/**
 * Builds a package into `dist/`: `tsc` with its `tsconfig.build.json`, then its style sheets compiled, its other
 * files copied, and the emitted imports of style sheets pointed at the compiled ones.
 *
 * @param packageDir - the package's folder.
 * @param manifest - its manifest, for what it publishes.
 * @returns the number of files written besides `tsc`'s.
 * @throws a `ScriptError` when `tsc` fails or a published file is missing after the build.
 */
const build = (packageDir: string, manifest: Manifest): number => {
  rmSync(join(packageDir, DIST), { recursive: true, force: true });
  try {
    execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], { cwd: packageDir, stdio: "inherit" });
  } catch {
    throw new ScriptError("tsc failed", {
      hint: `Run pnpm exec tsc -p tsconfig.build.json in ${packageDir}`
    });
  }
  const files = globSync(`${SOURCE_FOLDERS}/**/*.*`, { cwd: packageDir }).filter(isPublished);
  let written = 0;
  for (const file of files) {
    const target = join(packageDir, distPath(file));
    if (file.endsWith(".scss")) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, compile(join(packageDir, file)).css);
      written += 1;
    } else if (!isCompiled(file)) {
      cpSync(join(packageDir, file), target);
      written += 1;
    }
  }
  for (const file of globSync(`${DIST}/**/*.{js,mjs}`, { cwd: packageDir })) {
    const path = join(packageDir, file);
    const code = readFileSync(path, "utf8");
    const compiled = withCompiledStyles(code);
    if (compiled !== code) writeFileSync(path, compiled);
  }
  const published = publishConfigFor(manifest);
  const missing = Object.values({ ...published.exports, ...published.bin })
    .flatMap(targetPaths)
    .filter((path) => !existsSync(join(packageDir, path)));
  if (missing.length > 0)
    throw new ScriptError(`The build lacks what the package publishes: ${missing.join(", ")}`, {
      hint: "Check the export's source and tsconfig.build.json's include"
    });
  return written;
};

await defineScript({
  name: COMMAND,
  command: COMMAND,
  summary: "Build a package for npm, write and check its published manifest, or get it ready to pack.",
  icon: "package",
  description:
    "build: runs tsc with the package's tsconfig.build.json into dist/, compiles its style sheets, copies its other files and points the emitted style imports at the compiled sheets. manifest: writes the package's publishConfig (the exports and bin npm installs) from its workspace exports and bin; --check fails when it is not up to date. prepack: the package's prepack script; refuses any packer but pnpm (npm would publish the TypeScript sources and the workspace: ranges), checks the manifest, then builds.",
  options: {
    package: {
      type: "string",
      default: ".",
      valueName: "folder",
      description: "The package's folder."
    },
    check: {
      type: "boolean",
      short: "c",
      description: "manifest: fail when the publishConfig is not up to date, instead of writing it (CI)."
    }
  },
  positionals: [
    { name: "command", description: "What to do.", required: true, choices: ["build", "manifest", "prepack"] }
  ],
  examples: [
    { command: `${COMMAND} build`, description: "Build the package of the folder you are in." },
    {
      command: `${COMMAND} manifest --package packages/react`,
      description: "Write a package's publishConfig."
    },
    { command: `${COMMAND} manifest --check`, description: "Check it in CI." },
    { command: `${COMMAND} prepack`, description: "The prepack script of a package." }
  ],
  run: ({ args, options, io, log }): void => {
    const packageDir = resolve(options.package);
    const manifest = readManifest(packageDir);
    const { name } = manifest;
    if (args.command === "prepack") {
      if (!isPackedByPnpm(io.env["npm_config_user_agent"]))
        throw new ScriptError(`${name} is packed by pnpm only`, {
          hint: "Run pnpm pack or pnpm publish: npm keeps the TypeScript sources and the workspace: ranges"
        });
      if (JSON.stringify(manifest.fields["publishConfig"]) !== JSON.stringify(publishConfigFor(manifest)))
        throw new ScriptError(`${name}'s publishConfig is not up to date`, {
          hint: `Run ${COMMAND} manifest --package ${options.package}`
        });
    }
    if (args.command === "build" || args.command === "prepack") {
      const written = build(packageDir, manifest);
      log.success(`${name} built into ${DIST}/, ${plural(written, "file")} besides tsc's`);
      return;
    }
    const publishConfig = publishConfigFor(manifest);
    if (JSON.stringify(manifest.fields["publishConfig"]) === JSON.stringify(publishConfig)) {
      log.success(`${name}'s publishConfig is up to date`);
      return;
    }
    if (options.check)
      throw new ScriptError(`${name}'s publishConfig is not up to date`, {
        hint: `Run ${COMMAND} manifest --package ${options.package}`
      });
    writeFileSync(
      join(packageDir, "package.json"),
      `${JSON.stringify({ ...manifest.fields, publishConfig }, null, 2)}\n`
    );
    log.success(`${name}'s publishConfig written`);
  }
}).run();
