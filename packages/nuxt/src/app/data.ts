/**
 * Nuxt's data fetching in a catalogue: `useAsyncData`, `useFetch`, their lazy forms, `refreshNuxtData`,
 * `clearNuxtData`, `useNuxtData` and `$fetch`.
 *
 * @remarks
 * A story gives the data of a key (`parameters.nuxt.data`) and the composable returns it without calling its handler,
 * as Nuxt returns the payload the server sent. Without it the handler runs: `useFetch`'s request goes out, so the
 * catalogue's MSW handlers answer it. `useFetch`'s key is its URL (with its method when not GET) unless it is given
 * one, since Nuxt's own key is a hash a story could not write. The calls of one key share their data, as Nuxt's do.
 *
 * On the server (a generated server test) no handler runs, since no server is there to answer: the story's data is
 * drawn, or nothing.
 *
 * What is returned is Nuxt 4's: `data` and `error` are `undefined` until there is one, and the result can be awaited.
 * `server`, `lazy` and `dedupe` change nothing in the page, where everything runs.
 *
 * @module
 */
import {
  computed,
  getCurrentScope,
  onScopeDispose,
  type Ref,
  ref,
  toValue,
  type WatchSource,
  watch
} from "vue";

import { createError, type NuxtError } from "../nuxtError.ts";
import {
  type AsyncDataEntry,
  type AsyncDataStatus,
  type NuxtAppStandIn,
  type NuxtStore,
  useNuxtStore
} from "../nuxtStore.ts";
import type { StoryFetchOptions } from "../storyFetch.ts";

/** What `useAsyncData` returns: its data, where it stands, and what runs it again. */
export type AsyncData<TData> = {
  /** What the handler returned (transformed and picked), or the story's data for the key. */
  readonly data: Ref<TData | undefined>;
  /** Whether the handler is running. */
  readonly pending: Readonly<Ref<boolean>>;
  /** Where it stands. */
  readonly status: Ref<AsyncDataStatus>;
  /** What the handler threw. */
  readonly error: Ref<NuxtError | undefined>;
  /** Runs the handler again. */
  readonly refresh: () => Promise<void>;
  /** Runs the handler again: `refresh`'s other name. */
  readonly execute: () => Promise<void>;
  /** Empties the data and the error, as before the first run. */
  readonly clear: () => void;
};

/** The handler of `useAsyncData`: what fetches the data. */
export type AsyncDataHandler<TResult> = (
  nuxtApp: NuxtAppStandIn,
  context: { readonly signal: AbortSignal }
) => Promise<TResult> | TResult;

/** What `useAsyncData` takes besides its key and handler. */
export type AsyncDataOptions<TResult> = {
  /** Whether the server waits for it: no effect in a story. */
  readonly server?: boolean;
  /** Whether navigation waits for it: no effect in a story. */
  readonly lazy?: boolean;
  /** Whether it runs at once; `true` by default. */
  readonly immediate?: boolean;
  /** The data before the handler returns. */
  readonly default?: () => unknown;
  /** Changes what the handler returned. */
  readonly transform?: (input: TResult) => unknown;
  /** The keys of the result kept; all by default. */
  readonly pick?: readonly string[];
  /** What runs the handler again when it changes. */
  readonly watch?: readonly WatchSource[];
  /** Whether a second call waits for the first (`"defer"`) or starts over (`"cancel"`): no effect in a story. */
  readonly dedupe?: "cancel" | "defer";
  /** Whether the data is deep reactive: no effect in a story. */
  readonly deep?: boolean;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The keys of a result kept, as `pick` says.
 *
 * @param value - the result.
 * @param keys - the keys.
 */
const picked = (value: unknown, keys: readonly string[] | undefined): unknown =>
  keys === undefined || !isRecord(value)
    ? value
    : Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]]));

/**
 * The entry of a key: the one a call made before, or a new one.
 *
 * @param key - the key.
 * @param initial - the data a new entry starts with.
 */
const entryOf = (key: string, initial: () => unknown): AsyncDataEntry => {
  const store = useNuxtStore();
  const known = store.asyncData.get(key);
  if (known !== undefined) return known;
  const entry: AsyncDataEntry = {
    data: ref(initial()),
    status: ref("idle"),
    error: ref(undefined),
    running: undefined,
    refresh: async (): Promise<void> => undefined
  };
  store.asyncData.set(key, entry);
  return entry;
};

