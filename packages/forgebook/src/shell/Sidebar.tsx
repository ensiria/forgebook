/**
 * The sidebar: a search field and the tree, by source, family and named group (each folds open and shut, animated; a
 * group starts shut unless it holds the shown component) and component, one line per component that never opens: a
 * component's link opens its page, and its stories are picked in the page's header, so nothing in the list folds under
 * the pointer. A family or a group stays open once opened; a search opens every one it finds something in, and finds a
 * component by its
 * name, its place, its meta's search words or its stories' names and descriptions. A component listed in other places too (`alsoIn`) has an
 * alias entry in each, beside the components that live there, which says where it lives and opens its page. Docs pages
 * come first, in a section of their own (`SidebarDocs.tsx`); other catalogues composed with `refs` come last
 * (`SidebarRefs.tsx`).
 *
 * @module
 */

import type { StorySource } from "@forgebook/story-format/source";
import {
  type MouseEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { SearchTarget } from "../search.ts";
import { hasFilterTags } from "../storyTagNames.ts";
import type { StoryTree, TreeFamily, TreeGroup, TreeSource } from "../storyTree.ts";
import { AppearanceMenu } from "./AppearanceMenu.tsx";
import { HAS_REFS } from "./composition.ts";
import { FORGEBOOK_MARK_URL } from "./forgebookMark.ts";
import { Icon } from "./icons.tsx";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import type { SidebarDocsProps, SidebarPageLinks } from "./SidebarDocs.tsx";
import { FamilyGroup, type ShownComponent, TreeFold } from "./SidebarEntries.tsx";
import { SidebarHandle } from "./SidebarHandle.tsx";
import { SidebarSearch } from "./SidebarSearch.tsx";
import { STRINGS } from "./strings.ts";
import type { TagFilterProps } from "./TagFilter.tsx";
import { TagViewSlot } from "./tagView.tsx";
import type { ShownTree, shownTree } from "./treeSearch.ts";
import type { AppearanceState } from "./useAppearance.ts";

/** The docs pages' section, loaded only for a catalogue that has some. */
const SIDEBAR_DOCS = lazyModule<SidebarDocsProps>(() =>
  import("./SidebarDocs.tsx").then((module) => module.SidebarDocs)
);

/**
 * The docs pages' section, once its module is there; nothing for a catalogue with no pages.
 *
 * @param props - the section's props.
 */
const LoadedDocs = (props: SidebarDocsProps): ReactNode =>
  props.sources.length === 0 ? null : (
    <LazyView
      module={SIDEBAR_DOCS}
      props={props}
      loading={null}
      failed={(message: string): ReactNode => <p className="forgebook-tree__empty">{message}</p>}
    />
  );

/** The sidebar's props. */
export type SidebarProps = SidebarPageLinks & {
  /** The catalogue's name. */
  readonly title: string;
  /** The catalogue's logo, the URL of a square image; none shows Forgebook's mark, or the name alone without branding. */
  readonly logo: string | undefined;
  /** Whether a catalogue without a logo shows Forgebook's mark. */
  readonly hasBranding: boolean;
  /** The tree it lists: what the tag filter keeps. */
  readonly tree: StoryTree;
  /** The whole tree, whose tags the filter offers. */
  readonly wholeTree: StoryTree;
  /** The tags on, each `name` or `!name`. */
  readonly tags: readonly string[];
  /** Called with the tags on, when they change. */
  readonly onTagsChange: (tags: readonly string[]) => void;
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
  /** Sets the sidebar's width, from its handle. */
  readonly onWidthChange: (width: number) => void;
  /** Whether it is shown: hidden, it slides out and stays mounted, so its search and open families come back with it. */
  readonly isOpen: boolean;
  /** Whether it lies over the page and not beside it, on a narrow window. */
  readonly isOverlay: boolean;
  /** The sidebar's element. */
  readonly sidebarRef: Ref<HTMLElement>;
  /** Its button that hides it. */
  readonly hideButtonRef: Ref<HTMLButtonElement>;
  /** Hides the sidebar. */
  readonly onHide: () => void;
  /** Shows it again. */
  readonly onShow: () => void;
  /** The shell's appearance and its setter, for the menu at the foot. */
  readonly appearance: AppearanceState;
  /** Opens the list of the shell's keys. */
  readonly onShowKeys: () => void;
  /** What is listed after this catalogue's stories when no search or tag narrows them: the composed catalogues. */
  readonly composed?: ReactNode;
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
const unsearchedTree = (tree: StoryTree): ShownTree => ({
  sources: tree.sources.map((source) => ({ source, families: source.families })),
  pages: tree.sources
    .filter(({ pages }) => pages.length > 0)
    .map((source) => ({ source, pages: source.pages }))
});

/** How many components a family holds. */
const componentCount = (family: TreeFamily): number =>
  family.groups.reduce((count, group) => count + group.components.length, 0);

/**
 * The families and groups the user opened or closed, and the ones a shown component opened: once open, one stays open
 * until the user closes it, so opening a component elsewhere never folds the list under the pointer.
 *
 * @param tree - the tree.
 * @param current - the shown component, if one is.
 */
const useFoldChoices = (
  tree: StoryTree,
  current: SidebarProps["current"]
): {
  readonly foldChoices: ReadonlyMap<string, boolean>;
  readonly setFoldOpen: (key: string, isOpen: boolean) => void;
} => {
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
  return {
    foldChoices,
    setFoldOpen: (key: string, isOpen: boolean): void =>
      setFoldChoices((choices) => new Map(choices).set(key, isOpen))
  };
};

/**
 * The tag filter, where there is something to filter by, or on an address that names a tag: it is the way out of a list
 * that tag emptied.
 *
 * @param props - the filter's props.
 */
const TagFilterSlot = (props: TagFilterProps): ReactNode => {
  const hasTags = useMemo(() => hasFilterTags(props.tree), [props.tree]);
  return hasTags || props.tags.length > 0 ? <TagViewSlot place="filter" {...props} /> : null;
};

/** What a family's entry reads. */
type FamilyEntryProps = {
  /** The family's source. */
  readonly source: TreeSource;
  /** The family. */
  readonly family: TreeFamily;
  /** Whether a search or the tag filter is on: every family it finds something in is open. */
  readonly isNarrowed: boolean;
  /** The families and groups the user opened or closed. */
  readonly foldChoices: ReadonlyMap<string, boolean>;
  /** Opens or closes a family or a group, by its key. */
  readonly onFoldChange: (key: string, isOpen: boolean) => void;
  /** The shown component, if one is. */
  readonly current: SidebarProps["current"];
  /** How an entry links its page. */
  readonly links: Pick<SidebarProps, "componentHref" | "onOpenComponent">;
};

/**
 * A family: a button that folds it, and its groups.
 *
 * @param props - the family, its source, what the user chose to fold, the shown page and the links.
 */
const FamilyEntry = ({
  source,
  family,
  isNarrowed,
  foldChoices,
  onFoldChange,
  current,
  links
}: FamilyEntryProps): ReactNode => {
  const key = familyKey(source, family);
  const isCurrentFamily =
    current?.sourceId === source.id &&
    family.groups.some((group) => group.components.some((component) => component.title === current.title));
  const isOpen = isNarrowed || (foldChoices.get(key) ?? isCurrentFamily);
  return (
    <div className="forgebook-tree__family">
      <button
        type="button"
        className="forgebook-tree__family-button"
        aria-expanded={isOpen}
        onClick={(): void => onFoldChange(key, !isOpen)}
      >
        <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
          <Icon name="chevronRight" size={12} />
        </span>
        <span className="forgebook-tree__family-name">{family.name}</span>
        <span className="forgebook-tree__count">{componentCount(family)}</span>
      </button>
      <TreeFold
        isOpen={isOpen}
        isInstant={isNarrowed}
        content={(): ReactNode =>
          family.groups.map((group) => {
            const groupOf = groupKey(key, group);
            const isGroupOpen =
              isNarrowed || (foldChoices.get(groupOf) ?? holdsCurrent(source.id, group, current));
            return (
              <FamilyGroup
                key={group.name ?? ""}
                sourceId={source.id}
                group={group}
                isOpen={isGroupOpen}
                isInstant={isNarrowed}
                onToggle={(): void => onFoldChange(groupOf, !isGroupOpen)}
                current={current}
                links={links}
              />
            );
          })
        }
      />
    </div>
  );
};

/**
 * A source: its name and its families; nothing when no family is left of it.
 *
 * @param props - the source, its families, and what each family reads.
 */
const SourceEntry = ({
  source,
  families,
  ...family
}: Omit<FamilyEntryProps, "family"> & { readonly families: readonly TreeFamily[] }): ReactNode =>
  families.length === 0 ? null : (
    <section className="forgebook-tree__source">
      <h2 className="forgebook-tree__source-name">
        {/* decorative: the name beside it says which library it is */}
        {source.logo === undefined ? null : (
          <img className="forgebook-source-logo" src={source.logo} alt="" width={14} height={14} />
        )}
        {source.name}
      </h2>
      {families.map((each) => (
        <FamilyEntry key={familyKey(source, each)} source={source} family={each} {...family} />
      ))}
    </section>
  );

/**
 * The catalogue's name and logo, the way home.
 *
 * @param props - the name, the logo's address if it has one, and the home's address.
 */
const SidebarBrand = ({
  title,
  mark,
  isHome,
  homeHref,
  onOpenHome
}: Pick<SidebarProps, "title" | "isHome" | "homeHref" | "onOpenHome"> & {
  readonly mark: string | undefined;
}): ReactNode => (
  <>
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
  </>
);

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
  wholeTree,
  tags,
  onTagsChange,
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
  onWidthChange,
  isOpen,
  isOverlay,
  sidebarRef,
  hideButtonRef,
  onHide,
  onShow,
  appearance,
  onShowKeys,
  ...links
}: SidebarProps): ReactNode => {
  const [query, setQuery] = useState("");
  const [filterTree, setFilterTree] = useState<typeof shownTree>(() => unsearchedTree);
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
  const { foldChoices, setFoldOpen } = useFoldChoices(tree, current);
  // the tag filter opens what it keeps, as a search does
  const isFiltered = tags.length > 0;
  const isSearching = query.trim() !== "";
  const isNarrowed = isSearching || isFiltered;

  // the filter comes with the search's list; a moment before it, or with no words, the tree shows whole
  const { sources, pages } = isSearching ? filterTree(tree, query) : unsearchedTree(tree);
  const hasMatches = pages.length > 0 || sources.some(({ families }) => families.length > 0);

  return (
    // hidden, it slides out by its own width (a margin, so a drag of its handle never waits for a transition) and
    // leaves Tab and screen readers
    <aside
      ref={sidebarRef}
      className="forgebook-sidebar"
      data-open={isOpen ? "" : undefined}
      data-overlay={isOverlay ? "" : undefined}
      inert={!isOpen}
      style={{ width, marginInlineStart: isOpen ? 0 : -width }}
    >
      <div className="forgebook-brand">
        <SidebarBrand
          title={title}
          mark={logo ?? (hasBranding ? FORGEBOOK_MARK_URL : undefined)}
          isHome={isHome}
          homeHref={homeHref}
          onOpenHome={onOpenHome}
        />
        <button
          ref={hideButtonRef}
          type="button"
          className="forgebook-icon-button forgebook-brand__hide"
          title={STRINGS.hideSidebar}
          aria-label={STRINGS.hideSidebar}
          onClick={onHide}
        >
          <Icon name="sidebar" size={14} />
        </button>
      </div>
      <div className="forgebook-search-row">
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
        <TagFilterSlot tree={wholeTree} tags={tags} onTagsChange={onTagsChange} />
      </div>
      <nav ref={navRef} className="forgebook-tree" aria-label={STRINGS.componentsNav}>
        {hasMatches || !isNarrowed ? null : <p className="forgebook-tree__empty">{STRINGS.noMatch}</p>}
        <LoadedDocs
          sources={pages}
          currentPageId={currentPageId}
          isSearching={isNarrowed}
          foldChoices={foldChoices}
          onFoldChange={setFoldOpen}
          pageHref={pageHref}
          onOpenPage={onOpenPage}
        />
        {sources.map(({ source, families }) => (
          <SourceEntry
            key={source.id}
            source={source}
            families={families}
            isNarrowed={isNarrowed}
            foldChoices={foldChoices}
            onFoldChange={setFoldOpen}
            current={current}
            links={links}
          />
        ))}
        {/* the search and the tag filter read this catalogue only: another's list is not fetched to search it */}
        {HAS_REFS && !isNarrowed ? links.composed : null}
      </nav>
      <AppearanceMenu {...appearance} onShowKeys={onShowKeys} />
      {isOpen && !isOverlay ? <SidebarHandle width={width} onWidthChange={onWidthChange} /> : null}
    </aside>
  );
};
