/**
 * What a play function reads of a Next.js story's router: where its links and router calls took it, and the calls it
 * made (`router.push`, `cache.revalidatePath`), to assert on.
 *
 * @example
 * ```ts
 * import { storyRoute } from "@forgebook/nextjs/route";
 *
 * export const GoesToAbout: Story<typeof Nav> = {
 *   play: async ({ canvasElement }) => {
 *     await userEvent.click(within(canvasElement).getByRole("link", { name: "About" }));
 *     expect(storyRoute().pathname).toBe("/about");
 *   }
 * };
 * ```
 *
 * @module
 */
import { type StoryRoute, valuesOfSearch } from "./route.ts";
import { currentStore } from "./routeStore.ts";
import type { RouteValues } from "./stories.ts";

/** A call a story made to Next.js: its function (`router.push`) and its href or arguments. */
export type NextCall = {
  /** The function, as the catalogue lists it (`router.push`, `cache.revalidatePath`). */
  readonly name: string;
  /** What it was called with. */
  readonly values: readonly unknown[];
};

/** A story's route as a play function reads it. */
export type StoryRouteState = Pick<StoryRoute, "pathname" | "hash" | "params"> & {
  /** The search params, by name. */
  readonly query: RouteValues;
  /** The calls the story made to Next.js, in order. */
  readonly calls: readonly NextCall[];
};

/** The route of the story drawn now, and the calls it made. */
export const storyRoute = (): StoryRouteState => {
  const store = currentStore();
  const route = store.route();
  return {
    pathname: route.pathname,
    hash: route.hash,
    params: route.params,
    query: valuesOfSearch(route.search),
    calls: store.calls()
  };
};