/** A call of `useAsyncData`, read: its key when it gives one, its handler and its options. */
type AsyncDataCall = {
  /** The key; none for a call that gives none. */
  readonly key: string | undefined;
  /** What fetches the data. */
  readonly handler: AsyncDataHandler<unknown> | undefined;
  /** Its options. */
  readonly options: AsyncDataOptions<unknown>;
};

/**
 * A call written `useAsyncData(key, handler, options)`.
 *
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
const keyedCall = (
  key: string,
  handler: AsyncDataHandler<unknown> | AsyncDataOptions<unknown> | undefined,
  options: AsyncDataOptions<unknown> | undefined
): AsyncDataCall => ({
  key,
  handler: typeof handler === "function" ? handler : undefined,
  options: options ?? {}
});

/**
 * A call written `useAsyncData(handler, options)`.
 *
 * @param handler - what fetches the data.
 * @param options - its options.
 */
const unkeyedCall = (
  handler: AsyncDataHandler<unknown>,
  options: AsyncDataHandler<unknown> | AsyncDataOptions<unknown> | undefined
): AsyncDataCall => ({
  key: undefined,
  handler,
  options: typeof options === "function" || options === undefined ? {} : options
});

/**
 * Runs a key's handler, or gives it the story's data: what it returned, transformed and picked, or the error it threw.
 *
 * @param store - the story's store, the call's own: a refresh from an event handler has no component to find it.
 * @param entry - the key's entry.
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
const runHandler = async (
  store: NuxtStore,
  entry: AsyncDataEntry,
  key: string,
  handler: AsyncDataHandler<unknown> | undefined,
  options: AsyncDataOptions<unknown>
): Promise<void> => {
  if (key in store.storyData) {
    entry.data.value = store.storyData[key];
    entry.error.value = undefined;
    entry.status.value = "success";
    return;
  }
  if (handler === undefined || store.isServer) return;
  entry.status.value = "pending";
  try {
    const result: unknown = await handler(store.nuxtApp, { signal: new AbortController().signal });
    const transformed: unknown = options.transform === undefined ? result : await options.transform(result);
    entry.data.value = picked(transformed, options.pick);
    entry.error.value = undefined;
    entry.status.value = "success";
  } catch (error) {
    entry.data.value = options.default?.();
    entry.error.value = createError(error);
    entry.status.value = "error";
  }
};

/**
 * The run a call waits for: the one under way for its key, a new one when the key never ran, else none.
 *
 * @param entry - the key's entry.
 * @param refresh - what starts a run.
 */
const startedRun = (entry: AsyncDataEntry, refresh: () => Promise<void>): Promise<void> => {
  if (entry.running !== undefined) return entry.running;
  return entry.status.value === "idle" ? refresh() : Promise.resolve();
};

/**
 * Fetches data once for a key, shared by every call with the key: the story's data for it when the story gives some,
 * else what the handler returns.
 *
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export function useAsyncData<TResult>(
  key: string,
  handler: AsyncDataHandler<TResult>,
  options?: AsyncDataOptions<TResult>
): AsyncData<TResult> & Promise<AsyncData<TResult>>;
/**
 * Fetches data, under a key of its own.
 *
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export function useAsyncData<TResult>(
  handler: AsyncDataHandler<TResult>,
  options?: AsyncDataOptions<TResult>
): AsyncData<TResult> & Promise<AsyncData<TResult>>;
export function useAsyncData(
  first: string | AsyncDataHandler<unknown>,
  second?: AsyncDataHandler<unknown> | AsyncDataOptions<unknown>,
  third?: AsyncDataOptions<unknown>
): AsyncData<unknown> & Promise<AsyncData<unknown>> {
  const store = useNuxtStore();
  const call = typeof first === "string" ? keyedCall(first, second, third) : unkeyedCall(first, second);
  const key = call.key ?? store.nextKey("data");
  const { handler, options } = call;
  const entry = entryOf(key, () => options.default?.());
  const refresh = async (): Promise<void> => {
    const running = runHandler(store, entry, key, handler, options).finally(() => {
      entry.running = undefined;
    });
    entry.running = running;
    await running;
  };
  if (entry.running === undefined && entry.status.value === "idle") entry.refresh = refresh;
  const started = options.immediate === false ? Promise.resolve() : startedRun(entry, refresh);
  if (options.watch !== undefined && options.watch.length > 0) {
    const stop = watch([...options.watch], () => {
      void refresh();
    });
    if (getCurrentScope() !== undefined) onScopeDispose(stop);
  }
  const asyncData: AsyncData<unknown> = {
    data: entry.data,
    pending: computed(() => entry.status.value === "pending"),
    status: entry.status,
    error: entry.error,
    refresh,
    execute: refresh,
    clear: (): void => {
      entry.data.value = options.default?.();
      entry.error.value = undefined;
      entry.status.value = "idle";
    }
  };
  return Object.assign(
    started.then(() => asyncData),
    asyncData
  );
}

/**
 * `useAsyncData` that does not hold navigation: the same in a story.
 *
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export const useLazyAsyncData = <TResult>(
  key: string,
  handler: AsyncDataHandler<TResult>,
  options: AsyncDataOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => useAsyncData(key, handler, { ...options, lazy: true });

/** What `useFetch` takes: `$fetch`'s options, and `useAsyncData`'s. */
export type UseFetchOptions<TResult> = AsyncDataOptions<TResult> &
  StoryFetchOptions & {
    /** The key the data is shared and given under; the URL by default. */
    readonly key?: string;
  };

