/**
 * The post page's load: the post its slug names, fetched from the app's API.
 *
 * @module
 */
import type { PageLoad } from "./$types";

/** A post, as the API answers it. */
export type Post = {
  /** The post's title. */
  readonly title: string;
  /** Its text. */
  readonly body: string;
};

/**
 * Loads the post of the page's slug.
 *
 * @param event - the load's event.
 */
export const load: PageLoad = async ({ params, fetch }) => {
  const response = await fetch(`/api/posts/${params.slug}`);
  const post: Post = await response.json();
  return { post };
};
