/**
 * Nuxt's data fetching in a catalogue: `useAsyncData`, its lazy form, `refreshNuxtData`, `clearNuxtData` and
 * `useNuxtData`. `useFetch` is written on it (`fetch.ts`).
 *
 * @remarks
 * A story gives the data of a key (`parameters.nuxt.data`) and the composable returns it without calling its handler,
 * as Nuxt returns the payload the server sent. Without it the handler runs. The calls of one key share their data, as
 * Nuxt's do; a key that is a ref follows it, each value with its own data. A call without a key gets the one the plugin
 * writes for its place in the code, as Nuxt's compiler does.
 *
 * On the server (a generated server test) no handler runs, since no server is there to answer: the story's data is
 * drawn, or nothing.
 *
 * What is returned is Nuxt 4's: `data` and `error` are `undefined` until there is one, and the result can be awaited,
 * at once for a lazy call. `server`, `dedupe` and `deep` change nothing in the page, where everything runs.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */
import { computed, getCurrentScope, isRef, onScopeDispose, type Ref, type WatchSource, watch } from "vue";

import { type AsyncDataHandler, entryOf, startRun, waitedRun } from "../asyncDataRun.ts";
import type { NuxtError } from "../nuxtError.ts";
import { type AsyncDataEntry, type AsyncDataStatus, type NuxtStore, useNuxtStore } from "../nuxtStore.ts";

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

/** What `useAsyncData` takes besides its key and handler. */
export type AsyncDataOptions<TResult> = {
  /** Whether the server waits for it: no effect in a story. */
  readonly server?: boolean;
  /** Whether what awaits it waits for the data; `false` by default. */
  readonly lazy?: boolean;
  /** Whether it runs at once; `true` by default. */
  readonly immediate?: boolean;
  /** The data before the handler returns, and after a failure. */
  readonly default?: () => unknown;
  /** Changes what the handler returned. */
  readonly transform?: (input: TResult) => unknown;
  /** The keys of the result kept; all by default. */
  readonly pick?: readonly string[];
  /** What runs the handler again when it changes; `false` follows nothing, a key that is a ref included. */
  readonly watch?: readonly WatchSource[] | false;
  /** Whether a second call waits for the first (`"defer"`) or starts over (`"cancel"`): no effect in a story. */
  readonly dedupe?: "cancel" | "defer";
  /** Whether the data is deep reactive: no effect in a story. */
  readonly deep?: boolean;
};

/** A key: a text, or a ref whose value is the key of the moment. */
export type AsyncDataKey = string | Readonly<Ref<string>>;

/** A call of `useAsyncData`, read: its key, its handler and its options. */
type AsyncDataCall = {
  /** The key. */
  readonly key: AsyncDataKey;
  /** What fetches the data. */
  readonly handler: AsyncDataHandler<unknown> | undefined;
  /** Its options. */
  readonly options: AsyncDataOptions<unknown>;
};

/**
 * A call read as Nuxt reads it: `(key, handler, options)`, or `(handler, options)` under the key the plugin wrote last
 * for its place in the code, or a key of its own.
 *
 * @param store - the story's store, for a key of its own.
 * @param first - the key, or the handler.
 * @param second - the handler, the options, or the plugin's key.
 * @param third - the options, or the plugin's key.
 */
const readCall = (
  store: NuxtStore,
  first: AsyncDataKey | AsyncDataHandler<unknown>,
  second: AsyncDataHandler<unknown> | AsyncDataOptions<unknown> | string | undefined,
  third: AsyncDataOptions<unknown> | string | undefined
): AsyncDataCall => {
  if (typeof first !== "function")
    return {
      key: first,
      handler: typeof second === "function" ? second : undefined,
      options: typeof third === "object" ? third : {}
    };
  const placeKey = typeof second === "string" ? second : third;
  return {
    key: typeof placeKey === "string" ? placeKey : store.nextKey("data"),
    handler: first,
    options: typeof second === "object" ? second : {}
  };
};

