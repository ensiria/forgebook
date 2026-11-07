/**
 * Why a story did not draw, named: what an agent or a person reads instead of a bundler's words, with the step to take.
 *
 * @remarks
 * Pure: a message in, a diagnosis out. The patterns are what Vite, Node, the browser and the libraries really say, and an
 * unknown message stays itself, under its own kind, never a guess. A project's text is only ever shown, cut short.
 *
 * @module
 */

import { printable } from "../newProject/projectEntries.ts";

/** What stopped a story from drawing. */
export type DrawFailureKind =
  | "no-component"
  | "missing-import"
  | "provider"
  | "server-only"
  | "style-sheet"
  | "native-build"
  | "browser"
  | "app-config"
  | "older-forgebook"
  | "unbuilt-package"
  | "generated-files"
  | "needs-props"
  | "old-sass"
  | "blank"
  | "timeout"
  | "unknown";

/** Why a story did not draw. */
export type DrawDiagnosis = {
  /** What kind of thing stopped it. */
  readonly kind: DrawFailureKind;
  /** What was said, cut short. */
  readonly message: string;
  /** What to do. */
  readonly nextStep: string;
};

/** The longest message kept: a stack would flood an agent's context. */
const MESSAGE_LENGTH = 400;

/** A rule: what a message says, the kind it means, and the step, from what the message captured. */
type Rule = {
  readonly pattern: RegExp;
  readonly kind: DrawFailureKind;
  readonly nextStep: (name: string) => string;
};

/** What a package manager runs when it installs a package with native code, which `--ignore-scripts` leaves undone. */
const NATIVE_STEP =
  "A package's install step did not run: run the project's install without --ignore-scripts, or rebuild that package";

