/**
 * The sidebar's sections of the composed catalogues (`refs`), after this catalogue's stories: one per catalogue, shut
 * until opened, its components and their stories read from its index when it first opens.
 *
 * @remarks
 * A composed catalogue's components have no page here (their docs and controls are its own page's), so a component
 * folds open on its stories, each a link to the story shown read-only. The sections keep their own folds, as the tree
 * does: what holds the shown story opens and stays open until the reader shuts it, so opening another page never folds
 * the list under the pointer. The search and the tag filter stay this catalogue's: another's index is fetched only on
 * demand, and searching it would fetch every one at the first key.
 *
 * @module
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { CatalogueRef, RefComponent } from "../catalogueRefs.ts";
import { Icon } from "./icons.tsx";
import { REF_STRINGS } from "./refStrings.ts";
import { PageLink, TreeFold } from "./SidebarEntries.tsx";
import { useRefIndex } from "./useRefIndex.ts";

/** A story of a composed catalogue: the catalogue's id and the story's id in it. */
export type RefStoryPlace = {
  /** The composed catalogue's id. */
  readonly refId: string;
  /** The story's id in it. */
  readonly storyId: string;
};

/** The sections' props. */
export type SidebarRefsProps = {
  /** The composed catalogues, in the configuration's order. */
  readonly refs: readonly CatalogueRef[];
  /** The shown story of a composed catalogue; none on any other page. */
  readonly current: RefStoryPlace | undefined;
  /** The address of a composed catalogue's story here, for its link. */
  readonly refStoryHref: (place: RefStoryPlace) => string;
  /** Shows a composed catalogue's story. */
  readonly onOpenRefStory: (place: RefStoryPlace) => void;
};

/** What every entry reads besides its own: the shown story, the folds and the links. */
type EntryContext = Omit<SidebarRefsProps, "refs"> & {
  /** Whether the reader folded a section or a component open or shut, by its key. */
  readonly folds: ReadonlyMap<string, boolean>;
  /** Folds one open or shut, by its key. */
  readonly onFold: (key: string, isOpen: boolean) => void;
};

/** A component's key among the folds; a section's is its catalogue's id. */
const componentKey = (refId: string, componentId: string): string => `${refId}/${componentId}`;

/**
 * A story's link, scrolled into sight when it is the shown one: a story opened by its address is in the list only once
 * the index arrived, later than the sidebar's own scroll to the shown page.
 *
 * @param props - the link's address, whether it is shown, what opening it does and its name.
 */
const RefStoryEntry = ({
  href,
  isCurrent,
  onOpen,
  name
}: {
  readonly href: string;
  readonly isCurrent: boolean;
  readonly onOpen: () => void;
  readonly name: string;
}): ReactNode => {
  const entryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCurrent) entryRef.current?.scrollIntoView({ block: "nearest" });
  }, [isCurrent]);
  return (
    <div ref={entryRef} className="forgebook-tree__component">
      <PageLink
        href={href}
        className="forgebook-tree__item"
        current={isCurrent ? "page" : undefined}
        onOpen={onOpen}
      >
        <span className="forgebook-tree__item-name">{name}</span>
      </PageLink>
    </div>
  );
};

/**
 * A component of a composed catalogue: a button that folds it, and its stories' links.
 *
 * @param props - the component, its catalogue, the shown story, the folds and the links.
 */
const RefComponentEntry = ({
  composed,
  component,
  current,
  folds,
  onFold,
  refStoryHref,
  onOpenRefStory
}: EntryContext & {
  readonly composed: CatalogueRef;
  readonly component: RefComponent;
}): ReactNode => {
  const key = componentKey(composed.id, component.id);
  const isOpen = folds.get(key) ?? false;
  return (
    <div className="forgebook-tree__group">
      <h3 className="forgebook-tree__group-name">
        <button
          type="button"
          className="forgebook-tree__group-button"
          aria-expanded={isOpen}
          onClick={(): void => onFold(key, !isOpen)}
        >
          <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
            <Icon name="chevronRight" size={12} />
          </span>
          <span className="forgebook-tree__family-name">{component.title.split("/").join(" › ")}</span>
          <span className="forgebook-tree__count">{component.stories.length}</span>
        </button>
      </h3>
      <TreeFold
        isOpen={isOpen}
        isInstant={false}
        content={(): ReactNode =>
          component.stories.map((story) => {
            const place = { refId: composed.id, storyId: story.id };
            return (
              <RefStoryEntry
                key={story.id}
                href={refStoryHref(place)}
                isCurrent={current?.refId === composed.id && current.storyId === story.id}
                onOpen={(): void => onOpenRefStory(place)}
                name={story.name}
              />
            );
          })
        }
      />
    </div>
  );
};

