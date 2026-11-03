/**
 * Nuxt's `useFetch`, its lazy form and `$fetch` in a catalogue: `useAsyncData` with the story's `$fetch`.
 *
 * @remarks
 * Its key is the request as it is made, so a story can write it: the URL with its query, the method before it when not
 * GET, the body after it when there is one (`/api/products?page=2`, `POST /api/cart {"id":1}`). Nuxt's own key is a
 * hash of the same, which a story could not write. Its URL, query, body and method may be refs or getters: a change
 * makes another key, and another request, as in Nuxt, unless `watch: false`. Without the story's data for the key, the
 * request goes out, and the catalogue's MSW handlers answer it.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */
import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { useNuxtStore } from "../nuxtStore.ts";
import { type FetchQuery, type StoryFetchOptions, withSearch } from "../storyFetch.ts";
import { type AsyncData, type AsyncDataOptions, useAsyncData } from "./data.ts";

/** What `useFetch` takes: the request's options, each of which may follow a ref, and `useAsyncData`'s. */
export type UseFetchOptions<TResult> = AsyncDataOptions<TResult> &
  Pick<StoryFetchOptions, "baseURL" | "responseType"> & {
    /** The key the data is shared and given under; the request as it is made by default. */
    readonly key?: string;
    /** The request's method; GET by default. */
    readonly method?: MaybeRefOrGetter<string>;
    /** The search params, by name; each value may be a ref too. */
    readonly query?: MaybeRefOrGetter<FetchQuery>;
    /** `query`'s other name. */
    readonly params?: MaybeRefOrGetter<FetchQuery>;
    /** The body: an object or an array is sent as JSON. */
    readonly body?: MaybeRefOrGetter<unknown>;
    /** The headers. */
    readonly headers?: MaybeRefOrGetter<HeadersInit>;
  };

/**
 * A query whose values may be refs, read now.
 *
 * @param query - the query, or what gives it.
 */
const queryNow = (query: MaybeRefOrGetter<FetchQuery> | undefined): FetchQuery =>
  Object.fromEntries(Object.entries(toValue(query) ?? {}).map(([name, value]) => [name, toValue(value)]));

/**
 * The key of a request: the URL with its query, the method before it when not GET, the body after it.
 *
 * @param method - the method, in capitals.
 * @param url - the URL.
 * @param query - the search params.
 * @param body - the body, if any.
 */
export const fetchKey = (method: string, url: string, query: FetchQuery, body: unknown): string =>
  `${method === "GET" ? "" : `${method} `}${withSearch(url, query)}${body === undefined ? "" : ` ${JSON.stringify(body)}`}`;

/**
 * Fetches a URL, as `useAsyncData` with `$fetch`: the story's data for its key when it gives some, else the request.
 *
 * @param url - the URL, or a ref or getter that gives it.
 * @param options - the request's options and `useAsyncData`'s.
 */
export const useFetch = <TResult = unknown>(
  url: MaybeRefOrGetter<string>,
  options: UseFetchOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => {
  const store = useNuxtStore();
  const method = (): string => (toValue(options.method) ?? "GET").toUpperCase();
  const query = (): FetchQuery => queryNow(options.query ?? options.params);
  const key = computed(() => options.key ?? fetchKey(method(), toValue(url), query(), toValue(options.body)));
  const headers = toValue(options.headers);
  return useAsyncData<TResult>(
    key,
    (_app, { signal }): Promise<TResult> => {
      const body = toValue(options.body);
      return store.fetch<TResult>(toValue(url), {
        method: method(),
        query: query(),
        signal,
        ...(body === undefined ? {} : { body }),
        ...(headers === undefined ? {} : { headers }),
        ...(options.baseURL === undefined ? {} : { baseURL: options.baseURL }),
        ...(options.responseType === undefined ? {} : { responseType: options.responseType })
      });
    },
    options
  );
};

/**
 * `useFetch` that does not hold what awaits it.
 *
 * @param url - the URL.
 * @param options - its options.
 */
export const useLazyFetch = <TResult = unknown>(
  url: MaybeRefOrGetter<string>,
  options: UseFetchOptions<TResult> = {}
): AsyncData<TResult> & Promise<AsyncData<TResult>> => useFetch<TResult>(url, { ...options, lazy: true });

/**
 * Fetches a URL, as Nuxt's `$fetch` (ofetch), with the app's base path.
 *
 * @param request - the URL.
 * @param options - the request's options.
 */
export const $fetch = <TResult = unknown>(request: string, options?: StoryFetchOptions): Promise<TResult> =>
  useNuxtStore().fetch<TResult>(request, options);
