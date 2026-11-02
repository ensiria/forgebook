/**
 * `$app/navigation` in a catalogue: `goto` and a link move the story's page (its address, route, params and data),
 * the navigation callbacks run as in the app, and every call is listed among the story's events.
 *
 * @remarks
 * A story that gives a callback of its own (`parameters.sveltekit.navigation.goto`, as Storybook's SvelteKit names it)
 * has it called with the call's arguments too. The frame's address and history are never touched: they name the story.
 *
 * @module
 */
import { onMount } from "svelte";

import type { KitNavigation, NavigationParameters } from "../kitParameters.ts";
import { type BeforeNavigation, currentStore, type KitStore } from "../kitStore.ts";

/**
 * `goto`'s options: the new page's state is read; the others (`replaceState`, `noScroll`, `keepFocus`…) are kept for
 * the call's record, since a story's page has no history, scroll or focus of its own to keep.
 */
export type GotoOptions = {
  /** The new page's state. */
  readonly state?: Readonly<Record<string, unknown>>;
  /** Any of SvelteKit's other options. */
  readonly [option: string]: unknown;
};

/** What `preloadData` resolves with. */
export type PreloadResult = {
  /** Always `loaded`: the story's loads ran, or there are none. */
  readonly type: "loaded";
  /** The status: 200. */
  readonly status: number;
  /** The data the story's loads give the href. */
  readonly data: Readonly<Record<string, unknown>>;
};

/**
 * Records a call and hands it to the story's own callback, when it gives one.
 *
 * @param store - the story's page.
 * @param name - the function's name.
 * @param values - what it was called with.
 */
const called = (store: KitStore, name: keyof NavigationParameters, values: readonly unknown[]): void => {
  store.record(name, values);
  const callback = store.kit.navigation[name];
  if (typeof callback === "function") Reflect.apply(callback, undefined, values);
};

/**
 * Goes to an address, as a story's page: its route, params and data follow, the navigation callbacks run.
 *
 * @param url - where to go, from the page's address.
 * @param options - the new page's state; the page's data is loaded again at every move.
 * @returns resolves once the page moved; rejects for an address outside the app, as SvelteKit does.
 */
export const goto = async (url: string | URL, options?: GotoOptions): Promise<void> => {
  const store = currentStore();
  called(store, "goto", options === undefined ? [String(url)] : [String(url), options]);
  const read: GotoOptions = options ?? {};
  const moved = await store.navigate("goto", url, read.state === undefined ? {} : { state: read.state });
  if (!moved && new URL(url, store.page().url).origin !== store.page().url.origin)
    throw new Error(
      `goto cannot go to an address outside the app (${String(url)}): use window.location instead`
    );
};

/**
 * Loads the page's data again, as when something it depends on changed.
 *
 * @param resource - what changed: an address, a dependency's name, or a test of an address.
 */
export const invalidate = async (resource: string | URL | ((url: URL) => boolean)): Promise<void> => {
  const store = currentStore();
  called(store, "invalidate", [typeof resource === "function" ? "(url) => …" : String(resource)]);
  await store.reload();
};

/** Loads the page's data again (SvelteKit 2). */
export const invalidateAll = async (): Promise<void> => {
  const store = currentStore();
  called(store, "invalidateAll", []);
  await store.reload();
};

/** Loads the page's data again, keeping its state (SvelteKit 3). */
export const refreshAll = async (): Promise<void> => {
  const store = currentStore();
  called(store, "refreshAll", []);
  await store.reload();
};

/**
 * Loads an address's data without going there.
 *
 * @param href - the address.
 */
export const preloadData = async (href: string): Promise<PreloadResult> => {
  const store = currentStore();
  called(store, "preloadData", [href]);
  return { type: "loaded", status: 200, data: await store.dataAt(href) };
};

/**
 * Loads a route's code: a story's code is loaded already.
 *
 * @param pathnames - the routes.
 */
export const preloadCode = async (...pathnames: readonly string[]): Promise<void> => {
  called(currentStore(), "preloadCode", pathnames);
  await Promise.resolve();
};

/**
 * Sets the page's state without a navigation (shallow routing).
 *
 * @param url - the address the state belongs to; recorded.
 * @param state - the page's new state.
 */
export const pushState = (url: string | URL, state: Readonly<Record<string, unknown>>): void => {
  const store = currentStore();
  called(store, "pushState", [String(url), state]);
  store.setPage({ state });
};

/**
 * Replaces the page's state without a navigation (shallow routing).
 *
 * @param url - the address the state belongs to; recorded.
 * @param state - the page's new state.
 */
export const replaceState = (url: string | URL, state: Readonly<Record<string, unknown>>): void => {
  const store = currentStore();
  called(store, "replaceState", [String(url), state]);
  store.setPage({ state });
};

/** Leaves the scroll as it is after a navigation: a story's page never scrolls on its own. */
export const disableScrollHandling = (): void => undefined;

/**
 * Captures and restores a component's state across the history (SvelteKit 3): a story's history is its own, so there
 * is nothing to restore.
 */
export const snapshot = (): void => undefined;

/**
 * Runs a callback when the component is drawn, with the page's first navigation, and after every navigation of the
 * story's page. Called while a component is set up.
 *
 * @param callback - the callback.
 */
export const afterNavigate = (callback: (navigation: KitNavigation) => void): void => {
  const store = currentStore();
  onMount(() => {
    callback(store.enter());
    return store.afterNavigate(callback);
  });
};

/**
 * Runs a callback before every navigation of the story's page, which it may cancel. Called while a component is set up.
 *
 * @param callback - the callback.
 */
export const beforeNavigate = (callback: (navigation: BeforeNavigation) => void): void => {
  const store = currentStore();
  onMount(() => store.beforeNavigate(callback));
};

/**
 * Runs a callback as every navigation of the story's page starts; a function it returns runs once it is done. Called
 * while a component is set up.
 *
 * @param callback - the callback.
 */
export const onNavigate = (callback: (navigation: KitNavigation) => unknown): void => {
  const store = currentStore();
  onMount(() => store.onNavigate(callback));
};
