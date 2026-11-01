/**
 * The tools the benchmark drives: how each one is configured, started and built, and how a browser tells it is ready.
 *
 * @remarks
 * Every difference between the tools lives here, and the measurements in `measure.ts` read none of them directly, so
 * the same definition of a metric holds for all three. Each tool gets what its documentation asks for and the switch
 * every catalogue has (a theme); nothing is tuned for speed. Telemetry, opened browsers and Storybook's version check
 * are turned off: the check would cost a network call on every cold start here, since removing the caches forgets its
 * daily answer, and a person pays it once a day.
 *
 * @module
 */
import type { ToolName } from "./bench.types.ts";
import type { CorpusComponent, StoryForm } from "./corpus.ts";

/** A command, from a target's folder. */
export type TargetCommand = {
  /** The program, in the project's `node_modules/.bin`. */
  readonly bin: string;
  /** Its arguments. */
  readonly args: readonly string[];
  /** Variables it needs. */
  readonly env?: Readonly<Record<string, string>>;
};

/** A tool. */
export type Target = {
  /** Its name. */
  readonly name: ToolName;
  /** The form its stories are written in. */
  readonly form: StoryForm;
  /** The packages whose installed versions a report states. */
  readonly packages: readonly string[];
  /** Its configuration files, by path from the project's root. */
  readonly configFiles: Readonly<Record<string, string>>;
  /** The folders a cold start removes, from the project's root. */
  readonly caches: readonly string[];
  /** The dev server's command. */
  readonly dev: (port: number) => TargetCommand;
  /** The build's command. */
  readonly build: (out: string) => TargetCommand;
  /** A story's address. */
  readonly storyUrl: (base: string, component: CorpusComponent) => string;
  /** The page of a component's stories, when the tool has one. */
  readonly componentUrl?: (base: string, component: CorpusComponent) => string;
  /** The table of props on a component's page, when the tool has one, in whichever document it draws. */
  readonly propsTable?: string;
  /** The package whose direct dependencies a report counts. */
  readonly mainPackage: string;
};

/** The address every dev server listens on. */
export const HOST = "127.0.0.1";

/** The ladle config, shared by its dev server and its build. */
const LADLE_CONFIG = `export default {
  stories: "src/components/*.stories.tsx"
};
`;

/** Ladle's global provider: where the theme's style sheet is loaded. */
const LADLE_PROVIDER = `import "../src/shared/theme.css";

export const Provider = ({ children }) => children;
`;

/** Storybook's main file: the framework for React and Vite, and its docs addon for the pages compared. */
const STORYBOOK_MAIN = `export default {
  framework: "@storybook/react-vite",
  stories: ["../src/components/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true }
};
`;

/** Storybook's preview: the theme switch and the docs pages. */
const STORYBOOK_PREVIEW = `import "../src/shared/theme.css";

export default {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      toolbar: { title: "Theme", items: ["light", "dark"], dynamicTitle: true }
    }
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      return Story();
    }
  ]
};
`;

/** Forgebook's configuration, as its README writes one, with the theme switch. */
const FORGEBOOK_CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";
import { themeSwitch } from "forgebook/switches";

export default defineConfig({
  framework: react(),
  title: "Bench",
  stories: ["src/components/*.stories.tsx"],
  switches: [themeSwitch()]
});
`;

/** Forgebook's preview: where the theme's style sheet is loaded. */
const FORGEBOOK_PREVIEW = `import "./src/shared/theme.css";
`;

/** The first story's export, in the corpus's naming. */
const firstStory = (component: CorpusComponent): string => component.stories[0]?.name ?? "Story0";

/** A component's title as tools write it in an id: `group-name`, lower case. */
const titleId = (component: CorpusComponent): string => `${component.group}-${component.name}`.toLowerCase();

/** Forgebook's id of a component: its source, then its title. */
const forgebookComponent = (component: CorpusComponent): string =>
  encodeURIComponent(`stories:${titleId(component)}`);

/** Forgebook, from the packages under test. */
export const FORGEBOOK: Target = {
  name: "forgebook",
  form: "csf3",
  packages: ["forgebook", "@forgebook/react", "vite", "react"],
  mainPackage: "forgebook",
  configFiles: { "forgebook.config.ts": FORGEBOOK_CONFIG, "forgebook.preview.ts": FORGEBOOK_PREVIEW },
  caches: ["node_modules/.vite"],
  dev: (port) => ({ bin: "forgebook", args: ["dev", "--host", HOST, "--port", String(port)] }),
  build: (out) => ({ bin: "forgebook", args: ["build", "--out", out] }),
  storyUrl: (base, component) =>
    `${base}?story=${forgebookComponent(component)}--${firstStory(component).toLowerCase()}`,
  componentUrl: (base, component) => `${base}?component=${forgebookComponent(component)}`,
  propsTable: ".forgebook-api__table"
};

/** Storybook, on React and Vite. Its id spells a number as a word of its own. */
export const STORYBOOK: Target = {
  name: "storybook",
  form: "csf3",
  packages: ["storybook", "@storybook/react-vite", "vite", "react"],
  mainPackage: "storybook",
  configFiles: { ".storybook/main.js": STORYBOOK_MAIN, ".storybook/preview.jsx": STORYBOOK_PREVIEW },
  // its pre-bundled dependencies are here, not in Vite's folder: without this a cold start would be a warm one
  caches: ["node_modules/.vite", "node_modules/.cache"],
  dev: (port) => ({
    bin: "storybook",
    args: [
      "dev",
      "--port",
      String(port),
      "--host",
      HOST,
      "--exact-port",
      "--ci",
      "--disable-telemetry",
      "--no-version-updates",
      "--quiet"
    ],
    env: { STORYBOOK_DISABLE_TELEMETRY: "1" }
  }),
  build: (out) => ({
    bin: "storybook",
    args: ["build", "--output-dir", out, "--disable-telemetry", "--quiet"],
    env: { STORYBOOK_DISABLE_TELEMETRY: "1" }
  }),
  storyUrl: (base, component) =>
    `${base}?path=/story/${titleId(component)}--${firstStory(component)
      .replace(/(\d+)$/, "-$1")
      .toLowerCase()}`,
  componentUrl: (base, component) => `${base}?path=/docs/${titleId(component)}--docs`,
  propsTable: ".docblock-argstable"
};

/** Ladle. No page of a component's stories and no props table: those metrics are absent, not zero. */
export const LADLE: Target = {
  name: "ladle",
  form: "functions",
  packages: ["@ladle/react", "vite", "react"],
  mainPackage: "@ladle/react",
  configFiles: { ".ladle/config.mjs": LADLE_CONFIG, ".ladle/components.jsx": LADLE_PROVIDER },
  caches: ["node_modules/.vite"],
  dev: (port) => ({ bin: "ladle", args: ["serve", "--port", String(port), "--host", HOST] }),
  build: (out) => ({ bin: "ladle", args: ["build", "--outDir", out] }),
  storyUrl: (base, component) =>
    `${base}?story=${component.group.toLowerCase()}--${component.name.toLowerCase()}--${firstStory(component).toLowerCase()}`
};

/** Every tool, in report order. */
export const TARGETS: readonly Target[] = [FORGEBOOK, STORYBOOK, LADLE];
