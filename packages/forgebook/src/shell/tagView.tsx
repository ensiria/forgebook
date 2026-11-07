/**
 * Where a story's tags draw something: the sidebar's tag filter, a status's badges in a component's entry and beside a
 * page's title. Their code and styles load the first time one is drawn, which only a catalogue whose stories have tags
 * does (`TagViews.tsx`).
 *
 * @remarks
 * A status is a tag (`storyStatuses.ts`), so a catalogue with no tags has neither filter nor badges, and its first
 * load carries these few lines and not their code. Until it arrives nothing is drawn: each comes last on its row, so
 * nothing beside it moves. A chunk gone after a new deployment leaves them out.
 *
 * @module
 */
import type { ReactNode } from "react";

import { LazyView, lazyModule } from "./lazyModule.tsx";
import type { TagViewProps } from "./TagViews.tsx";

/** What the tags draw, loaded on first use; not through `Suspense`, which would hold it back 300 ms (`lazyModule.tsx`). */
const TAG_VIEW = lazyModule<TagViewProps>(() => import("./TagViews.tsx").then((module) => module.TagView));

/**
 * What the tags draw in one place, once its code is there.
 *
 * @param props - the place, and what it reads.
 */
export const TagViewSlot = (props: TagViewProps): ReactNode => (
  <LazyView module={TAG_VIEW} props={props} loading={null} failed={(): ReactNode => null} />
);
