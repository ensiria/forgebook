/**
 * A post's page: the server component, its slug from the route.
 *
 * @module
 */
import type { ReactNode } from "react";

import { PostPage } from "@/components/PostPage";

/**
 * The page.
 *
 * @param props - the route's params.
 */
const Page = async ({
  params
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<ReactNode> => <PostPage slug={(await params).slug} />;

export default Page;
