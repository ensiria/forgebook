/**
 * What a story's tags draw, as one chunk loaded the first time one of them is drawn (`tagView.tsx`): the tag filter and
 * the statuses' badges, which share their reading of the catalogue's statuses.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { TreeComponent, TreeStory } from "../storyTree.ts";
import { ComponentBadges, StatusBadges } from "./StatusBadges.tsx";
import { TagFilter, type TagFilterProps } from "./TagFilter.tsx";

/** One place the tags draw in, and what it reads. */
export type TagViewProps =
  | ({
      /** The sidebar's tag filter. */
      readonly place: "filter";
    } & TagFilterProps)
  | {
      /** A component's entry in the sidebar: its meta's statuses. */
      readonly place: "entry";
      /** The component. */
      readonly component: TreeComponent;
    }
  | {
      /** The top of a component's page: its meta's statuses, and `deprecated` when its TSDoc says so. */
      readonly place: "page";
      /** The component. */
      readonly component: TreeComponent;
      /** Loads its docs; none when the source has none for its file. */
      readonly loadDocs: (() => Promise<unknown>) | undefined;
    }
  | {
      /** A story's example on its component's page: the statuses it holds that its component's meta does not. */
      readonly place: "story";
      /** The story. */
      readonly story: TreeStory;
      /** Its component. */
      readonly component: TreeComponent;
    };

/**
 * What the tags draw in a place.
 *
 * @param props - the place, and what it reads.
 */
export const TagView = (props: TagViewProps): ReactNode => {
  switch (props.place) {
    case "filter":
      return <TagFilter tree={props.tree} tags={props.tags} onTagsChange={props.onTagsChange} />;
    case "entry":
      return <StatusBadges tags={props.component.tags} className="forgebook-status-badges" />;
    case "page":
      return <ComponentBadges component={props.component} loadDocs={props.loadDocs} />;
    case "story":
      return (
        <StatusBadges
          tags={props.story.tags.filter((tag) => !props.component.tags.includes(tag))}
          className="forgebook-status-badges forgebook-status-badges--story"
        />
      );
  }
};