/**
 * Fetches data once for a key, shared by every call with the key: the story's data for it when the story gives some,
 * else what the handler returns.
 *
 * @param key - the key, or a ref whose value is the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export function useAsyncData<TResult>(
  key: AsyncDataKey,
  handler: AsyncDataHandler<TResult>,
  options?: AsyncDataOptions<TResult>
): AsyncData<TResult> & Promise<AsyncData<TResult>>;
/**
 * Fetches data, under the key of its place in the code.
 *
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export function useAsyncData<TResult>(
  handler: AsyncDataHandler<TResult>,
  options?: AsyncDataOptions<TResult>
): AsyncData<TResult> & Promise<AsyncData<TResult>>;
export function useAsyncData(
  first: AsyncDataKey | AsyncDataHandler<unknown>,
  second?: AsyncDataHandler<unknown> | AsyncDataOptions<unknown> | string,
  third?: AsyncDataOptions<unknown> | string
): AsyncData<unknown> & Promise<AsyncData<unknown>> {
  const store = useNuxtStore();
  const { key, handler, options } = readCall(store, first, second, third);
  const keyNow = (): string => (isRef(key) ? key.value : key);
  const entryNow = (): AsyncDataEntry => entryOf(store, keyNow(), () => options.default?.());
  const start = (): Promise<void> => startRun(store, entryNow(), keyNow(), handler, options);
  const firstEntry = entryNow();
  firstEntry.refresh ??= start;
  const started = options.immediate === false ? Promise.resolve() : waitedRun(firstEntry, start);
  const sources: WatchSource[] =
    options.watch === false ? [] : [...(options.watch ?? []), ...(isRef(key) ? [key] : [])];
  if (sources.length > 0) {
    const stop = watch(sources, () => {
      void start();
    });
    if (getCurrentScope() !== undefined) onScopeDispose(stop);
  }
  const asyncData: AsyncData<unknown> = {
    data: computed({
      get: (): unknown => entryNow().data.value,
      set: (value: unknown): void => {
        entryNow().data.value = value;
      }
    }),
    pending: computed(() => entryNow().status.value === "pending"),
    status: computed({
      get: (): AsyncDataStatus => entryNow().status.value,
      set: (value: AsyncDataStatus): void => {
        entryNow().status.value = value;
      }
    }),
    error: computed({
      get: (): NuxtError | undefined => entryNow().error.value,
      set: (value: NuxtError | undefined): void => {
        entryNow().error.value = value;
      }
    }),
    refresh: start,
    execute: start,
    clear: (): void => clearEntry(entryNow())
  };
  // a lazy call does not hold what awaits it, as Nuxt's lazy fetch does not hold navigation
  const awaited = options.lazy === true ? Promise.resolve() : started;
  return Object.assign(
    awaited.then(() => asyncData),
    asyncData
  );
}

/**
 * `useAsyncData` that does not hold what awaits it.
 *
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - its options.
 */
export const useLazyAsyncData = <TResult>(
  key: AsyncDataKey,
  handler: AsyncDataHandler<TResult>,
  options: AsyncDataOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => useAsyncData(key, handler, { ...options, lazy: true });

/**
 * Empties an entry, as before its first run: its data back to its default.
 *
 * @param entry - the entry.
 */
const clearEntry = (entry: AsyncDataEntry): void => {
  entry.runId += 1;
  entry.controller?.abort();
  entry.data.value = entry.defaultData();
  entry.error.value = undefined;
  entry.status.value = "idle";
};

/**
 * The keys a function for every key takes: the ones given, or all.
 *
 * @param store - the story's store.
 * @param keys - a key, keys, or none.
 */
const keysOf = (store: NuxtStore, keys: string | readonly string[] | undefined): readonly string[] => {
  if (keys === undefined) return [...store.asyncData.keys()];
  return typeof keys === "string" ? [keys] : keys;
};

/**
 * Runs the handlers of keys again.
 *
 * @param keys - a key, keys, or none for all.
 */
export const refreshNuxtData = async (keys?: string | readonly string[]): Promise<void> => {
  const store = useNuxtStore();
  await Promise.all(keysOf(store, keys).map((key) => store.asyncData.get(key)?.refresh?.()));
};

/**
 * Empties the data of keys, back to each one's default.
 *
 * @param keys - a key, keys, or none for all.
 */
export const clearNuxtData = (keys?: string | readonly string[]): void => {
  const store = useNuxtStore();
  for (const key of keysOf(store, keys)) {
    const entry = store.asyncData.get(key);
    if (entry !== undefined) clearEntry(entry);
  }
};

/**
 * The data of a key another call fetched.
 *
 * @param key - the key.
 */
export const useNuxtData = (key: string): { readonly data: Ref<unknown> } => {
  const store = useNuxtStore();
  const given = Object.hasOwn(store.storyData, key) ? store.storyData[key] : undefined;
  return { data: entryOf(store, key, () => given).data };
};