/** The rules, the most telling first. */
const RULES: readonly Rule[] = [
  {
    pattern: /TSCONFIG_ERROR|Failed to load tsconfig|Cannot find base config/i,
    kind: "generated-files",
    nextStep: (): string =>
      "The project's tsconfig.json extends a file a tool writes: run that tool (svelte-kit sync, nuxt prepare), or an install with its scripts"
  },
  {
    pattern: /sass\.initAsyncCompiler is not a function/i,
    kind: "old-sass",
    nextStep: (): string =>
      "The project's Sass is older than the catalogue's Vite can use: upgrade sass, to 1.70 or later"
  },
  {
    pattern: /no valid target file was found|Package path \S+ is (?:not )?exported/i,
    kind: "unbuilt-package",
    nextStep: (): string =>
      "A package the project imports has no built files: in a workspace, build its packages first, then run this again"
  },
  {
    pattern: /Unexpected token Function\("theme"\)|Unknown at rule: @(?:tailwind|apply|theme|source)/i,
    kind: "style-sheet",
    nextStep: (): string =>
      "Tailwind's own syntax reached the compiler unprocessed. On Nuxt a module's work is not done (@nuxt/ui, @nuxtjs/tailwindcss): keep to a sheet with no such import in nuxt.config's css, or give the catalogue its own; elsewhere, check the project's Tailwind plugin or PostCSS is declared"
  },
  {
    pattern: /Unknown option '--json'|unknown command (?:new|check|shot|stories)/i,
    kind: "older-forgebook",
    nextStep: (): string =>
      "The project installed an older forgebook than the one running this: a package manager's release-age or trust rule can do that; install the same version, then run this again"
  },
  {
    pattern: /Executable doesn't exist|playwright install|Stories run in a browser with/i,
    kind: "browser",
    nextStep: (): string => "Install the browser: forgebook browser (or forgebook init --browser)"
  },
  {
    pattern: /exports no component|cannot read a component|no component/i,
    kind: "no-component",
    nextStep: (): string =>
      "This file exports no component to draw: name one with forgebook new <file> --export <name>"
  },
  {
    pattern: /native binding|\.node['" ]|was compiled against|NODE_MODULE_VERSION|bindings file/i,
    kind: "native-build",
    nextStep: (): string => NATIVE_STEP
  },
  {
    pattern: /could not be loaded, so its aliases|vite\.config[^ ]* could not|failed to load config/i,
    kind: "app-config",
    nextStep: (): string =>
      "The app's Vite configuration did not load: fix what it says, or set appBuild: { viteConfig: false } in forgebook.config.ts"
  },
  {
    pattern:
      /(?:Failed to resolve import|Cannot find (?:module|package)|Rollup failed to resolve|Could not resolve)\s+["']?([^"'\s]+)/i,
    kind: "missing-import",
    // never the name in the sentence: it is the project's text, and "install it" would make it an instruction
    nextStep: (name: string): string =>
      name.startsWith(".") || name.startsWith("/")
        ? "A file the component imports is not there: one a build step writes, perhaps; run that step first"
        : "An import does not resolve: if the message names a package the project's manifest declares, install the project; if an alias of the app's build, check what forgebook dev says it read (appBuild)"
  },
  {
    pattern: /does the file exist|Failed to fetch dynamically imported module/i,
    kind: "missing-import",
    nextStep: (): string =>
      "A module of the story did not load: open the frame to see which, and install or generate it"
  },
  {
    pattern: /\b(next\/headers|server-only|cookies\(\)|async Client Component|Server Component)\b/i,
    kind: "server-only",
    nextStep: (): string =>
      "This component runs on the server: try a client component, or give it what it reads through the story's parameters"
  },
  {
    pattern:
      /must be (?:used|rendered|wrapped) (?:with)?in|\bwithin (?:a|an|the) [A-Za-z<]*(?:Provider|Router|Context|Root)\b|outside (?:of )?(?:a |an |the )?[<A-Za-z]*(?:Provider|Router|Context)\b|No QueryClient set|could not find [a-z-]*\s?(?:store|context|react-redux)|use[A-Z]\w+(?:\(\))? (?:may be used|can only be used)|Cannot destructure property .* of .*(?:useContext|Context)|injection "[^"]+" not found|No [A-Za-z]+ (?:context|provider)|Context is (?:undefined|null)|lifecycle_outside_component|set_context_after_init|No router|without first setting the initial locale|Missing Provider/i,
    kind: "provider",
    nextStep: (): string =>
      "The component needs what the app wraps it in: add a decorator to forgebook.preview with that provider (init's next steps name the ones the entry sets up)"
  },
  {
    pattern:
      /Cannot apply unknown utility|@apply|Unexpected token|Unknown at rule|lightningcss|CssSyntaxError|Tailwind/i,
    kind: "style-sheet",
    nextStep: (): string =>
      "A style sheet did not compile: check the preview's imports; forgebook dev prints what it read of the app's PostCSS and plugins"
  },
  {
    pattern: /Cannot read propert(?:y|ies) of (?:undefined|null)|is not iterable|is not a function/i,
    kind: "needs-props",
    nextStep: (): string =>
      "The component reads a prop or data the first story does not give: complete its args in the story file"
  },
  {
    pattern: /did not say it was ready|timed? ?out/i,
    kind: "timeout",
    nextStep: (): string =>
      "No answer in time: the component may wait for data the story does not give, or a plugin of the app's starts a process of its own (name it in appBuild.skipPlugins)"
  }
];

/**
 * Why a story did not draw.
 *
 * @param said - what the command or the frame said.
 */
export const diagnosed = (said: string): DrawDiagnosis => {
  const message = printable(said.trim().slice(0, MESSAGE_LENGTH));
  for (const { pattern, kind, nextStep } of RULES) {
    const found = said.match(pattern);
    if (found !== null) return { kind, message, nextStep: printable(nextStep(found[1] ?? "")) };
  }
  return {
    kind: "unknown",
    message,
    nextStep: "Nothing known says this: open the frame with forgebook dev, and read the error it shows"
  };
};

/** The diagnosis of a story that drew nothing visible. */
export const BLANK: DrawDiagnosis = {
  kind: "blank",
  message: "The story drew and nothing can be seen: no text, and no element with a size",
  nextStep:
    "The component may need props or data the first story does not give: complete its args in the story file"
};
