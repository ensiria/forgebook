/**
 * What a story's tags draw on a component's page (its status, a story's own), loaded from the page's own chunk with the
 * same module as the sidebar's (`TagViews.tsx`).
 *
 * @remarks
 * Kept apart from `tagView.tsx`, which the first load carries: imported by the pages that load later too, that module
 * would be split out of the first load's chunk into one of its own, a request and some bytes more on every first load.
 *
 * @module
 */
import type { ReactNode } from "react";

import { LazyView, lazyModule } from "./lazyModule.tsx";
import type { TagViewProps } from "./TagViews.tsx";

/** What the tags draw on the page, loaded on first use. */
const PAGE_TAG_VIEW = lazyModule<TagViewProps>(() =>
  import("./TagViews.tsx").then((module) => module.TagView)
);

/**
 * What the tags draw in one place of a component's page, once its code is there.
 *
 * @param props - the place, and what it reads.
 */
export const PageTagView = (props: TagViewProps): ReactNode => (
  <LazyView module={PAGE_TAG_VIEW} props={props} loading={null} failed={(): ReactNode => null} />
);
