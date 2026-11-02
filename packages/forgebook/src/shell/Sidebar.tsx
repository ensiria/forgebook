/**
 * The sidebar: a search field and the tree, by source, family and named group (each folds open and shut, animated; a
 * group starts shut unless it holds the shown component) and component, one line per component that never opens: a
 * component's link opens its page, and its stories are picked in the page's header, so nothing in the list folds under
 * the pointer. A family or a group stays open once opened; a search opens every one it finds something in, and finds a
 * component by its
 * name, its place, its meta's search words or its stories' names and descriptions. A component listed in other places too (`alsoIn`) has an
 * alias entry in each, beside the components that live there, which says where it lives and opens its page. Docs pages
 * come first, in a section of their own (`SidebarDocs.tsx`).
 *
 * @module
 */

import type { StorySource } from "@forgebook/story-format/source";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import type { SearchTarget } from "../search.ts";
import type { StoryTree, TreeFamily, TreeGroup, TreeSource } from "../storyTree.ts";
import { AppearanceMenu } from "./AppearanceMenu.tsx";
import { FORGEBOOK_MARK_URL } from "./forgebookMark.ts";
import { Icon } from "./icons.tsx";
import { SidebarDocs, type SidebarPageLinks } from "./SidebarDocs.tsx";
import { FamilyGroup, type ShownComponent, TreeFold } from "./SidebarEntries.tsx";
import { SidebarSearch } from "./SidebarSearch.tsx";
import { STRINGS } from "./strings.ts";
import type { ShownTree, shownTree } from "./treeSearch.ts";
import type { AppearanceState } from "./useAppearance.ts";

/** The sidebar's props. */
export type SidebarProps = SidebarPageLinks & {
  /** The catalogue's name. */
  readonly title: string;
  /** The catalogue's logo, the URL of a square image; none shows Forgebook's mark, or the name alone without branding. */
  readonly logo: string | undefined;
  /** Whether a catalogue without a logo shows Forgebook's mark. */
  readonly hasBranding: boolean;
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, for the search's index. */
  readonly sources: readonly StorySource[];
  /** The address of a search's result. */
  readonly searchHref: (target: SearchTarget) => string;
  /** Goes to a search's result. */
  readonly onOpenResult: (target: SearchTarget) => void;
  /** Whether the home is shown: the logo, its link, is then the current page. */
  readonly isHome: boolean;
  /** The home's address, for the logo's link. */
  readonly homeHref: string;
  /** Opens the home. */
  readonly onOpenHome: () => void;
  /**
   * The shown component's source and title, to mark it and keep its family open, and the shown story's id; none on the
   * home.
   */
  readonly current: ShownComponent | undefined;
  /** The shown docs page's id; none on any other page. */
  readonly currentPageId: string | undefined;
  /** The address of a component's page, by its title, for its link. */
  readonly componentHref: (sourceId: string, title: string) => string;
  /** Opens a component's page, by its title. */
  readonly onOpenComponent: (sourceId: string, title: string) => void;
  /** The sidebar's width, in CSS px. */
  readonly width: number;
  /** Whether it is shown: hidden, it slides out and stays mounted, so its search and open families come back with it. */
  readonly isOpen: boolean;
  /** Hides the sidebar. */
  readonly onHide: () => void;
  /** Shows it again. */
  readonly onShow: () => void;
  /** The shell's appearance and its setter, for the menu at the foot. */
  readonly appearance: AppearanceState;
};

/** A family's key, unique across sources. */
const familyKey = (source: TreeSource, family: TreeFamily): string => `${source.id}/${family.name}`;

/** A named group's key, unique across sources and families. */
const groupKey = (family: string, group: TreeGroup): string => `${family}/${group.name ?? ""}`;

/**
 * Whether a group holds the shown component.
 *
 * @param sourceId - the group's source.
 * @param group - the group.
 * @param current - the shown component, if one is.
 */
const holdsCurrent = (sourceId: string, group: TreeGroup, current: SidebarProps["current"]): boolean =>
  current?.sourceId === sourceId && group.components.some((component) => component.title === current.title);

