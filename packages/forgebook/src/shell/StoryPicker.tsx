/**
 * The picker of a component's stories in its pages' header: All (the component's page), then every story, under its
 * group, in one select, so the header keeps one line however many stories the component has.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId } from "react";

import { groupLabel } from "../catalogue.ts";
import { groupedStories, type TreeComponent, type TreeStory } from "../storyTree.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { STRINGS } from "./strings.ts";

/** The picker's props. */
export type StoryPickerProps = {
  /** The component. */
  readonly component: TreeComponent;
  /** The shown story's id; none on the component's page. */
  readonly currentStoryId: string | undefined;
  /** Opens the component's page. */
  readonly onOpenComponent: () => void;
  /** Opens a story's page. */
  readonly onOpenStory: (story: TreeStory) => void;
  /** What sits beside the select, at the header's end: the page width's button. */
  readonly children?: ReactNode;
};

/** The value of the option that opens the component's page: no story id is empty. */
const ALL = "";

/**
 * The picker of a component's stories.
 *
 * @param props - the component, the shown story, how to open a page, and what sits beside the select.
 */
export const StoryPicker = ({
  component,
  currentStoryId,
  onOpenComponent,
  onOpenStory,
  children
}: StoryPickerProps): ReactNode => {
  const id = useId();
  const { storyGroups } = useCatalogue();
  const sections = groupedStories(
    component.stories,
    storyGroups.map((group) => group.id)
  );
  return (
    <div className="forgebook-picker">
      <label className="forgebook-popover__label" htmlFor={id}>
        {STRINGS.storiesNav}
      </label>
      <select
        id={id}
        className="forgebook-select forgebook-picker__select"
        value={currentStoryId ?? ALL}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
          const chosen = component.stories.find((story) => story.id === event.currentTarget.value);
          if (chosen === undefined) onOpenComponent();
          else onOpenStory(chosen);
        }}
      >
        <option value={ALL}>{STRINGS.allStories(component.stories.length)}</option>
        {sections.map((section) =>
          section.group === undefined ? (
            section.stories.map((story) => (
              <option key={story.id} value={story.id}>
                {story.name}
              </option>
            ))
          ) : (
            <optgroup key={section.group} label={groupLabel(storyGroups, section.group)}>
              {section.stories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.name}
                </option>
              ))}
            </optgroup>
          )
        )}
      </select>
      {children}
    </div>
  );
};
