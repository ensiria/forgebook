/**
 * A post's page: a server component that reads the post from the server's data and the reader's cookie.
 *
 * @module
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "server-only";

import { findPost } from "@/lib/posts";

/** The page's props. */
export type PostPageProps = {
  /** The post's slug. */
  readonly slug: string;
};

/**
 * The page.
 *
 * @param props - the post's slug.
 */
export const PostPage = async ({ slug }: PostPageProps): Promise<ReactNode> => {
  const post = await findPost(slug);
  if (post === undefined) notFound();
  const reader = (await cookies()).get("reader")?.value;
  return (
    <article className="space-y-2">
      <h1 className="text-2xl font-semibold">{post.title}</h1>
      <p>{post.summary}</p>
      <p className="font-mono text-sm text-slate-500">
        {reader === undefined ? "Welcome, reader" : `Welcome back, ${reader}`}
      </p>
    </article>
  );
};