/** The key of the family the shown component is in; none when no component is shown. */
const currentFamilyOf = (tree: StoryTree, current: SidebarProps["current"]): string | undefined => {
  if (current === undefined) return undefined;
  const source = tree.sources.find((candidate) => candidate.id === current.sourceId);
  const family = source?.families.find((candidate) =>
    candidate.groups.some((group) => group.components.some((component) => component.title === current.title))
  );
  return source === undefined || family === undefined ? undefined : familyKey(source, family);
};

/** The key of the named group the shown component is in; none when no component is shown or its group is unnamed. */
const currentGroupOf = (tree: StoryTree, current: SidebarProps["current"]): string | undefined => {
  const family = currentFamilyOf(tree, current);
  const source = tree.sources.find((candidate) => candidate.id === current?.sourceId);
  const group = source?.families
    .flatMap((each) => each.groups)
    .find((candidate) => candidate.name !== undefined && holdsCurrent(source.id, candidate, current));
  return family === undefined || group === undefined ? undefined : groupKey(family, group);
};

/** The tree as it is, with no search on. */
const wholeTree = (tree: StoryTree): ShownTree => ({
  sources: tree.sources.map((source) => ({ source, families: source.families })),
  pages: tree.sources
    .filter(({ pages }) => pages.length > 0)
    .map((source) => ({ source, pages: source.pages }))
});

/** How many components a family holds. */
const componentCount = (family: TreeFamily): number =>
  family.groups.reduce((count, group) => count + group.components.length, 0);

/**
 * The sidebar.
 *
 * @param props - the tree, the shown component and how to open one.
 */
