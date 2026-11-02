/**
 * Nuxt's state and app composables in a catalogue: `useState`, `useCookie`, `useRuntimeConfig`, `useAppConfig`,
 * `useNuxtApp`, `callOnce`, `onNuxtReady` and the request's composables.
 *
 * @remarks
 * A story gives what they start with (`parameters.nuxt.state`, `cookies`, `runtimeConfig`, `appConfig`), over what
 * the project gives. Every value lives in the story's store, so two components of one story share a key, as two
 * components of a Nuxt page do, and a story drawn anew starts over. A cookie is never written to the frame's document:
 * the story's store keeps it, so a story cannot leave one behind for the next.
 *
 * The page has no request: `useRequestHeaders` returns none and `useRequestEvent` nothing, as in Nuxt's browser code.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */
import { onMounted, type Ref, ref } from "vue";

import { type NuxtAppStandIn, useNuxtStore } from "../nuxtStore.ts";
import type { PublicRuntimeConfig } from "../project.ts";
import type { StoryFetch } from "../storyFetch.ts";

/**
 * The first of two arguments that is a function: the one a call gives where the key may come first or not.
 *
 * @param first - the first argument.
 * @param second - the second.
 */
const firstFunction = (first: unknown, second: unknown): (() => unknown) | undefined => {
  if (typeof first === "function") return (): unknown => Reflect.apply(first, undefined, []);
  if (typeof second === "function") return (): unknown => Reflect.apply(second, undefined, []);
  return undefined;
};

/**
 * A value shared by every component of the story under a key, starting with the story's value for the key, else
 * `init`'s.
 *
 * @param key - the key.
 * @param init - the value it starts with.
 */
export function useState<TValue>(key: string, init?: () => TValue): Ref<TValue>;
/**
 * A value of its own, under a key of its own.
 *
 * @param init - the value it starts with.
 */
export function useState<TValue>(init?: () => TValue): Ref<TValue>;
export function useState(first?: string | (() => unknown), second?: (() => unknown) | string): Ref<unknown> {
  const store = useNuxtStore();
  // a text after the init is the key the plugin wrote for the call's place
  const placeKey = typeof second === "string" ? second : undefined;
  const key = typeof first === "string" ? first : (placeKey ?? store.nextKey("state"));
  const init = firstFunction(first, second);
  const known = store.state.get(key);
  if (known !== undefined) return known;
  const value = ref(Object.hasOwn(store.storyState, key) ? store.storyState[key] : init?.());
  store.state.set(key, value);
  return value;
}

/**
 * Empties the state of keys.
 *
 * @param keys - a key, keys, or none for all.
 */
export const clearNuxtState = (keys?: string | readonly string[]): void => {
  const { state } = useNuxtStore();
  const given = typeof keys === "string" ? [keys] : keys;
  for (const key of given ?? [...state.keys()]) {
    const value = state.get(key);
    if (value !== undefined) value.value = undefined;
  }
};

/** What `useCookie` takes besides a name. */
export type CookieOptions<TValue> = {
  /** The value when the story gives none. */
  readonly default?: () => TValue;
  /** Whether the ref can be written: no effect, it always can. */
  readonly readonly?: boolean;
  /** Nuxt's other cookie options (`maxAge`, `path`, `sameSite`…): no effect, the cookie stays in the story. */
  readonly [option: string]: unknown;
};

/**
 * A cookie: the story's value for the name, else the default; written in the story only.
 *
 * @param name - the cookie's name.
 * @param options - its default.
 */
export function useCookie<TValue = string | null | undefined>(
  name: string,
  options?: CookieOptions<TValue>
): Ref<TValue>;
export function useCookie(name: string, options: CookieOptions<unknown> = {}): Ref<unknown> {
  const { cookies, storyCookies } = useNuxtStore();
  const known = cookies.get(name);
  if (known !== undefined) return known;
  const value = ref(Object.hasOwn(storyCookies, name) ? storyCookies[name] : options.default?.());
  cookies.set(name, value);
  return value;
}

/** Reads a cookie again from the document: it lives in the story, so there is nothing to read. */
export const refreshCookie = (): void => undefined;

/** The runtime config: the project's public values and app paths, the story's public values over them. */
export const useRuntimeConfig = (): PublicRuntimeConfig => useNuxtStore().runtimeConfig;

/** The app config: the project's `app.config` and `appConfig`, the story's over them. */
export const useAppConfig = (): Record<string, unknown> => useNuxtStore().appConfig;

/**
 * Changes the app config, as Nuxt's `updateAppConfig`.
 *
 * @param values - the values, over the config's.
 */
export const updateAppConfig = (values: Readonly<Record<string, unknown>>): void => {
  Object.assign(useNuxtStore().appConfig, values);
};

/** The story's app: its payload, its config, its router, what plugins would have provided. */
export const useNuxtApp = (): NuxtAppStandIn => useNuxtStore().nuxtApp;

/** The story's app, which there always is in a story. */
export const tryUseNuxtApp = (): NuxtAppStandIn => useNuxtStore().nuxtApp;

/**
 * Runs a function once for the story, as Nuxt runs one once for a request.
 *
 * @param first - the key it runs once under, or the function, keyed by its place in the code.
 * @param second - the function, or the key the plugin wrote for the call's place.
 * @param third - the key the plugin wrote for the call's place, after the options.
 */
export const callOnce = async (
  first: string | (() => unknown),
  second?: (() => unknown) | Readonly<Record<string, unknown>> | string,
  third?: string
): Promise<void> => {
  const { once, nextKey } = useNuxtStore();
  const placeKey = typeof second === "string" ? second : third;
  const key = typeof first === "string" ? first : (placeKey ?? nextKey("once"));
  const work = firstFunction(first, second);
  if (once.has(key) || work === undefined) return;
  once.add(key);
  await work();
};

/**
 * Runs a function once the story is drawn, as Nuxt runs it once the app is.
 *
 * @param run - the function.
 */
export const onNuxtReady = (run: () => unknown): void => {
  onMounted(() => {
    void run();
  });
};

/** The request's headers: there is no request in the page, so none. */
export const useRequestHeaders = (): Record<string, string> => ({});

/** One of the request's headers: there is no request in the page, so none. */
export const useRequestHeader = (): undefined => undefined;

/** The request: none in the page. */
export const useRequestEvent = (): undefined => undefined;

/** The `$fetch` that passes the request's headers on: `$fetch` itself, as in Nuxt's browser code. */
export const useRequestFetch = (): StoryFetch => useNuxtStore().fetch;

/** The address the story's route has, on the frame's origin. */
export const useRequestURL = (): URL => {
  const { router, runtimeConfig } = useNuxtStore();
  const base = runtimeConfig.app.baseURL.replace(/\/$/, "");
  return new URL(
    `${base}${router.currentRoute.value.fullPath}`,
    globalThis.location?.origin ?? "http://localhost"
  );
};

/** Whether the page was prerendered: never, in a story. */
export const isPrerendered = (): boolean => false;

/** The loading indicator's state: nothing loads between pages in a story. */
export const useLoadingIndicator = (): {
  readonly progress: Ref<number>;
  readonly isLoading: Ref<boolean>;
  readonly start: () => void;
  readonly finish: () => void;
  readonly clear: () => void;
} => ({
  progress: ref(0),
  isLoading: ref(false),
  start: (): void => undefined,
  finish: (): void => undefined,
  clear: (): void => undefined
});
