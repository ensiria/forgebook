/**
 * The blog's posts, as the app's server reads them: invented, kept in memory, read asynchronously as a database is.
 *
 * @module
 */

/** A post. */
export type Post = {
  /** Its address's last segment. */
  readonly slug: string;
  /** Its title. */
  readonly title: string;
  /** Its first paragraph. */
  readonly summary: string;
};

/** The posts. */
const POSTS: readonly Post[] = [
  {
    slug: "first-light",
    title: "First light on the pier",
    summary: "The boats leave before the cafés open."
  },
  {
    slug: "tide-tables",
    title: "Reading the tide tables",
    summary: "Two high tides a day, never at the same hour."
  }
];

/**
 * A post by its slug.
 *
 * @param slug - its slug.
 * @returns the post, or none.
 */
export const findPost = async (slug: string): Promise<Post | undefined> =>
  POSTS.find((post) => post.slug === slug);

/** Every post. */
export const allPosts = async (): Promise<readonly Post[]> => POSTS;