/**
 * Fetches a URL, as `useAsyncData` with `$fetch`: the story's data for its key when it gives some, else the request,
 * which the catalogue's MSW handlers answer. Its key is the URL, with the method when it is not GET.
 *
 * @param url - the URL, or what gives it (a ref, a function), followed when it changes.
 * @param options - the request's options and `useAsyncData`'s.
 */
export const useFetch = <TResult = unknown>(
  url: string | Ref<string> | (() => string),
  options: UseFetchOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => {
  const store = useNuxtStore();
  const method = (options.method ?? "GET").toUpperCase();
  const address = toValue(url);
  const key = options.key ?? (method === "GET" ? address : `${method} ${address}`);
  const {
    key: _key,
    server,
    lazy,
    immediate,
    default: _default,
    transform,
    pick,
    watch: _watch,
    dedupe,
    deep,
    ...request
  } = options;
  const followed: WatchSource[] = typeof url === "string" ? [] : [(): string => toValue(url)];
  return useAsyncData<TResult>(
    key,
    (): Promise<TResult> => store.fetch<TResult>(toValue(url), { ...request, method }),
    { ...options, watch: [...(options.watch ?? []), ...followed] }
  );
};

/**
 * `useFetch` that does not hold navigation: the same in a story.
 *
 * @param url - the URL.
 * @param options - its options.
 */
export const useLazyFetch = <TResult = unknown>(
  url: string | Ref<string> | (() => string),
  options: UseFetchOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => useFetch<TResult>(url, { ...options, lazy: true });

/**
 * The keys a function for every key takes: the ones given, or all.
 *
 * @param keys - a key, keys, or none.
 */
const keysOf = (keys: string | readonly string[] | undefined): readonly string[] => {
  if (keys === undefined) return [...useNuxtStore().asyncData.keys()];
  return typeof keys === "string" ? [keys] : keys;
};

/**
 * Runs the handlers of keys again.
 *
 * @param keys - a key, keys, or none for all.
 */
export const refreshNuxtData = async (keys?: string | readonly string[]): Promise<void> => {
  const { asyncData } = useNuxtStore();
  await Promise.all(keysOf(keys).map((key) => asyncData.get(key)?.refresh()));
};

/**
 * Empties the data of keys.
 *
 * @param keys - a key, keys, or none for all.
 */
export const clearNuxtData = (keys?: string | readonly string[]): void => {
  const { asyncData } = useNuxtStore();
  for (const key of keysOf(keys)) {
    const entry = asyncData.get(key);
    if (entry === undefined) continue;
    entry.data.value = undefined;
    entry.error.value = undefined;
    entry.status.value = "idle";
  }
};

/**
 * The data of a key another call fetched.
 *
 * @param key - the key.
 */
export const useNuxtData = (key: string): { readonly data: Ref<unknown> } => ({
  data: entryOf(key, () => useNuxtStore().storyData[key]).data
});

/**
 * Fetches a URL, as Nuxt's `$fetch` (ofetch), with the app's base path.
 *
 * @param request - the URL.
 * @param options - the request's options.
 */
export const $fetch = <TResult = unknown>(request: string, options?: StoryFetchOptions): Promise<TResult> =>
  useNuxtStore().fetch<TResult>(request, options);
