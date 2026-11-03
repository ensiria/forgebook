/**
 * The runs of `useAsyncData`'s keys: the entry a key's calls share, and a run of its handler that a later run
 * replaces.
 *
 * @remarks
 * Runs of one key can overlap (a refresh while the first is under way, a watched value that changes twice): each run
 * gets a number and its own `AbortController`, a new run aborts the one before, and a run that is no longer the latest
 * drops what it got, so the data on screen is always the latest run's.
 *
 * @module
 */
import { ref } from "vue";

import { createError } from "./nuxtError.ts";
import type { AsyncDataEntry, NuxtAppStandIn, NuxtStore } from "./nuxtStore.ts";

/** The handler of `useAsyncData`: what fetches the data. */
export type AsyncDataHandler<TResult> = (
  nuxtApp: NuxtAppStandIn,
  context: { readonly signal: AbortSignal }
) => Promise<TResult> | TResult;

/** What a run does with what the handler returned. */
export type RunOptions = {
  /** The data before the handler returns, and after a failure. */
  readonly default?: () => unknown;
  /** Changes what the handler returned. */
  readonly transform?: (input: unknown) => unknown;
  /** The keys of the result kept; all by default. */
  readonly pick?: readonly string[];
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
    : Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));

/**
 * The entry of a key: the one a call made before, or a new one.
 *
 * @param store - the story's store.
 * @param key - the key.
 * @param defaultData - the data a new entry starts with.
 */
export const entryOf = (store: NuxtStore, key: string, defaultData: () => unknown): AsyncDataEntry => {
  const known = store.asyncData.get(key);
  if (known !== undefined) return known;
  const entry: AsyncDataEntry = {
    data: ref(defaultData()),
    status: ref("idle"),
    error: ref(undefined),
    defaultData,
    running: undefined,
    runId: 0,
    controller: undefined,
    refresh: undefined
  };
  store.asyncData.set(key, entry);
  return entry;
};

/**
 * What a handler returned, changed as the options say.
 *
 * @param result - what it returned.
 * @param options - its `transform` and `pick`.
 */
const shaped = async (result: unknown, options: RunOptions): Promise<unknown> => {
  const transformed: unknown = options.transform === undefined ? result : await options.transform(result);
  return picked(transformed, options.pick);
};

/**
 * Runs a key's handler, or gives it the story's data: what it returned, transformed and picked, or the error it threw.
 * A run that a later one replaced keeps nothing.
 *
 * @param store - the story's store, the call's own: a refresh from an event handler has no component to find it.
 * @param entry - the key's entry.
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - what is done with the result.
 */
const runHandler = async (
  store: NuxtStore,
  entry: AsyncDataEntry,
  key: string,
  handler: AsyncDataHandler<unknown> | undefined,
  options: RunOptions
): Promise<void> => {
  entry.runId += 1;
  const id = entry.runId;
  entry.controller?.abort();
  const controller = new AbortController();
  entry.controller = controller;
  if (Object.hasOwn(store.storyData, key)) {
    entry.data.value = store.storyData[key];
    entry.error.value = undefined;
    entry.status.value = "success";
    return;
  }
  if (handler === undefined || store.isServer) return;
  entry.status.value = "pending";
  try {
    const result = await shaped(await handler(store.nuxtApp, { signal: controller.signal }), options);
    if (entry.runId !== id) return;
    entry.data.value = result;
    entry.error.value = undefined;
    entry.status.value = "success";
  } catch (error) {
    if (entry.runId !== id) return;
    entry.data.value = options.default?.() ?? entry.defaultData();
    entry.error.value = createError(error);
    entry.status.value = "error";
  }
};

/**
 * Starts a run of a key's handler, and keeps it as the run under way until it ends.
 *
 * @param store - the story's store.
 * @param entry - the key's entry.
 * @param key - the key.
 * @param handler - what fetches the data.
 * @param options - what is done with the result.
 */
export const startRun = (
  store: NuxtStore,
  entry: AsyncDataEntry,
  key: string,
  handler: AsyncDataHandler<unknown> | undefined,
  options: RunOptions
): Promise<void> => {
  const running: Promise<void> = runHandler(store, entry, key, handler, options).finally(() => {
    // only the latest run clears it: an older one ending must not say nothing runs
    if (entry.running === running) entry.running = undefined;
  });
  entry.running = running;
  return running;
};

/**
 * The run a call waits for: the one under way for its key, a new one when the key has not run or failed, else none.
 *
 * @param entry - the key's entry.
 * @param start - what starts a run.
 */
export const waitedRun = (entry: AsyncDataEntry, start: () => Promise<void>): Promise<void> => {
  if (entry.running !== undefined) return entry.running;
  return entry.status.value === "idle" || entry.status.value === "error" ? start() : Promise.resolve();
};
