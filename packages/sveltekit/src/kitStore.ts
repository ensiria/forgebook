/**
 * A story's SvelteKit page while it is drawn: the page its components read, where its links and `goto` calls take it,
 * the navigation callbacks its components registered, and the calls it made, told to the catalogue.
 *
 * @remarks
 * The page really moves: a link clicked in a story changes `page.url`, its route and its params (matched against the
 * project's routes), runs `beforeNavigate`, `onNavigate` and `afterNavigate`, and loads the page's data again when the
 * story gives a `load`. The frame's own address never changes (it names the story).
 *
 * Svelte follows the page through `createSubscriber`, so `$app/state` reads it with no rune of its own, and
 * `$app/stores` subscribes to the same changes. One frame draws one story, so the store of the story drawn last is the
 * frame's current one; it sits on a global symbol, so two copies of this module (one pre-bundled, one from the sources)
 * share it.
 *
 * @module
 */
import { createSubscriber } from "svelte/reactivity";

import { appSettings, pageRouteIds } from "./appSettings.ts";
import {
  type KitNavigation,
  type KitPage,
  type NavigationTarget,
  type NavigationType,
  routedPage,
  type StoryKit,
  storyKitOf
} from "./kitParameters.ts";

/** A call a story made to SvelteKit: its function (`goto`) and what it was called with. */
export type KitCall = {
  /** The function, as the catalogue lists it (`goto`, `invalidateAll`, `link`). */
  readonly name: string;
  /** What it was called with. */
  readonly values: readonly unknown[];
};

/** Tells the catalogue about a call: the frame's event report, when the catalogue gives one. */
export type CallReport = (name: string, values: readonly unknown[]) => void;

/** Loads the page's data for an address: the story's loads, run by the renderer. */
export type DataLoader = (
  page: Pick<KitPage, "url" | "params" | "route">
) => Promise<Readonly<Record<string, unknown>>>;

/** A `beforeNavigate` callback's argument: the navigation, and how to stop it. */
export type BeforeNavigation = KitNavigation & {
  /** Stops the navigation. */
  readonly cancel: () => void;
};

/** The navigation callbacks a component registers, by when they run. */
type Listeners = {
  readonly before: Set<(navigation: BeforeNavigation) => void>;
  readonly on: Set<(navigation: KitNavigation) => unknown>;
  readonly after: Set<(navigation: KitNavigation) => void>;
};

/** What a navigation gives the new page. */
export type NavigateOptions = {
  /** The page's new state (`App.PageState`). */
  readonly state?: Readonly<Record<string, unknown>>;
};

/** A story's SvelteKit page. */
export type KitStore = {
  /** The story's settings. */
  readonly kit: StoryKit;
  /** The page, as it is now; read in an effect, the effect follows it. */
  readonly page: () => KitPage;
  /** The navigation under way, or the story's own; `null` when none. */
  readonly navigating: () => Partial<KitNavigation> | null;
  /** Whether a new version is out. */
  readonly updated: () => boolean;
  /** Calls a listener whenever the page changes; returns what stops it. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Changes some of the page's fields (`form`, `status`, `error`, `state`, `data`). */
  readonly setPage: (fields: Partial<KitPage>) => void;
  /**
   * Goes to an href from the page: a navigation of the app, or none for one outside it.
   *
   * @returns whether the page moved.
   */
  readonly navigate: (
    type: NavigationType,
    href: string | URL,
    options?: NavigateOptions
  ) => Promise<boolean>;
  /** The data the story's loads give an href, without going there, as `preloadData` does; `{}` without loads. */
  readonly dataAt: (href: string | URL) => Promise<Readonly<Record<string, unknown>>>;
  /** Loads the page's data again, as `invalidate` and `refreshAll` do. */
  readonly reload: () => Promise<void>;
  /** Sets what loads the page's data, once the renderer has the story's loads. */
  readonly setLoader: (loader: DataLoader | undefined) => void;
  /** Registers a `beforeNavigate` callback; returns what removes it. */
  readonly beforeNavigate: (callback: (navigation: BeforeNavigation) => void) => () => void;
  /** Registers an `onNavigate` callback; returns what removes it. */
  readonly onNavigate: (callback: (navigation: KitNavigation) => unknown) => () => void;
  /** Registers an `afterNavigate` callback; returns what removes it. */
  readonly afterNavigate: (callback: (navigation: KitNavigation) => void) => () => void;
  /** The navigation `afterNavigate` sees as the page is drawn. */
  readonly enter: () => KitNavigation;
  /** Records a call and tells the catalogue. */
  readonly record: (name: string, values: readonly unknown[]) => void;
  /** The calls the story made, in order. */
  readonly calls: () => readonly KitCall[];
};

/**
 * Where a page is, as a navigation names it.
 *
 * @param page - the page.
 */
const targetOf = (page: Pick<KitPage, "url" | "params" | "route">): NavigationTarget => ({
  params: page.params,
  route: page.route,
  url: page.url
});

/**
 * A navigation from a page to another, once every `beforeNavigate` callback let it start.
 *
 * @param type - how it started.
 * @param from - the page it leaves.
 * @param to - where it goes.
 * @param before - the `beforeNavigate` callbacks.
 * @returns the navigation and what says it is done, or none when a callback cancelled it.
 */
