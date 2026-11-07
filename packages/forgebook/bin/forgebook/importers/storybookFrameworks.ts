/**
 * The Forgebook framework a project's Storybook moves to, chosen from the Storybook framework `main` names (or, for
 * React Native, the addon or the folder that says it), with what that framework takes from the project: its adapter's
 * options and what was not read.
 *
 * @remarks
 * One table maps Storybook's frameworks to Forgebook's; `storybook.ts` loads `main` and asks this module which one it
 * is, so a framework is added in one place. A framework whose project says more than its stories (a Next.js app's
 * `next.config`, an Angular project's `angular.json`, React Native's compiled packages and Babel) has a reader of its
 * own beside this one, called from `frameworkSettings`.
 *
 * @module
 */
import { basename } from "node:path";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";
import { importAngular } from "./storybookAngular.ts";
import {
  importReactNative,
  ON_DEVICE_STORYBOOK,
  REACT_NATIVE_WEB_ADDON,
  REACT_NATIVE_WEB_VITE,
  reactNativePeers
} from "./storybookReactNative.ts";

/** The frameworks a project's stories can move to Forgebook with: `@forgebook/<name>`. */
export type ImportedFramework =
  | "react"
  | "vue"
  | "svelte"
  | "sveltekit"
  | "preact"
  | "solid"
  | "nextjs"
  | "web-components"
  | "html"
  | "nuxt"
  | "angular"
  | "react-native-web";

/**
 * The function each framework's `@forgebook/<name>/vite` exports, which a configuration calls: the framework's name, or
 * its camel case where the name is no identifier.
 */
export const ADAPTER_FUNCTIONS: Readonly<Record<ImportedFramework, string>> = {
  react: "react",
  vue: "vue",
  svelte: "svelte",
  sveltekit: "sveltekit",
  preact: "preact",
  solid: "solid",
  nextjs: "nextjs",
  "web-components": "webComponents",
  html: "html",
  nuxt: "nuxt",
  angular: "angular",
  "react-native-web": "reactNativeWeb"
};

/** The Forgebook frameworks a project's Storybook can move to, by Storybook's framework. */
const STORYBOOK_FRAMEWORKS: Readonly<Record<string, ImportedFramework>> = {
  "@storybook/react-vite": "react",
  "@storybook/vue3-vite": "vue",
  "@storybook/svelte-vite": "svelte",
  "@storybook/sveltekit": "sveltekit",
  "@storybook/preact-vite": "preact",
  // Solid's Storybook framework is the community's, published under its own name
  "storybook-solidjs-vite": "solid",
  "@storybook/web-components-vite": "web-components",
  "@storybook/html-vite": "html",
  // Nuxt's Storybook module sets up a framework of its own, on Vue's
  "@storybook-vue/nuxt": "nuxt",
  // Angular's two compile a story the same way, through the Angular adapter's Vite plugin
  "@storybook/angular": "angular",
  "@analogjs/storybook-angular": "angular",
  "@storybook/nextjs-vite": "nextjs",
  "@storybook/nextjs": "nextjs",
  [REACT_NATIVE_WEB_VITE]: "react-native-web",
  // an addon beside a React framework on webpack, which makes the stories React Native's whatever the framework
  [REACT_NATIVE_WEB_ADDON]: "react-native-web",
  // on-device Storybook, drawn in the browser through react-native-web
  [ON_DEVICE_STORYBOOK]: "react-native-web"
};

/** The Storybook packages Forgebook reads, as a refusal names them. */
export const STORYBOOK_PACKAGES: readonly string[] = Object.keys(STORYBOOK_FRAMEWORKS);

/** What a Nuxt project's stories get differently once moved, said once the configuration is written. */
const NUXT_NOTES = [
  "Nuxt's modules are loaded for their plugins, styles and components, but what they and the app's plugins set up at run time is not: a component that needs one (a store, i18n) gets it from a decorator",
  "A story's route, data, state and cookies are set with parameters.nuxt (route, data, state, cookies), not by a decorator that drives the router"
] as const;

