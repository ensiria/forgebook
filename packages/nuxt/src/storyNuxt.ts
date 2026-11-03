/**
 * What a play function reads of a Nuxt story: where its links and router calls took it, the calls it made
 * (`router.push`, `navigateTo`), and its state, cookies and data, to assert on.
 *
 * @example
 * ```ts
 * import { storyNuxt } from "@forgebook/nuxt/story";
 *
 * export const GoesToAbout: Story<typeof Nav> = {
 *   play: async ({ canvasElement }) => {
 *     await userEvent.click(within(canvasElement).getByRole("link", { name: "About" }));
 *     await waitFor(() => expect(storyNuxt().route.path).toBe("/about"));
 *   }
 * };
 * ```
 *
 * @module
 */
import type { LocationQuery, RouteParamsGeneric } from "vue-router";

import { ANY_PATH_NAME, currentStore, type NuxtCall } from "./nuxtStore.ts";

/** A Nuxt story's route and what it made, as a play function reads them. */
export type StoryNuxtState = {
  /** Where the story is. */
  readonly route: {
    /** The path (`/blog/hello`). */
    readonly path: string;
    /** The path with its search and hash. */
    readonly fullPath: string;
    /** The route's name (`blog-slug`), or none for a path no page has. */
    readonly name: string | undefined;
    /** The route's params. */
    readonly params: RouteParamsGeneric;
    /** The search params. */
    readonly query: LocationQuery;
    /** The hash, with its `#`, or empty. */
    readonly hash: string;
  };
  /** The calls the story made to Nuxt, in order. */
  readonly calls: readonly NuxtCall[];
  /** The values of `useState`, by key. */
  readonly state: Readonly<Record<string, unknown>>;
  /** The values of `useCookie`, by name. */
  readonly cookies: Readonly<Record<string, unknown>>;
  /** The data of `useAsyncData` and `useFetch`, by key. */
  readonly data: Readonly<Record<string, unknown>>;
};

/**
 * The values of refs, by key.
 *
 * @param refs - the refs.
 */
const valuesOf = (
  refs: ReadonlyMap<string, { readonly value: unknown }>
): Readonly<Record<string, unknown>> => Object.fromEntries([...refs].map(([key, ref]) => [key, ref.value]));

/** The route of the story drawn now, and what it made. */
export const storyNuxt = (): StoryNuxtState => {
  const store = currentStore();
  const route = store.router.currentRoute.value;
  return {
    route: {
      path: route.path,
      fullPath: route.fullPath,
      name: typeof route.name === "string" && route.name !== ANY_PATH_NAME ? route.name : undefined,
      params: route.params,
      query: route.query,
      hash: route.hash
    },
    calls: store.calls(),
    state: valuesOf(store.state),
    cookies: valuesOf(store.cookies),
    data: Object.fromEntries([...store.asyncData].map(([key, entry]) => [key, entry.data.value]))
  };
};
