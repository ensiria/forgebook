/**
 * The project's PostCSS configuration run on its style sheets, as Expo does for the web: Tailwind's, which NativeWind's
 * classes come from, among them.
 *
 * @remarks
 * Forgebook compiles style sheets with Lightning CSS, which runs no PostCSS. A React Native project that styles with
 * NativeWind has a `postcss.config` naming Tailwind, and Expo runs it on the web: so does this plugin, before Lightning
 * CSS, on the style sheets of a project that has one. Without a configuration it does nothing and loads nothing;
 * `postcss` is an optional peer, which a project with a configuration has.
 *
 * Tailwind reads the project's files for the classes they use, and says so in its result (`dir-dependency`): an edit
 * to one of those files on the dev server compiles the style sheet again, so a new class has its rule.
 *
 * @module
 */
import { relative } from "node:path";

import type { HmrContext, ModuleNode, Plugin, ResolvedConfig } from "vite";

import { isForgebookFile } from "./forgebookFiles.ts";

/** A style sheet PostCSS runs on: not one imported as text or as an address. */
const STYLE_SHEET = /\.css(?:$|\?)/;

/** A style sheet's imports that are not compiled. */
const NOT_COMPILED = /[?&](?:raw|url)\b/;

/** The PostCSS of a project: its plugins and options, and PostCSS itself. */
type ProjectPostcss = {
  /** Runs the plugins on a style sheet. */
  readonly process: (
    css: string,
    from: string
  ) => Promise<{ readonly css: string; readonly messages: readonly unknown[] }>;
};

/** A folder a style sheet's result depends on (Tailwind's content), with the files in it that count. */
type DirDependency = {
  /** The folder, absolute. */
  readonly dir: string;
};

/**
 * The folders a PostCSS result depends on, from its messages.
 *
 * @param messages - the result's messages.
 * @returns each folder, and each file, a result names.
 */
export const dependenciesOf = (
  messages: readonly unknown[]
): { readonly dirs: DirDependency[]; readonly files: string[] } => {
  const dirs: DirDependency[] = [];
  const files: string[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null || !("type" in message)) continue;
    if (message.type === "dir-dependency" && "dir" in message && typeof message.dir === "string")
      dirs.push({ dir: message.dir });
    if (message.type === "dependency" && "file" in message && typeof message.file === "string")
      files.push(message.file);
  }
  return { dirs, files };
};

/**
 * The project's PostCSS, loaded from its configuration.
 *
 * @param root - the project's folder.
 * @returns it, or none when the project has no PostCSS configuration.
 */
const loadPostcss = async (root: string): Promise<ProjectPostcss | undefined> => {
  const { default: postcssrc } = await import("postcss-load-config");
  let loaded: Awaited<ReturnType<typeof postcssrc>>;
  try {
    loaded = await postcssrc({}, root);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No PostCSS Config found")) return undefined;
    throw error;
  }
  const { default: postcss } = await import("postcss");
  const runner = postcss(loaded.plugins);
  return {
    process: async (css: string, from: string) => {
      const result = await runner.process(css, { ...loaded.options, from, to: from });
      return { css: result.css, messages: result.messages };
    }
  };
};

/**
 * Whether a file is in a folder.
 *
 * @param file - the file, absolute.
 * @param dir - the folder, absolute.
 */
const isInside = (file: string, dir: string): boolean => {
  const path = relative(dir, file);
  return path !== "" && !path.startsWith("..") && !path.startsWith("/");
};

/** The plugin. */
export const projectPostcss = (): Plugin => {
  let root = ".";
  let postcss: Promise<ProjectPostcss | undefined> | undefined;
  // the style sheets compiled with folders they depend on, by file
  const watched = new Map<string, readonly DirDependency[]>();
  return {
    name: "forgebook:react-native-web-postcss",
    enforce: "pre",
    configResolved: (config: ResolvedConfig): void => {
      root = config.root;
    },
    transform: {
      filter: { id: STYLE_SHEET },
      async handler(code: string, id: string): Promise<{ code: string; map: null } | null> {
        const file = id.split("?", 1)[0] ?? id;
        if (NOT_COMPILED.test(id) || file.includes("/node_modules/") || isForgebookFile(file)) return null;
        // a configuration that failed to load is read again with the next style sheet, once it is mended
        postcss ??= loadPostcss(root).catch((error: unknown) => {
          postcss = undefined;
          throw error;
        });
        const project = await postcss;
        if (project === undefined) return null;
        const result = await project.process(code, file);
        const { dirs, files } = dependenciesOf(result.messages);
        for (const dependency of files) this.addWatchFile(dependency);
        if (dirs.length > 0) watched.set(file, dirs);
        return { code: result.css, map: null };
      }
    },
    // a file Tailwind reads for its classes changed: its style sheets are compiled again with the page's next request
    handleHotUpdate: ({ file, server, modules }: HmrContext): ModuleNode[] | undefined => {
      const sheets = [...watched]
        .filter(([sheet, dirs]) => sheet !== file && dirs.some((each) => isInside(file, each.dir)))
        .flatMap(([sheet]) => [...(server.moduleGraph.getModulesByFile(sheet) ?? [])]);
      for (const sheet of sheets) server.moduleGraph.invalidateModule(sheet);
      return sheets.length === 0 ? undefined : [...modules, ...sheets];
    }
  };
};