/** What a framework takes from a project's Storybook besides its stories. */
export type FrameworkSettings = {
  /** The Forgebook framework. */
  readonly framework: ImportedFramework;
  /** Its adapter's options, plain values; none for its defaults. */
  readonly options: Readonly<Record<string, unknown>> | undefined;
  /** What was not read, each a sentence for the person who runs the command. */
  readonly notes: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A framework or an addon as `main` writes it: a text, or an object with its `name` and its `options`.
 *
 * @param entry - the entry.
 */
const entryOf = (
  entry: unknown
): { readonly name: string | undefined; readonly options: Readonly<Record<string, unknown>> } => {
  if (typeof entry === "string") return { name: entry, options: {} };
  if (!isRecord(entry)) return { name: undefined, options: {} };
  return {
    name: typeof entry["name"] === "string" ? entry["name"] : undefined,
    options: isRecord(entry["options"]) ? entry["options"] : {}
  };
};

/**
 * The framework `main` names: a text, or an object with its `name` and its `options`.
 *
 * @param main - `main`'s configuration.
 */
export const frameworkOf = (
  main: Readonly<Record<string, unknown>>
): { readonly name: string | undefined; readonly options: Readonly<Record<string, unknown>> } =>
  entryOf(main["framework"]);

/**
 * The Storybook package a name or a path stands for, among the table's: its name, or a path to its package, as
 * Storybook's monorepo template writes it (`getAbsolutePath("@storybook/react-vite")`).
 *
 * @param written - the name or the path.
 */
const knownPackage = (written: string | undefined): string | undefined => {
  if (written === undefined) return undefined;
  const path = VITE_PATHS.normalize(written).replace(/\/$/, "");
  return STORYBOOK_PACKAGES.find((name) => path === name || path.endsWith(`/${name}`));
};

/**
 * The addon `main` lists by a package, with its options.
 *
 * @param main - `main`'s configuration.
 * @param name - the addon's package.
 */
const addonOf = (
  main: Readonly<Record<string, unknown>>,
  name: string
): { readonly options: Readonly<Record<string, unknown>> } | undefined => {
  const addons = Array.isArray(main["addons"]) ? main["addons"].map(entryOf) : [];
  return addons.find((addon) => knownPackage(addon.name) === name);
};

/**
 * The Storybook package that decides a project's framework: React Native Web's addon when `main` lists it, else the
 * framework `main` names, else on-device Storybook's for a project on it whose `main` names none.
 *
 * @param main - `main`'s configuration.
 * @param isOnDevice - whether the project is on-device Storybook's (`.rnstorybook`, or `@storybook/react-native`).
 * @returns the package, or none for a framework Forgebook does not read.
 */
export const storybookPackage = (
  main: Readonly<Record<string, unknown>>,
  isOnDevice: boolean
): string | undefined => {
  if (addonOf(main, REACT_NATIVE_WEB_ADDON) !== undefined) return REACT_NATIVE_WEB_ADDON;
  const { name } = frameworkOf(main);
  if (name === undefined) return isOnDevice ? ON_DEVICE_STORYBOOK : undefined;
  return knownPackage(name);
};

/**
 * What a Next.js project's Storybook says that the Next.js framework reads: its `next.config` when not where Next.js
 * looks, and what Forgebook does without being told.
 *
 * @param main - `main`'s configuration.
 * @param storybook - Storybook's framework package.
 * @param projectDir - the project's folder.
 * @returns the framework's options, and the notes.
 */
const nextjsSettings = (
  main: Readonly<Record<string, unknown>>,
  storybook: string,
  projectDir: string
): { readonly options: Readonly<Record<string, string>> | undefined; readonly notes: string[] } => {
  const notes: string[] = [];
  if (storybook === "@storybook/nextjs")
    notes.push(
      "Storybook's Next.js framework on webpack: Forgebook runs on Vite, so webpackFinal and a Babel configuration are not read"
    );
  const features = main["features"];
  if (isRecord(features) && features["experimentalRSC"] === true)
    notes.push("experimentalRSC is not needed: Forgebook draws async server components without a flag");
  const { nextConfigPath } = frameworkOf(main).options;
  // the Next.js app's folder is where its next.config is: its tsconfig, .env files and PostCSS are there too
  const file =
    typeof nextConfigPath === "string" ? VITE_PATHS.resolve(projectDir, nextConfigPath) : undefined;
  const appDir = file === undefined ? "" : VITE_PATHS.relative(projectDir, VITE_PATHS.dirname(file));
  const options =
    file === undefined
      ? undefined
      : { ...(appDir === "" ? {} : { dir: appDir }), nextConfig: basename(file) };
  return { options, notes };
};

/**
 * The Forgebook framework of a Storybook package, with what it takes from the project besides its stories: its
 * adapter's options, and what was not read.
 *
 * @param storybook - the Storybook package (`storybookPackage`).
 * @param main - `main`'s configuration.
 * @param projectDir - the project's folder, absolute.
 * @param storybookDir - the Storybook folder, absolute.
 */
export const frameworkSettings = (
  storybook: string,
  main: Readonly<Record<string, unknown>>,
  projectDir: string,
  storybookDir: string
): FrameworkSettings => {
  const framework = STORYBOOK_FRAMEWORKS[storybook] ?? "react";
  if (framework === "nextjs") return { framework, ...nextjsSettings(main, storybook, projectDir) };
  if (framework === "angular")
    return { framework, ...importAngular(projectDir, storybookDir, frameworkOf(main).options) };
  if (framework === "react-native-web") {
    const options = addonOf(main, storybook)?.options ?? frameworkOf(main).options;
    return { framework, ...importReactNative(storybook, options, main) };
  }
  return { framework, options: undefined, notes: framework === "nuxt" ? NUXT_NOTES : [] };
};

/**
 * The packages a framework's adapter needs beside its own that a project may not have yet: none for most.
 *
 * @param framework - the Forgebook framework.
 * @param options - its adapter's options.
 */
export const frameworkPeers = (
  framework: ImportedFramework,
  options: Readonly<Record<string, unknown>> | undefined
): readonly string[] => (framework === "react-native-web" ? reactNativePeers(options) : []);
