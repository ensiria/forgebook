/**
 * The latest post: a server component that fetches it from the blog's API, as a server component does, by its full
 * address and with Next.js's fetch options.
 *
 * @module
 */
import type { ReactNode } from "react";

/** What the blog's API answers. */
type LatestPostAnswer = {
  /** The post's title. */
  readonly title: string;
};

/** Whether a value is the blog's answer. */
const isAnswer = (value: unknown): value is LatestPostAnswer =>
  typeof value === "object" && value !== null && "title" in value && typeof value.title === "string";

/** The latest post's title and where it came from. */
export const LatestPost = async (): Promise<ReactNode> => {
  const answer = await fetch("https://api.harbour.example/posts/latest", { next: { revalidate: 60 } });
  const post: unknown = await answer.json();
  return <h2 className="text-xl font-semibold">{isAnswer(post) ? post.title : "No post yet"}</h2>;
};
