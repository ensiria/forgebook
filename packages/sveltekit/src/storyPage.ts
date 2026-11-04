/**
 * What a play function reads of a SvelteKit story's page: where its links and `goto` calls took it, its data and form,
 * and the calls it made (`goto`, `invalidateAll`, `enhance`), to assert on.
 *
 * @example
 * ```ts
 * import { storyPage } from "@forgebook/sveltekit/page";
 *
 * export const GoesToAbout: Story<typeof Nav> = {
 *   play: async ({ canvasElement }) => {
 *     await userEvent.click(within(canvasElement).getByRole("link", { name: "About" }));
 *     expect(storyPage().pathname).toBe("/about");
 *   }
 * };
 * ```
 *
 * @module
 */
import type { KitPage } from "./kitParameters.ts";
import { currentStore, type KitCall } from "./kitStore.ts";

/** A story's page as a play function reads it. */
export type StoryPageState = Pick<KitPage, "params" | "data" | "form" | "state" | "status" | "error"> & {
  /** The page's path, its base path included (`/blog/hello`). */
  readonly pathname: string;
  /** The search params, by name: the last value of a name given twice. */
  readonly query: Readonly<Record<string, string>>;
  /** The hash, with its `#`, or empty. */
  readonly hash: string;
  /** The route's id, or `null` when no route of the project matches. */
  readonly routeId: string | null;
  /** The calls the story made to SvelteKit, in order. */
  readonly calls: readonly KitCall[];
};

/** The page of the story drawn now, and the calls it made. */
export const storyPage = (): StoryPageState => {
  const store = currentStore();
  const page = store.page();
  return {
    pathname: page.url.pathname,
    query: Object.fromEntries(page.url.searchParams),
    hash: page.url.hash,
    routeId: page.route.id,
    params: page.params,
    data: page.data,
    form: page.form,
    state: page.state,
    status: page.status,
    error: page.error,
    calls: store.calls()
  };
};
