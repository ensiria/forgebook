/**
 * A story's Nuxt, while it is drawn: its router, the calls it made, the data, state and cookies its composables share,
 * its runtime and app config, and the app `useNuxtApp` returns.
 *
 * @remarks
 * The router is vue-router's own, on a memory history, with a route for each of the project's pages and one that
 * takes any other path: a link clicked in a story moves it, `useRoute` follows, `back()` returns, and the frame's own
 * address never changes (it names the story). Each move and each `navigateTo` is told to the catalogue, which lists it
 * among the story's events.
 *
 * A story's composables find its store through Vue's injection, so each cell of a matrix has its own. Outside a
 * component's setup (an event handler, a play function) they read the frame's current store, the story drawn last, as
 * Nuxt's composables read its one app; it sits on a global symbol, so two copies of this module share it.
 *
 * @module
 */
import {
  type App,
  defineComponent,
  hasInjectionContext,
  type InjectionKey,
  inject,
  type Ref,
  reactive,
  ref
} from "vue";
import {
  createMemoryHistory,
  createRouter,
  type RouteLocationRaw,
  type RouteRecordRaw,
  type Router
} from "vue-router";

import type { NuxtError } from "./nuxtError.ts";
import { mergedRecords, storyNuxtOf } from "./parameters.ts";
import { EMPTY_PROJECT, type NuxtProject, type PublicRuntimeConfig } from "./project.ts";
import { createStoryFetch, type StoryFetch } from "./storyFetch.ts";

/** A call a story made to Nuxt: its function (`router.push`, `navigateTo`) and what it was called with. */
export type NuxtCall = {
  /** The function, as the catalogue lists it. */
  readonly name: string;
  /** What it was called with: a location as its full path. */
  readonly values: readonly unknown[];
};

/** Where an `useAsyncData` stands. */
export type AsyncDataStatus = "idle" | "pending" | "success" | "error";

/** What the `useAsyncData` and `useFetch` of one key share. */
export type AsyncDataEntry = {
  /** What the handler returned, or the story's data for the key. */
  readonly data: Ref<unknown>;
  /** Where it stands. */
  readonly status: Ref<AsyncDataStatus>;
  /** What the handler threw. */
  readonly error: Ref<NuxtError | undefined>;
  /** The data the key has before a handler returns, and after `clearNuxtData`: the first call's `default`. */
  readonly defaultData: () => unknown;
  /** The run under way, which a second call with the key waits for instead of calling its handler again. */
  running: Promise<void> | undefined;
  /** The number of the latest run: a run that is no longer the latest drops its result. */
  runId: number;
  /** What aborts the run under way, when a later one starts. */
  controller: AbortController | undefined;
  /** Runs the handler of the first call again; nothing until a call gives one. */
  refresh: (() => Promise<void>) | undefined;
};

/** Tells the catalogue about a call: the drawing's `onEvent`, when the catalogue gives one. */
export type CallReport = (name: string, values: readonly unknown[]) => void;

/** The app `useNuxtApp` returns: what of Nuxt's a component reads from it. */
export type NuxtAppStandIn = {
  /** The story's Vue app, once the story's app is prepared. */
  vueApp: App | undefined;
  /** The payload: the data and state Nuxt would have sent from the server; empty, since there is no server. */
  readonly payload: { readonly data: Record<string, unknown>; readonly state: Record<string, unknown> };
  /** The public runtime config. */
  // biome-ignore lint/style/useNamingConvention: Nuxt's app names it so
  readonly $config: PublicRuntimeConfig;
  /** The story's router. */
  // biome-ignore lint/style/useNamingConvention: Nuxt's app names it so
  readonly $router: Router;
  /** Always `false`: a story is drawn in the page, never hydrated. */
  readonly isHydrating: boolean;
  /** Gives the app a value as `$name`, as a plugin's `provide` does. */
  readonly provide: (name: string, value: unknown) => void;
  /** Adds a listener to one of Nuxt's hooks; returns what removes it. */
  readonly hook: (name: string, listener: (...values: unknown[]) => unknown) => () => void;
  /** Calls the listeners of a hook, one after the other. */
  readonly callHook: (name: string, ...values: unknown[]) => Promise<void>;
  /** Runs a function, as it would run with the app as its context. */
  readonly runWithContext: <TResult>(run: () => TResult) => TResult;
  /** What `provide` gave, as `$name`. */
  readonly provided: Record<string, unknown>;
};

