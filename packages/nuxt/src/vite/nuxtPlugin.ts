/**
 * The Vite plugin that lets a Nuxt project's components draw outside Nuxt: its aliases, its auto-imports, its
 * components found by name, `#app`, `#imports` and `#components`, and the project the page knows (its pages' routes,
 * its public runtime config, its app config, its style sheets).
 *
 * @remarks
 * Nuxt's own build is not run: the plugin reads `nuxt.config` (`nuxtConfig.ts`) and the project's folders, and does
 * what Nuxt's build does for a component's code. A file that uses a composable without importing it gets the import,
 * through unimport, the library Nuxt uses for it; a template that names a component gets the component's import, as
 * Nuxt's loader writes it. The project's folders are read again when a file is added or removed in one, and the page
 * reloads.
 *
 * Nuxt's composables come from this package's stand-ins (`src/app`), which are served from their sources, never
 * pre-bundled: the stand-ins a component imports and the renderer that gives each story its Nuxt must be one module.
 *
 * @module
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import MagicString, { type SourceMap } from "magic-string";
import { createUnimport, type Import, scanDirExports, toExports, type Unimport } from "unimport";
import {
  type ConfigEnv,
  loadEnv,
  normalizePath,
  type Plugin,
  type PluginOption,
  type ResolvedConfig,
  type UserConfig,
  type ViteDevServer
} from "vite";

import type { ProjectRoute } from "../project.ts";
import { componentName, type ProjectComponent, wordsOf } from "./componentNames.ts";
import { loadNuxtConfig, type NuxtProjectConfig, withEnvironment } from "./nuxtConfig.ts";
import { pageRoutes } from "./pageRoutes.ts";
import { BUILT_IN_COMPONENT_NAMES, COMPONENTS_MODULE, NUXT_STAND_INS, ROUTER_STAND_INS } from "./standIns.ts";

/** The options of `nuxt()`. */
export type NuxtOptions = {
  /** The Nuxt project's folder, from the catalogue's; the catalogue's own folder by default. */
  readonly dir?: string;
};

/** The frame page's module: Forgebook's frame with the Nuxt renderer, after the project's style sheets. */
export const FRAME_MODULE = "virtual:forgebook-nuxt/frame";

/** The module the page reads the project from, which the plugin writes in a catalogue (`src/pageProject.ts`). */
const PROJECT_MODULE = "@forgebook/nuxt/project";

/** The modules the plugin writes, by the name code imports them with. */
const VIRTUAL_MODULES = [
  "#app",
  "nuxt/app",
  "#imports",
  "#components",
  PROJECT_MODULE,
  "virtual:forgebook-nuxt/styles",
  FRAME_MODULE
] as const;

/** What the name of a module the plugin writes starts with once resolved. */
const RESOLVED = "\0forgebook-nuxt:";

/**
 * The id of a module the plugin writes, and back: a `#` would end the address the browser asks for it at, so it is
 * written as `hash:`.
 *
 * @param name - the module, as code imports it.
 */
const resolvedId = (name: string): string => `${RESOLVED}${name.replace(/^#/, "hash:")}`;

/**
 * The module a resolved id names.
 *
 * @param id - the id.
 */
const nameOfId = (id: string): string => id.slice(RESOLVED.length).replace(/^hash:/, "#");

/** Nuxt's build's own modules, which a catalogue cannot give. */
const BUILD_MODULE = /^#(build|internal|app-manifest|server)(\/|$)/;

/** A file whose code may use what Nuxt imports for it: a script, or a single-file component's script. */
const CODE_FILE = /\.(vue|[cm]?[jt]sx?)$/;