/**
 * What an open section lists: its components once its index is read, or what it is waiting for, or why it failed. The
 * component that holds the shown story opens once the index says which it is.
 *
 * @param props - the section's catalogue and what its entries read.
 */
const RefEntries = ({
  composed,
  ...entries
}: EntryContext & { readonly composed: CatalogueRef }): ReactNode => {
  const state = useRefIndex(composed, true);
  const { current, folds, onFold } = entries;
  const holding =
    state.status === "ready" && current?.refId === composed.id
      ? state.index.components.find((component) =>
          component.stories.some((story) => story.id === current.storyId)
        )
      : undefined;
  const holdingKey = holding === undefined ? undefined : componentKey(composed.id, holding.id);
  useEffect(() => {
    if (holdingKey !== undefined && !folds.has(holdingKey)) onFold(holdingKey, true);
  }, [holdingKey, folds, onFold]);
  if (state.status === "error")
    return <p className="forgebook-tree__empty">{REF_STRINGS.unreadable(composed.title, state.message)}</p>;
  if (state.status !== "ready") return <p className="forgebook-tree__empty">{REF_STRINGS.loading}</p>;
  if (state.index.components.length === 0)
    return <p className="forgebook-tree__empty">{REF_STRINGS.empty}</p>;
  return state.index.components.map((component) => (
    <RefComponentEntry key={component.id} composed={composed} component={component} {...entries} />
  ));
};

/**
 * A composed catalogue's section: its name, which folds it, and its entries, read when it first opens.
 *
 * @param props - the catalogue and what its entries read.
 */
const RefSection = ({
  composed,
  ...entries
}: EntryContext & { readonly composed: CatalogueRef }): ReactNode => {
  const isOpen = entries.folds.get(composed.id) ?? false;
  return (
    <section className="forgebook-tree__source" aria-label={REF_STRINGS.section(composed.title)}>
      <div className="forgebook-tree__family">
        <button
          type="button"
          className="forgebook-tree__family-button"
          aria-expanded={isOpen}
          onClick={(): void => entries.onFold(composed.id, !isOpen)}
        >
          <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
            <Icon name="chevronRight" size={12} />
          </span>
          <span className="forgebook-tree__family-name">{composed.title}</span>
          <Icon name="external" size={10} />
        </button>
        <TreeFold
          isOpen={isOpen}
          isInstant={false}
          content={(): ReactNode => <RefEntries composed={composed} {...entries} />}
        />
      </div>
    </section>
  );
};

/**
 * The composed catalogues' sections. The section of the shown story opens, and stays open until the reader shuts it.
 *
 * @param props - the catalogues, the shown story and the links.
 */
export const SidebarRefs = ({ refs, ...links }: SidebarRefsProps): ReactNode => {
  const [folds, setFolds] = useState<ReadonlyMap<string, boolean>>(new Map());
  // one function for the sections' whole life, so the effect that opens the shown story's component runs only for it
  const [onFold] = useState(
    () =>
      (key: string, isOpen: boolean): void =>
        setFolds((choices) => new Map(choices).set(key, isOpen))
  );
  const currentRef = links.current?.refId;
  useEffect(() => {
    if (currentRef === undefined) return;
    setFolds((choices) => (choices.has(currentRef) ? choices : new Map(choices).set(currentRef, true)));
  }, [currentRef]);
  return refs.map((composed) => (
    <RefSection key={composed.id} composed={composed} folds={folds} onFold={onFold} {...links} />
  ));
};