/** A story's Nuxt. */
export type NuxtStore = {
  /** The story's router. */
  readonly router: Router;
  /** The app `useNuxtApp` returns. */
  readonly nuxtApp: NuxtAppStandIn;
  /** The runtime config: the project's, the story's public values over it. */
  readonly runtimeConfig: PublicRuntimeConfig;
  /** The app config: the project's, the story's over it; reactive, as `updateAppConfig` changes it. */
  readonly appConfig: Record<string, unknown>;
  /** The data the story gives `useAsyncData` and `useFetch`, by key. */
  readonly storyData: Readonly<Record<string, unknown>>;
  /** What `useAsyncData` and `useFetch` share, by key. */
  readonly asyncData: Map<string, AsyncDataEntry>;
  /** The values the story gives `useState`, by key. */
  readonly storyState: Readonly<Record<string, unknown>>;
  /** What `useState` shares, by key. */
  readonly state: Map<string, Ref<unknown>>;
  /** The values the story gives `useCookie`, by name. */
  readonly storyCookies: Readonly<Record<string, unknown>>;
  /** What `useCookie` shares, by name. */
  readonly cookies: Map<string, Ref<unknown>>;
  /** The error `showError` set and `useError` returns. */
  readonly error: Ref<NuxtError | undefined>;
  /** The keys `callOnce` ran. */
  readonly once: Set<string>;
  /** `$fetch`, with the app's base path. */
  readonly fetch: StoryFetch;
  /** Records a call and tells the catalogue. */
  readonly record: (name: string, values: readonly unknown[]) => void;
  /** The calls the story made, in order. */
  readonly calls: () => readonly NuxtCall[];
  /** A key of its own for a call that gives none, as Nuxt's compiler writes one per call site. */
  readonly nextKey: (kind: string) => string;
  /** Moves the router without recording the move: for a function that records a call of its own (`navigateTo`). */
  readonly move: (to: RouteLocationRaw, isReplace: boolean) => Promise<unknown>;
  /**
   * Whether the story is drawn on the server (a generated server test): there is no server to answer a request there,
   * so `useAsyncData` runs no handler, and draws what the story's data gives.
   */
  readonly isServer: boolean;
  /** Gives a story's app the router and the store. */
  readonly install: (app: App) => void;
};

/** The key a story's app provides its store under. */
export const NUXT_STORE: InjectionKey<NuxtStore> = Symbol("forgebook.nuxt.store");

/** What a page's route draws: nothing, since a story draws its own component, not the page. */
const EMPTY_PAGE = defineComponent({ name: "ForgebookNuxtPage", render: () => null });

/** The name of the route that takes any path the project's pages do not. */
export const ANY_PATH_NAME = "forgebook-any-path";

/** The route that takes any path the project's pages do not. */
const ANY_PATH: RouteRecordRaw = { path: "/:forgebookPath(.*)*", name: ANY_PATH_NAME, component: EMPTY_PAGE };

/**
 * The app `useNuxtApp` returns.
 *
 * @param router - the story's router.
 * @param config - the runtime config.
 */
const createNuxtApp = (router: Router, config: PublicRuntimeConfig): NuxtAppStandIn => {
  const hooks = new Map<string, ((...values: unknown[]) => unknown)[]>();
  const provided: Record<string, unknown> = {};
  return {
    vueApp: undefined,
    payload: { data: {}, state: {} },
    // biome-ignore lint/style/useNamingConvention: Nuxt's app names it so
    $config: config,
    // biome-ignore lint/style/useNamingConvention: Nuxt's app names it so
    $router: router,
    isHydrating: false,
    provided,
    provide: (name: string, value: unknown): void => {
      provided[`$${name}`] = value;
    },
    hook: (name: string, listener: (...values: unknown[]) => unknown): (() => void) => {
      hooks.set(name, [...(hooks.get(name) ?? []), listener]);
      return (): void => {
        hooks.set(
          name,
          (hooks.get(name) ?? []).filter((each) => each !== listener)
        );
      };
    },
    callHook: async (name: string, ...values: unknown[]): Promise<void> => {
      for (const listener of hooks.get(name) ?? []) await listener(...values);
    },
    runWithContext: <TResult>(run: () => TResult): TResult => run()
  };
};

/**
 * The router's methods wrapped so each move is recorded, as a story's events list it.
 *
 * @param router - the router.
 * @param record - records a call.
 */
const recordMoves = (router: Router, record: (name: string, values: readonly unknown[]) => void): void => {
  const { push, replace, go, back, forward } = router;
  const pathOf = (to: RouteLocationRaw): string => {
    try {
      return router.resolve(to).fullPath;
    } catch {
      return typeof to === "string" ? to : JSON.stringify(to);
    }
  };
  router.push = (to: RouteLocationRaw): ReturnType<Router["push"]> => {
    record("router.push", [pathOf(to)]);
    return push(to);
  };
  router.replace = (to: RouteLocationRaw): ReturnType<Router["replace"]> => {
    record("router.replace", [pathOf(to)]);
    return replace(to);
  };
  router.go = (delta: number): void => {
    record("router.go", [delta]);
    go(delta);
  };
  router.back = (): void => {
    record("router.back", []);
    back();
  };
  router.forward = (): void => {
    record("router.forward", []);
    forward();
  };
};

