/**
 * The frameworks `forgebook init` can start a catalogue for, and which one a project's `package.json` says it is on.
 *
 * @remarks
 * Detection reads declared packages only, never the code: a design system lists its framework as a peer, so peers count
 * too. A framework built on another (Next.js on React) takes its place, so a Next.js project is never asked to choose;
 * two that stand on their own (React and Lit) are a question only the project can answer, so the command stops and
 * names both instead of guessing. An adapter already declared settles it first: Forgebook's shell makes every project
 * declare React beside Vue, say, once the install command has run, and that must not read as two frameworks. The peer floors repeat the adapters' `package.json` because the adapter is usually not
 * installed yet when they are read; a test keeps the two equal.
 *
 * @module
 */
import type { ImportedFramework } from "../importers/storybookFrameworks.ts";

/** What `forgebook init` knows of a framework. */
export type ProjectFramework = {
  /** Its name, for a person. */
  readonly label: string;
  /** The packages whose presence says a project is on it; none for a framework never detected. */
  readonly markers: readonly string[];
  /** The frameworks it is built on, which it takes the place of. */
  readonly builtOn: readonly ImportedFramework[];
  /** The packages its adapter asks the project for, each with the lowest version it takes. */
  readonly peers: Readonly<Record<string, string>>;
  /** The extension of the story files `forgebook new` writes for it. */
  readonly storyExtension: "ts" | "tsx";
  /** The folders components are usually in, in the order a title is best made from. */
  readonly sourceFolders: readonly string[];
};

/** The packages `forgebook` itself asks the project for: its shell is React. Vite is its own. */
export const FORGEBOOK_PEERS: Readonly<Record<string, string>> = {
  react: "18.2.0",
  "react-dom": "18.2.0"
};

/** The names `--framework` takes, the order of the supported list. */
export const FRAMEWORK_NAMES: readonly ImportedFramework[] = [
  "react",
  "vue",
  "svelte",
  "solid",
  "preact",
  "web-components",
  "angular",
  "nextjs",
  "nuxt",
  "sveltekit",
  "react-native-web",
  "html"
];

/** Angular's packages its adapter needs, all from the same lowest version. */
const ANGULAR_PEERS = Object.fromEntries(
  ["build", "common", "compiler", "compiler-cli", "core", "platform-browser"].map((name) => [
    `@angular/${name}`,
    "20.0.0"
  ])
);

/** The usual folders of a project's components. */
const SOURCE_FOLDERS = ["src", "components", "lib"];

/** Every framework, by its adapter's name. */
export const PROJECT_FRAMEWORKS: Readonly<Record<ImportedFramework, ProjectFramework>> = {
  react: {
    label: "React",
    markers: ["react"],
    builtOn: [],
    peers: { react: "18.2.0", "react-dom": "18.2.0" },
    storyExtension: "tsx",
    sourceFolders: SOURCE_FOLDERS
  },
  vue: {
    label: "Vue",
    markers: ["vue"],
    builtOn: [],
    peers: { vue: "3.5.0" },
    storyExtension: "ts",
    sourceFolders: SOURCE_FOLDERS
  },
  svelte: {
    label: "Svelte",
    markers: ["svelte"],
    builtOn: [],
    peers: { svelte: "5.46.4" },
    storyExtension: "ts",
    sourceFolders: SOURCE_FOLDERS
  },
  solid: {
    label: "Solid",
    markers: ["solid-js"],
    builtOn: [],
    peers: { "solid-js": "1.9.0" },
    storyExtension: "tsx",
    sourceFolders: SOURCE_FOLDERS
  },
  preact: {
    label: "Preact",
    markers: ["preact"],
    builtOn: [],
    peers: { preact: "10.19.0" },
    storyExtension: "tsx",
    sourceFolders: SOURCE_FOLDERS
  },
  "web-components": {
    label: "Lit",
    markers: ["lit"],
    builtOn: [],
    peers: { lit: "3.2.0" },
    storyExtension: "ts",
    sourceFolders: SOURCE_FOLDERS
  },
  angular: {
    label: "Angular",
    markers: ["@angular/core"],
    builtOn: [],
    peers: ANGULAR_PEERS,
    storyExtension: "ts",
    sourceFolders: ["src", "projects"]
  },
  nextjs: {
    label: "Next.js",
    markers: ["next"],
    builtOn: ["react"],
    peers: { next: "15.0.0", react: "19.0.0", "react-dom": "19.0.0" },
    storyExtension: "tsx",
    sourceFolders: ["src", "app", "components", "lib"]
  },
  nuxt: {
    label: "Nuxt",
    markers: ["nuxt"],
    builtOn: ["vue"],
    peers: { vue: "3.5.0", "vue-router": "4.5.0" },
    storyExtension: "ts",
    sourceFolders: ["app", "components"]
  },
  sveltekit: {
    label: "SvelteKit",
    markers: ["@sveltejs/kit"],
    builtOn: ["svelte"],
    peers: { svelte: "5.46.4" },
    storyExtension: "ts",
    sourceFolders: ["src"]
  },
  "react-native-web": {
    label: "React Native Web",
    markers: ["react-native", "react-native-web", "expo"],
    builtOn: ["react"],
    peers: {
      react: "18.2.0",
      "react-dom": "18.2.0",
      "react-native": "0.76.0",
      "react-native-web": "0.21.0"
    },
    storyExtension: "tsx",
    sourceFolders: ["src", "app", "components", "lib"]
  },
  html: {
    label: "plain HTML",
    markers: [],
    builtOn: [],
    peers: {},
    storyExtension: "ts",
    sourceFolders: SOURCE_FOLDERS
  }
};

/** What a project's dependencies say about its framework. */
export type FrameworkDetection =
  /** One framework. */
  | { readonly kind: "found"; readonly framework: ImportedFramework }
  /** None Forgebook knows. */
  | { readonly kind: "unknown" }
  /** Several that stand on their own. */
  | { readonly kind: "ambiguous"; readonly candidates: readonly ImportedFramework[] };

/** Whether a package's declared version is Preact standing in for it (`"react": "npm:@preact/compat"`). */
const isPreactAlias = (specifier: string | undefined): boolean =>
  specifier?.includes("preact/compat") === true;

/**
 * The framework a project is on.
 *
 * @param declared - the packages it declares, with their versions as written.
 */
export const detectFramework = (declared: ReadonlyMap<string, string>): FrameworkDetection => {
  const adapters = FRAMEWORK_NAMES.filter((name) => declared.has(`@forgebook/${name}`));
  const isOnIt = (name: ImportedFramework): boolean =>
    PROJECT_FRAMEWORKS[name].markers.some(
      (marker) => declared.has(marker) && !isPreactAlias(declared.get(marker))
    );
  const found = adapters.length > 0 ? adapters : FRAMEWORK_NAMES.filter(isOnIt);
  const candidates = found.filter(
    (name) => !found.some((other) => PROJECT_FRAMEWORKS[other].builtOn.includes(name))
  );
  const [only] = candidates;
  if (only === undefined) return { kind: "unknown" };
  return candidates.length === 1 ? { kind: "found", framework: only } : { kind: "ambiguous", candidates };
};
