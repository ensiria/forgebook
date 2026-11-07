/**
 * The sidebar's tag filter: a button beside the search, with how many tags are on, which opens the catalogue's tags to
 * ask for or to leave out. Loaded only for a catalogue whose stories have tags.
 *
 * @module
 */
import { type ChangeEvent, type MouseEvent, type ReactNode, useMemo } from "react";

import { catalogueTags } from "../storyTags.ts";
import type { StoryTree } from "../storyTree.ts";
import "./tagFilter.scss";
import { textsOfGroup } from "./strings.ts";
import { usePopover } from "./usePopover.ts";

/** The filter's texts, as shown: Forgebook's, with the catalogue's replacements. */
const TAG_STRINGS = textsOfGroup("tagFilter", {
  button: "Filter by tag",
  buttonOn: (count: number): string => `Filter by tag: ${count} on`,
  title: "Tags",
  leaveOut: (tag: string): string => `Leave out ${tag}`,
  clear: "Clear the filter"
});

/** The filter's props. */
export type TagFilterProps = {
  /** The whole tree, whose tags it offers. */
  readonly tree: StoryTree;
  /** The tags on, each `name` or `!name`. */
  readonly tags: readonly string[];
  /** Called with the tags on, when they change. */
  readonly onTagsChange: (tags: readonly string[]) => void;
};

/**
 * The tag filter.
 *
 * @param props - the tree, the tags on and how to change them.
 */
export const TagFilter = ({ tree, tags, onTagsChange }: TagFilterProps): ReactNode => {
  const { isOpen, isDrawn, setIsOpen, buttonRef, panelRef, panelId } = usePopover();
  const offered = useMemo(() => catalogueTags(tree), [tree]);
  const set = (tag: string, written: string | undefined): void =>
    onTagsChange([
      ...tags.filter((each) => each !== tag && each !== `!${tag}`),
      ...(written === undefined ? [] : [written])
    ]);
  const label = tags.length === 0 ? TAG_STRINGS.button : TAG_STRINGS.buttonOn(tags.length);
  return (
    <div className="forgebook-tag-filter">
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-icon-button"
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-on={tags.length > 0 ? "" : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => setIsOpen(!isOpen, event)}
      >
        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
          <path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {tags.length === 0 ? null : <span className="forgebook-tag-filter__count">{tags.length}</span>}
      </button>
      {isDrawn ? (
        <div
          ref={panelRef}
          id={panelId}
          className="forgebook-popover forgebook-tag-filter__panel"
          role="dialog"
          aria-label={TAG_STRINGS.title}
        >
          <ul className="forgebook-tag-filter__list">
            {offered.map(({ tag, stories }) => (
              <li key={tag} className="forgebook-tag-filter__row">
                <label className="forgebook-tag-filter__tag">
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                      set(tag, event.target.checked ? tag : undefined)
                    }
                  />
                  <span className="forgebook-tag-filter__name">{tag}</span>
                  <span className="forgebook-tree__count">{stories}</span>
                </label>
                <button
                  type="button"
                  className="forgebook-icon-button"
                  title={TAG_STRINGS.leaveOut(tag)}
                  aria-label={TAG_STRINGS.leaveOut(tag)}
                  aria-pressed={tags.includes(`!${tag}`)}
                  onClick={(): void => set(tag, tags.includes(`!${tag}`) ? undefined : `!${tag}`)}
                >
                  <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true">
                    <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m4 12 8-8" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="forgebook-button forgebook-button--quiet"
            disabled={tags.length === 0}
            onClick={(): void => onTagsChange([])}
          >
            {TAG_STRINGS.clear}
          </button>
        </div>
      ) : null}
    </div>
  );
};