/**
 * A story's Nuxt.
 *
 * @param project - what the page knows of the project.
 * @param parameters - the story's parameters, which give its route, data, state, cookies and config.
 * @param onEvent - tells the catalogue about each call (the drawing's `onEvent`); none outside a catalogue.
 * @param place - where the story is drawn: in the page, or on the server; the page by default.
 */
export const createNuxtStore = (
  project: NuxtProject,
  parameters: Readonly<Record<string, unknown>>,
  onEvent: CallReport | undefined,
  place: "page" | "server" = "page"
): NuxtStore => {
  const read = storyNuxtOf(parameters);
  const runtimeConfig: PublicRuntimeConfig = {
    public: mergedRecords(project.runtimeConfig.public, read.publicRuntimeConfig),
    app: project.runtimeConfig.app
  };
  const history = createMemoryHistory(runtimeConfig.app.baseURL);
  const router = createRouter({
    history,
    routes: [...project.routes.map((route) => ({ ...route, component: EMPTY_PAGE })), ANY_PATH]
  });
  // the story's route before anything is drawn: a component reads its params once, in its setup
  let start = router.resolve("/");
  try {
    start = router.resolve(read.route);
  } catch {
    // a location naming no route stays at `/`
  }
  history.replace(start.fullPath);
  // every route has a name (the project's pages and the one for any other path), which the current route requires
  if (start.name !== null) router.currentRoute.value = { ...start, name: start.name };
  const { push, replace } = router;
  const made: NuxtCall[] = [];
  const record = (name: string, values: readonly unknown[]): void => {
    made.push({ name, values });
    onEvent?.(name, values);
  };
  recordMoves(router, record);
  let keys = 0;
  const nuxtApp = createNuxtApp(router, runtimeConfig);
  const store: NuxtStore = {
    router,
    nuxtApp,
    runtimeConfig,
    appConfig: reactive([...project.appConfigs, read.appConfig].reduce(mergedRecords, {})),
    storyData: read.data,
    asyncData: new Map(),
    storyState: read.state,
    state: new Map(),
    storyCookies: read.cookies,
    cookies: new Map(),
    error: ref(undefined),
    once: new Set(),
    fetch: createStoryFetch(runtimeConfig.app.baseURL),
    record,
    calls: (): readonly NuxtCall[] => [...made],
    nextKey: (kind: string): string => {
      keys += 1;
      return `$forgebook-${kind}-${keys}`;
    },
    isServer: place === "server",
    move: (to: RouteLocationRaw, isReplace: boolean): Promise<unknown> =>
      isReplace ? replace(to) : push(to),
    install: (app: App): void => {
      nuxtApp.vueApp = app;
      app.use(router);
      app.provide(NUXT_STORE, store);
      app.config.globalProperties["$nuxt"] = nuxtApp;
      // the route is already set, so vue-router does not start; a navigation to it makes it ready and listening
      void replace({ path: start.path, query: start.query, hash: start.hash, force: true }).catch(
        () => undefined
      );
    }
  };
  return store;
};

/** Where the frame's current store is kept: one key for every copy of this module. */
const CURRENT_KEY = Symbol.for("forgebook.nuxt.store");

/**
 * Makes a store the frame's current one: the story drawn last.
 *
 * @param store - the store.
 */
export const setCurrentStore = (store: NuxtStore): void => {
  Reflect.set(globalThis, CURRENT_KEY, store);
};

/** Whether a value is a store this module made. */
const isNuxtStore = (value: unknown): value is NuxtStore =>
  typeof value === "object" && value !== null && "router" in value && "nuxtApp" in value && "record" in value;

/** The frame's current store: the story drawn last, or one made at `/` for code run outside a story. */
export const currentStore = (): NuxtStore => {
  const store: unknown = Reflect.get(globalThis, CURRENT_KEY);
  if (isNuxtStore(store)) return store;
  const idle = createNuxtStore(EMPTY_PROJECT, {}, undefined);
  setCurrentStore(idle);
  return idle;
};

/** The story's store: its app's, in a component's setup, else the frame's current one. */
export const useNuxtStore = (): NuxtStore =>
  (hasInjectionContext() ? inject(NUXT_STORE, undefined) : undefined) ?? currentStore();