export const Sidebar = ({
  title,
  logo,
  hasBranding,
  tree,
  sources: storySources,
  searchHref,
  onOpenResult,
  isHome,
  homeHref,
  onOpenHome,
  current,
  currentPageId,
  pageHref,
  onOpenPage,
  width,
  isOpen,
  onHide,
  onShow,
  appearance,
  ...links
}: SidebarProps): ReactNode => {
  const [query, setQuery] = useState("");
  const mark = logo ?? (hasBranding ? FORGEBOOK_MARK_URL : undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filterTree, setFilterTree] = useState<typeof shownTree>();
  const showFiltered = useCallback((filter: typeof shownTree): void => setFilterTree(() => filter), []);
  const navRef = useRef<HTMLElement>(null);
  // the shown component stays in sight: a page opened by a key, the picker or the address scrolls the list to it
  const currentEntry = currentPageId ?? current?.title;
  useEffect(() => {
    if (currentEntry === undefined) return;
    navRef.current
      ?.querySelector(".forgebook-tree__item[aria-current]")
      ?.scrollIntoView({ block: "nearest" });
  }, [currentEntry]);
  // the families and groups the user opened or closed, and the ones a shown component opened: once open, one stays
  // open until the user closes it, so opening a component elsewhere never folds the list under the pointer
  const [foldChoices, setFoldChoices] = useState<ReadonlyMap<string, boolean>>(new Map());
  const currentFamilyKey = currentFamilyOf(tree, current);
  const currentGroupKey = currentGroupOf(tree, current);
  useEffect(() => {
    const opened = [currentFamilyKey, currentGroupKey].filter((key): key is string => key !== undefined);
    setFoldChoices((choices) =>
      opened.every((key) => choices.has(key))
        ? choices
        : new Map([
            ...choices,
            ...opened.filter((key) => !choices.has(key)).map((key): [string, boolean] => [key, true])
          ])
    );
  }, [currentFamilyKey, currentGroupKey]);
  const isSearching = query.trim() !== "";
  const isCurrentFamily = (source: TreeSource, family: TreeFamily): boolean =>
    current?.sourceId === source.id &&
    family.groups.some((group) => group.components.some((component) => component.title === current.title));
  const setFoldOpen = (key: string, isOpen: boolean): void =>
    setFoldChoices((choices) => new Map(choices).set(key, isOpen));

  // the filter comes with the search's list; a moment before it, or with no words, the tree shows whole
  const { sources, pages } =
    isSearching && filterTree !== undefined ? filterTree(tree, query) : wholeTree(tree);
  const hasMatches = pages.length > 0 || sources.some(({ families }) => families.length > 0);

  return (
    // hidden, it slides out by its own width (a margin, so a drag of its handle never waits for a transition) and
    // leaves Tab and screen readers
    <aside
      className="forgebook-sidebar"
      data-open={isOpen ? "" : undefined}
      inert={!isOpen}
      style={{ width, marginInlineStart: isOpen ? 0 : -width }}
    >
      <div className="forgebook-brand">
        {/* the logo is the way home, as on most sites */}
        <a
          className="forgebook-brand__home"
          href={homeHref}
          aria-current={isHome ? "page" : undefined}
          title={STRINGS.home}
          onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onOpenHome();
          }}
        >
          {/* decorative: the name beside it says what it is */}
          {mark === undefined ? null : (
            <img className="forgebook-brand__logo" src={mark} alt="" width={28} height={28} />
          )}
          <span className="forgebook-brand__name">{title}</span>
        </a>
        <button
          type="button"
          className="forgebook-icon-button forgebook-brand__hide"
          title={STRINGS.hideSidebar}
          aria-label={STRINGS.hideSidebar}
          onClick={onHide}
        >
          <Icon name="sidebar" size={14} />
        </button>
      </div>
      <SidebarSearch
        query={query}
        onQueryChange={setQuery}
        onFilterReady={showFiltered}
        tree={tree}
        sources={storySources}
        sidebarWidth={width}
        isSidebarOpen={isOpen}
        onShowSidebar={onShow}
        searchHref={searchHref}
        onOpenResult={onOpenResult}
      />
      <nav ref={navRef} className="forgebook-tree" aria-label={STRINGS.componentsNav}>
        {hasMatches ? null : <p className="forgebook-tree__empty">{STRINGS.noMatch}</p>}
        <SidebarDocs
          sources={pages}
          currentPageId={currentPageId}
          isSearching={isSearching}
          foldChoices={foldChoices}
          onFoldChange={setFoldOpen}
          pageHref={pageHref}
          onOpenPage={onOpenPage}
        />
        {sources.map(({ source, families }) =>
          families.length === 0 ? null : (
            <section key={source.id} className="forgebook-tree__source">
              <h2 className="forgebook-tree__source-name">
                {/* decorative: the name beside it says which library it is */}
                {source.logo === undefined ? null : (
                  <img className="forgebook-source-logo" src={source.logo} alt="" width={14} height={14} />
                )}
                {source.name}
              </h2>
              {families.map((family) => {
                const key = familyKey(source, family);
                // a search opens every family it finds something in
                const isOpen = isSearching || (foldChoices.get(key) ?? isCurrentFamily(source, family));
                return (
                  <div key={key} className="forgebook-tree__family">
                    <button
                      type="button"
                      className="forgebook-tree__family-button"
                      aria-expanded={isOpen}
                      onClick={(): void => setFoldOpen(key, !isOpen)}
                    >
                      <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
                        <Icon name="chevronRight" size={12} />
                      </span>
                      <span className="forgebook-tree__family-name">{family.name}</span>
                      <span className="forgebook-tree__count">{componentCount(family)}</span>
                    </button>
                    <TreeFold
                      isOpen={isOpen}
                      isInstant={isSearching}
                      content={(): ReactNode =>
                        family.groups.map((group) => {
                          const key = groupKey(familyKey(source, family), group);
                          // shut by default; a search opens every group it finds something in
                          const isGroupOpen =
                            isSearching || (foldChoices.get(key) ?? holdsCurrent(source.id, group, current));
                          return (
                            <FamilyGroup
                              key={group.name ?? ""}
                              sourceId={source.id}
                              group={group}
                              isOpen={isGroupOpen}
                              isInstant={isSearching}
                              onToggle={(): void => setFoldOpen(key, !isGroupOpen)}
                              current={current}
                              links={links}
                            />
                          );
                        })
                      }
                    />
                  </div>
                );
              })}
            </section>
          )
        )}
      </nav>
      <AppearanceMenu {...appearance} />
    </aside>
  );
};
