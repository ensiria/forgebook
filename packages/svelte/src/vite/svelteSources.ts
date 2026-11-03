/**
 * Svelte components as TypeScript reads them: each `.svelte` file written as the TypeScript it amounts to, by
 * `svelte2tsx`, the converter Svelte's language server and `svelte-check` use, so a component's props have the types
 * the editor shows.
 *
 * @remarks
 * The core's programs read these in a component's place (`ProgramSources` of `forgebook/vite/docs-program`): an import
 * of `./Badge.svelte` looks for `./Badge.svelte.ts` first, and finds the component's TypeScript there; a component
 * without TypeScript is `./Badge.svelte.js`, so its JSDoc types count. A real `.svelte.ts` module (one with runes) and
 * the declarations a package publishes beside a component (`Badge.svelte.d.ts`) are read as they are.
 *
 * `svelte2tsx` loads `typescript` itself, which a project on TypeScript 7 answers with a package that has no compiler
 * API: its import is pointed at the TypeScript 6 the core reads with, for that package only, through Node's module hooks.
 * Its output is text, so which TypeScript wrote it does not matter to the program that reads it.
 *
 * @module
 */
import { readFileSync, statSync } from "node:fs";
import { createRequire, type ResolveFnOutput, type ResolveHookContext, registerHooks } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import type { ProgramSources } from "forgebook/vite/docs-program";
import { parse, VERSION } from "svelte/compiler";

import { isTypeScript } from "./svelteScript.ts";

/** Resolves what this module depends on, as Node resolves it from here. */
const resolveHere: NodeJS.RequireResolve = createRequire(import.meta.url).resolve;

/** The folder `svelte2tsx` is installed in, as a URL with its slash. */
const SVELTE2TSX_FOLDER: string = `${pathToFileURL(dirname(resolveHere("svelte2tsx"))).href}/`;

/** The TypeScript 6 the core reads with. */
const TYPESCRIPT_6: string = pathToFileURL(resolveHere("typescript-6")).href;

// registered before `svelte2tsx` is first loaded, which the docs' worker does in a thread of its own: a copy loaded
// earlier in the same thread would keep the TypeScript it found
registerHooks({
  resolve: (
    specifier: string,
    context: ResolveHookContext,
    nextResolve: (specifier: string, context?: Partial<ResolveHookContext>) => ResolveFnOutput
  ): ResolveFnOutput =>
    specifier === "typescript" && context.parentURL?.startsWith(SVELTE2TSX_FOLDER) === true
      ? { url: TYPESCRIPT_6, format: "commonjs", shortCircuit: true }
      : nextResolve(specifier, context)
});

const { svelte2tsx }: typeof import("svelte2tsx") = await import("svelte2tsx");

/** A component's extension. */
export const COMPONENT_EXTENSION = ".svelte";

/** A component's TypeScript, written for one version of its file. */
type WrittenComponent = {
  /** The file's text it was written from. */
  readonly text: string;
  /** Whether its scripts are TypeScript. */
  readonly isTypeScript: boolean;
  /** The TypeScript `svelte2tsx` wrote; none when the file cannot be read as a component. */
  readonly code: string | undefined;
};

/** The components written so far, by their file: a program renewed after an edit writes only what changed. */
const written = new Map<string, WrittenComponent>();

/**
 * Whether a file is on disk.
 *
 * @param file - the file.
 */
const isFile = (file: string): boolean => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

/**
 * A component's TypeScript, written again only when its text changed.
 *
 * @param component - the component's file.
 * @returns it, or none when there is no such file.
 */
const writtenComponent = (component: string): WrittenComponent | undefined => {
  if (!isFile(component)) return undefined;
  const text = readFileSync(component, "utf8");
  const kept = written.get(component);
  if (kept?.text === text) return kept;
  const isTs = isTypeScript(text);
  let code: string | undefined;
  try {
    code = svelte2tsx(text, {
      filename: component,
      isTsFile: isTs,
      mode: "ts",
      parse,
      version: VERSION
    }).code;
  } catch {
    // a component that does not parse has no TypeScript: an import of it stays unresolved until it does
    code = undefined;
  }
  const entry = { text, isTypeScript: isTs, code };
  written.set(component, entry);
  return entry;
};

/**
 * The file TypeScript reads in a component's place: beside it, `.ts`, or `.js` for one written without TypeScript.
 *
 * @param component - the component's file.
 */
export const componentScriptFile = (component: string): string =>
  `${component}${writtenComponent(component)?.isTypeScript === false ? ".js" : ".ts"}`;

/**
 * The component a file TypeScript asks for stands for, when it does.
 *
 * @param fileName - the file TypeScript asks for.
 * @returns the component's file, or none for a file of its own.
 */
export const componentOfScriptFile = (fileName: string): string | undefined => {
  const match = /\.svelte\.([jt]s)$/.exec(fileName);
  if (match === null) return undefined;
  const component = fileName.slice(0, -".ts".length);
  if (isFile(fileName) || isFile(`${component}.d.ts`)) return undefined;
  const entry = writtenComponent(component);
  if (entry?.code === undefined || entry.isTypeScript !== (match[1] === "ts")) return undefined;
  return component;
};

/**
 * The text of a file that stands for a component.
 *
 * @param fileName - the file TypeScript asks for.
 */
const textOf = (fileName: string): string | undefined => {
  const component = componentOfScriptFile(fileName);
  return component === undefined ? undefined : writtenComponent(component)?.code;
};

/** Svelte's components, as the core's programs read them. */
export const SVELTE_SOURCES: ProgramSources = {
  name: "svelte",
  textOf,
  // what the written TypeScript refers to: `svelte2tsx`'s helpers and the elements' attributes
  roots: [resolveHere("svelte2tsx/svelte-shims-v4.d.ts"), resolveHere("svelte2tsx/svelte-jsx-v4.d.ts")],
  options: { allowJs: true }
};