/** A template's look-up of a component by name, as Vue's compiler writes it. */
const RESOLVE_COMPONENT = /(?<![\w$])_?resolveComponent\(\s*(["'`])([^"'`]+)\1\s*(?:,\s*true\s*)?\)/g;

/** What the plugin knows of the project, read again when its folders change. */
type ProjectState = {
  /** The config. */
  readonly config: NuxtProjectConfig;
  /** The public runtime config, the environment's variables over it. */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
  /** The pages' routes. */
  readonly routes: readonly ProjectRoute[];
  /** The components, by name. */
  readonly components: ReadonlyMap<string, ProjectComponent>;
  /** What a file gets without importing it. */
  readonly unimport: Unimport;
  /** What a file gets without importing it, each as its name and its module. */
  readonly importNames: readonly string[];
};

/**
 * Every file of a folder, as paths from it with `/`; none for a folder that is not there.
 *
 * @param dir - the folder.
 */
const filesOf = (dir: string): string[] => {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
  } catch {
    return [];
  }
};

/**
 * The project's components, by name: the first folder that names one wins, as in Nuxt.
 *
 * @param config - the project's config.
 */
const componentsOf = (config: NuxtProjectConfig): Map<string, ProjectComponent> => {
  const found = new Map<string, ProjectComponent>();
  for (const dir of config.componentsDirs)
    for (const file of filesOf(dir.path)) {
      const name = componentName(file, dir.prefix, dir.pathPrefix);
      if (name !== undefined && !found.has(name)) found.set(name, { name, file: join(dir.path, file) });
    }
  return found;
};

/**
 * Reads the project: its routes, its components, and what its files get without importing it.
 *
 * @param config - the project's config.
 * @param env - the environment's variables, by name.
 */
const readProject = async (
  config: NuxtProjectConfig,
  env: Readonly<Record<string, string>>
): Promise<ProjectState> => {
  // a composables folder's files, and the `index` of each of its folders, as Nuxt scans them
  const scanned = await scanDirExports([...config.importsDirs], {
    filePatterns: ["*.{ts,js,mjs,mts}", "*/index.{ts,js,mjs,mts}"],
    cwd: config.rootDir
  });
  const imports: Import[] = [...NUXT_STAND_INS, ...ROUTER_STAND_INS, ...scanned];
  return {
    config,
    publicRuntimeConfig: withEnvironment(config.publicRuntimeConfig, env),
    routes: pageRoutes(filesOf(config.pagesDir)),
    components: componentsOf(config),
    unimport: createUnimport({ presets: ["vue"], imports, addons: { vueTemplate: true } }),
    importNames: imports.map((each) => `${each.name} ${each.from}`)
  };
};

/**
 * What a page knows of the project's folders, as one text: two reads with the same one need no reload.
 *
 * @param state - the project.
 */
const shapeOf = (state: ProjectState): string =>
  JSON.stringify([state.routes, [...state.components.values()], state.importNames]);

/**
 * The code of `#components`: each of the project's components, its `Lazy` form, and Nuxt's own.
 *
 * @param state - the project.
 */
const componentsModule = (state: ProjectState): string =>
  [
    'import { defineAsyncComponent } from "vue";',
    `export { ${BUILT_IN_COMPONENT_NAMES.join(", ")} } from ${JSON.stringify(COMPONENTS_MODULE)};`,
    ...[...state.components.values()].flatMap(({ name, file }) => [
      `export { default as ${name} } from ${JSON.stringify(file)};`,
      `export const Lazy${name} = defineAsyncComponent(() => import(${JSON.stringify(file)}));`
    ])
  ].join("\n");

/**
 * The code of the project the page knows: its routes, its public runtime config, its app config and its components'
 * loaders.
 *
 * @param state - the project.
 */
const projectModule = (state: ProjectState): string => {
  const { config } = state;
  const runtimeConfig = {
    public: state.publicRuntimeConfig,
    app: { baseURL: config.baseURL, buildAssetsDir: config.buildAssetsDir, cdnURL: "" }
  };
  const loaders = [...state.components.values()].map(
    ({ name, file }) => `    ${JSON.stringify(name)}: () => import(${JSON.stringify(file)})`
  );
  return [
    ...(config.appConfigFile === undefined
      ? []
      : [`import appConfig from ${JSON.stringify(config.appConfigFile)};`]),
    "export const project = {",
    `  routes: ${JSON.stringify(state.routes)},`,
    `  runtimeConfig: ${JSON.stringify(runtimeConfig)},`,
    `  appConfigs: [${JSON.stringify(config.appConfig)}${config.appConfigFile === undefined ? "" : ", appConfig"}],`,
    `  components: {\n${loaders.join(",\n")}\n  }`,
    "};"
  ].join("\n");
};

/**
 * The code of a module the plugin writes.
 *
 * @param name - the module, as code imports it.
 * @param state - the project.
 */
const virtualModule = async (name: string, state: ProjectState): Promise<string> => {
  if (name === "#app" || name === "nuxt/app") return toExports([...NUXT_STAND_INS]);
  if (name === "#imports") return toExports(await state.unimport.getImports());
  if (name === "#components") return componentsModule(state);
  if (name === PROJECT_MODULE) return projectModule(state);
  if (name === "virtual:forgebook-nuxt/styles")
    return state.config.css.map((sheet) => `import ${JSON.stringify(sheet)};`).join("\n");
  return [
    'import "virtual:forgebook-nuxt/styles";',
    'import { mountFrame as mountForgebookFrame } from "forgebook/frame";',
    'import { nuxtRenderer } from "@forgebook/nuxt/renderer";',
    "export const mountFrame = (container, config) => mountForgebookFrame(container, { ...config, renderer: nuxtRenderer });"
  ].join("\n");
};

/** A component a template names, as the plugin imports it. */
type NamedComponent = {
  /** Its name (`BaseBadge`, `LazyBaseBadge`, `NuxtLink`). */
  readonly name: string;
  /** The project's component it is, or none for one of Nuxt's own. */
  readonly component: ProjectComponent | undefined;
  /** Whether it is a project component's `Lazy` form. */
  readonly isLazy: boolean;
};

/**
 * The component a template names, as written there (`base-badge` or `BaseBadge`), when the plugin knows it.
 *
 * @param written - the name as written.
 * @param components - the project's components, by name.
 */
const namedComponent = (
  written: string,
  components: ReadonlyMap<string, ProjectComponent>
): NamedComponent | undefined => {
  const name = wordsOf(written)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");
  const isLazy = name.startsWith("Lazy") && components.has(name.slice(4));
  const component = components.get(isLazy ? name.slice(4) : name);
  const isBuiltIn = BUILT_IN_COMPONENT_NAMES.some((builtIn) => builtIn === name);
  if (component === undefined && !isBuiltIn) return undefined;
  return { name, component, isLazy };
};

/**
 * The statement that gives a component its local name.
 *
 * @param named - the component.
 * @param local - its local name.
 */
const componentImport = ({ name, component, isLazy }: NamedComponent, local: string): string => {
  if (component === undefined)
    return `import { ${name} as ${local} } from ${JSON.stringify(COMPONENTS_MODULE)};`;
  if (isLazy)
    return `const ${local} = __forgebookDefineAsync(() => import(${JSON.stringify(component.file)}));`;
  return `import ${local} from ${JSON.stringify(component.file)};`;
};

/**
 * A template's components given their imports, as Nuxt's loader writes them: Nuxt's own, the project's, and a project
 * component's `Lazy` form loaded when it is first drawn.
 *
 * @param code - the compiled component.
 * @param components - the project's components, by name.
 * @returns the code changed, or none when it names no component the plugin knows.
 */
export const withComponentImports = (
  code: MagicString,
  components: ReadonlyMap<string, ProjectComponent>
): MagicString | undefined => {
  const locals = new Map<string, string>();
  const statements: string[] = [];
  for (const match of code.original.matchAll(RESOLVE_COMPONENT)) {
    const named = namedComponent(match[2] ?? "", components);
    if (named === undefined) continue;
    const local = locals.get(named.name) ?? `__nuxt_component_${locals.size}`;
    if (!locals.has(named.name)) {
      locals.set(named.name, local);
      statements.push(componentImport(named, local));
    }
    code.overwrite(match.index, match.index + match[0].length, local);
  }
  if (locals.size === 0) return undefined;
  const isAsyncUsed = statements.some((line) => line.includes("__forgebookDefineAsync"));
  const asyncImport = isAsyncUsed
    ? 'import { defineAsyncComponent as __forgebookDefineAsync } from "vue";\n'
    : "";
  code.prepend(`${asyncImport}${statements.join("\n")}\n`);
  return code;
};

/**
 * The aliases of a Nuxt project: its own, then `~~`, `@@`, `~`, `@`, `#shared`, `assets` and `public` as Nuxt gives
 * them.
 *
 * @param config - the project's config.
 */
const aliasesOf = (config: NuxtProjectConfig): { readonly find: RegExp; readonly replacement: string }[] => {
  const prefix = (name: string): RegExp =>
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|$)`);
  return [
    ...Object.entries(config.alias).map(([name, path]) => ({ find: prefix(name), replacement: path })),
    { find: prefix("~~"), replacement: config.rootDir },
    { find: prefix("@@"), replacement: config.rootDir },
    { find: prefix("~"), replacement: config.srcDir },
    { find: prefix("@"), replacement: config.srcDir },
    { find: prefix("#shared"), replacement: join(config.rootDir, "shared") },
    { find: /^assets(?=\/)/, replacement: join(config.srcDir, "assets") },
    { find: /^public(?=\/)/, replacement: join(config.rootDir, "public") }
  ];
};

/**
 * The plugins of a Nuxt catalogue.
 *
 * @param options - the options of `nuxt()`.
 * @returns the plugins.
 */
export const nuxtPlugins = (options: NuxtOptions = {}): PluginOption[] => {
  let state: ProjectState | undefined;
  let env: Readonly<Record<string, string>> = {};
  let problem: string | undefined;
  const project = (): ProjectState => {
    if (state === undefined) throw new Error("The Nuxt project is read when Vite's configuration is");
    return state;
  };
  const main: Plugin = {
    name: "forgebook:nuxt",
    enforce: "pre",
    config: async (userConfig: UserConfig, environment: ConfigEnv): Promise<UserConfig> => {
      const rootDir = join(userConfig.root ?? process.cwd(), options.dir ?? ".");
      const loaded = await loadNuxtConfig(rootDir);
      problem = loaded.problem;
      // Nuxt's variables only: the environment's others never reach the page
      env = loadEnv(environment.mode, rootDir, "NUXT_");
      state = await readProject(loaded.config, env);
      const isDev = environment.command === "serve";
      return {
        resolve: { alias: aliasesOf(loaded.config) },
        define: {
          "import.meta.client": "true",
          "import.meta.browser": "true",
          "import.meta.server": "false",
          "import.meta.nitro": "false",
          "import.meta.prerender": "false",
          "import.meta.dev": JSON.stringify(isDev),
          "import.meta.test": "false"
        },
        // the stand-ins and the renderer are one module graph, served from their sources: see the module's remarks
        optimizeDeps: { exclude: ["@forgebook/nuxt"] },
        ssr: { noExternal: ["@forgebook/nuxt"] }
      };
    },
    configResolved: (config: ResolvedConfig): void => {
      if (problem !== undefined) config.logger.warn(`[forgebook] ${problem}`);
    },
    resolveId: (id: string): string | undefined => {
      if (VIRTUAL_MODULES.some((name) => name === id)) return resolvedId(id);
      // a deep import of Nuxt's app (`#app/composables/router`) names a part of what `#app` exports
      if (id.startsWith("#app/") || id.startsWith("nuxt/app/")) return resolvedId("#app");
      if (BUILD_MODULE.test(id)) return resolvedId(`build:${id.slice(1)}`);
      return undefined;
    },
    load: async (id: string): Promise<string | undefined> => {
      if (!id.startsWith(RESOLVED)) return undefined;
      const name = nameOfId(id);
      if (name.startsWith("build:"))
        return `throw new Error(${JSON.stringify(`#${name.slice(6)} is written by Nuxt's build, which a catalogue does not run`)});`;
      return virtualModule(name, project());
    },
    configureServer: (server: ViteDevServer): void => {
      const isWatched = (file: string, isAddedOrRemoved: boolean): boolean => {
        const { config } = project();
        const isIn = (dir: string): boolean => file.startsWith(`${dir}${sep}`);
        // an added or removed page or component changes the project; an edited one only its own module
        if (config.importsDirs.some(isIn)) return true;
        return (
          isAddedOrRemoved && [config.pagesDir, ...config.componentsDirs.map((dir) => dir.path)].some(isIn)
        );
      };
      const reread = async (file: string, isAddedOrRemoved: boolean): Promise<void> => {
        if (!isWatched(file, isAddedOrRemoved)) return;
        const before = shapeOf(project());
        state = await readProject(project().config, env);
        // an edit that changes no export of a composable leaves the page to its hot update
        if (shapeOf(project()) === before) return;
        for (const name of VIRTUAL_MODULES) {
          const module = server.moduleGraph.getModuleById(resolvedId(name));
          if (module !== undefined) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", (file: string) => void reread(file, true));
      server.watcher.on("unlink", (file: string) => void reread(file, true));
      server.watcher.on("change", (file: string) => void reread(file, false));
    }
  };
  // after Vue's plugin has compiled a component, before Vite's own post plugins resolve the imports this one adds
  const imports: Plugin = {
    name: "forgebook:nuxt-imports",
    enforce: "post",
    transform: {
      async handler(
        code: string,
        id: string
      ): Promise<{ readonly code: string; readonly map: SourceMap } | undefined> {
        const [file = "", query = ""] = id.split("?");
        if (id.startsWith("\0") || !CODE_FILE.test(file) || file.includes("/node_modules/")) return undefined;
        if (query !== "" && !query.includes("type=script")) return undefined;
        const current = project();
        if (!file.startsWith(normalizePath(current.config.rootDir))) return undefined;
        const source = new MagicString(code);
        const withComponents = withComponentImports(source, current.components);
        const result = current.config.isAutoImport
          ? await current.unimport.injectImports(source, id, { autoImport: true })
          : undefined;
        if (withComponents === undefined && (result === undefined || result.imports.length === 0))
          return undefined;
        return { code: source.toString(), map: source.generateMap({ hires: "boundary", source: id }) };
      }
    }
  };
  return [main, imports];
};