const startNavigation = (
  type: NavigationType,
  from: Pick<KitPage, "url" | "params" | "route">,
  to: Pick<KitPage, "url" | "params" | "route">,
  before: ReadonlySet<(navigation: BeforeNavigation) => void>
): { readonly navigation: KitNavigation; readonly complete: () => void } | undefined => {
  let isCancelled = false;
  let complete = (): void => undefined;
  const navigation: KitNavigation = {
    from: targetOf(from),
    to: targetOf(to),
    type,
    willUnload: false,
    complete: new Promise<void>((resolve) => {
      complete = resolve;
    })
  };
  const cancel = (): void => {
    isCancelled = true;
  };
  for (const callback of [...before]) callback({ ...navigation, cancel });
  return isCancelled ? undefined : { navigation, complete };
};

/**
 * Adds a callback to a set.
 *
 * @param set - the set.
 * @param callback - the callback.
 * @returns what removes it.
 */
const registered = <TCallback>(set: Set<TCallback>, callback: TCallback): (() => void) => {
  set.add(callback);
  return (): void => {
    set.delete(callback);
  };
};

/**
 * A story's SvelteKit page.
 *
 * @param parameters - the story's parameters, which give its page.
 * @param report - tells the catalogue about each call; none outside a catalogue.
 */
export const createKitStore = (
  parameters: Readonly<Record<string, unknown>>,
  report: CallReport | undefined
): KitStore => {
  const { base } = appSettings();
  const kit = storyKitOf(parameters, pageRouteIds(), base);
  let page = kit.page;
  let navigating = kit.navigating;
  const listeners = new Set<() => void>();
  const callbacks: Listeners = { before: new Set(), on: new Set(), after: new Set() };
  const made: KitCall[] = [];
  let loader: DataLoader | undefined;
  const changed = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  };
  const track = createSubscriber((update: () => void) => subscribe(update));
  const loadData = async (at: Pick<KitPage, "url" | "params" | "route">): Promise<void> => {
    if (loader === undefined) return;
    const data = await loader(at);
    page = { ...page, data };
    changed();
  };
  return {
    kit,
    page: (): KitPage => {
      track();
      return page;
    },
    navigating: (): Partial<KitNavigation> | null => {
      track();
      return navigating;
    },
    updated: (): boolean => kit.updated,
    subscribe,
    setPage: (fields: Partial<KitPage>): void => {
      page = { ...page, ...fields };
      changed();
    },
    navigate: async (
      type: NavigationType,
      href: string | URL,
      options: NavigateOptions = {}
    ): Promise<boolean> => {
      const url = new URL(href, page.url);
      if (url.origin !== page.url.origin) return false;
      const to = routedPage(url, pageRouteIds(), base);
      const started = startNavigation(type, page, to, callbacks.before);
      if (started === undefined) return false;
      const { navigation, complete } = started;
      navigating = navigation;
      changed();
      const afterwards: unknown[] = [];
      for (const callback of [...callbacks.on]) afterwards.push(await callback(navigation));
      page = { ...page, ...to, state: options.state ?? {}, form: null, error: null, status: 200 };
      // a load reads the address and the params, so every move loads the data again, as SvelteKit's does
      await loadData(to);
      navigating = null;
      changed();
      for (const after of afterwards) if (typeof after === "function") after();
      for (const callback of [...callbacks.after]) callback(navigation);
      complete();
      return true;
    },
    dataAt: async (href: string | URL): Promise<Readonly<Record<string, unknown>>> =>
      loader === undefined ? {} : loader(routedPage(new URL(href, page.url), pageRouteIds(), base)),
    reload: async (): Promise<void> => {
      await loadData(page);
    },
    setLoader: (next: DataLoader | undefined): void => {
      loader = next;
    },
    beforeNavigate: (callback: (navigation: BeforeNavigation) => void): (() => void) =>
      registered(callbacks.before, callback),
    onNavigate: (callback: (navigation: KitNavigation) => unknown): (() => void) =>
      registered(callbacks.on, callback),
    afterNavigate: (callback: (navigation: KitNavigation) => void): (() => void) =>
      registered(callbacks.after, callback),
    enter: (): KitNavigation => ({
      from: null,
      to: targetOf(page),
      type: "enter",
      willUnload: false,
      complete: Promise.resolve(),
      ...kit.navigation.afterNavigate
    }),
    record: (name: string, values: readonly unknown[]): void => {
      made.push({ name, values });
      report?.(name, values);
    },
    calls: (): readonly KitCall[] => [...made]
  };
};

/** Where the frame's current store is kept: one key for every copy of this module. */
const CURRENT_KEY = Symbol.for("forgebook.sveltekit.page-store");

/** The store a frame has before any story is drawn, and outside a catalogue: `/`, no data. */
let idleStore: KitStore | undefined;

/**
 * Makes a store the frame's current one: the story drawn last.
 *
 * @param store - the store.
 */
export const setCurrentStore = (store: KitStore): void => {
  Reflect.set(globalThis, CURRENT_KEY, store);
};

/** Whether a value is a store this module made. */
const isKitStore = (value: unknown): value is KitStore =>
  typeof value === "object" &&
  value !== null &&
  "page" in value &&
  typeof value.page === "function" &&
  "navigate" in value &&
  typeof value.navigate === "function";

/** The frame's current store: the story drawn last, or an idle one at `/`. */
export const currentStore = (): KitStore => {
  const store: unknown = Reflect.get(globalThis, CURRENT_KEY);
  if (isKitStore(store)) return store;
  idleStore ??= createKitStore({}, undefined);
  return idleStore;
};
