/**
 * The sidebar: a search field and the tree, by source, family (opens and closes), group and component, one line per
 * component that never opens: a component's link opens its page, and its stories are picked in the page's header, so
 * nothing in the list folds under the pointer. A family stays open once opened; a search finds a component by its
 * name, its place, its meta's search words or its stories' names and descriptions. A component listed in other places too (`alsoIn`) has an
 * alias entry in each, beside the components that live there, which says where it lives and opens its page (D-492).
 *
 * @module
 */

import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";

import type { StoryTree, TreeAlias, TreeComponent, TreeFamily, TreeGroup, TreeSource } from "../storyTree";
import { Icon } from "./icons";
import { isTyping } from "./keyboard";
import { STRINGS } from "./strings";
import { foundFamily, searchWords } from "./treeSearch";

/** The sidebar's props. */
export type SidebarProps = {
  /** The catalogue's name. */
  readonly title: string;
  /** The catalogue's logo, the URL of a square image; none shows the catalogue's own mark. */
  readonly logo: string | undefined;
  /** The tree. */
  readonly tree: StoryTree;
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
  readonly current:
    | { readonly sourceId: string; readonly title: string; readonly storyId: string | undefined }
    | undefined;
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
};

/** A family's key, unique across sources. */
const familyKey = (source: TreeSource, family: TreeFamily): string => `${source.id}/${family.name}`;

/** The key of the family the shown component is in; none when no component is shown. */
const currentFamilyOf = (tree: StoryTree, current: SidebarProps["current"]): string | undefined => {
  if (current === undefined) return undefined;
  const source = tree.sources.find((candidate) => candidate.id === current.sourceId);
  const family = source?.families.find((candidate) =>
    candidate.groups.some((group) => group.components.some((component) => component.title === current.title))
  );
  return source === undefined || family === undefined ? undefined : familyKey(source, family);
};

/** A link that opens a page in place, keeping a real address for a new tab. */
const PageLink = ({
  href,
  className,
  current,
  onOpen,
  children
}: {
  readonly href: string;
  readonly className: string;
  /** What the link is when current: the shown page, or the place the shown page is in; none when not current. */
  readonly current: "page" | "location" | undefined;
  readonly onOpen: () => void;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    href={href}
    aria-current={current}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      event.preventDefault();
      onOpen();
    }}
  >
    {children}
  </a>
);

/** How many components a family holds. */
const componentCount = (family: TreeFamily): number =>
  family.groups.reduce((count, group) => count + group.components.length, 0);

/** What the shown component's link is: the page itself on the component's page, where the page is on a story's. */
const currentKind = (currentStoryId: string | undefined): "page" | "location" =>
  currentStoryId === undefined ? "page" : "location";

/** A component's link: its page, where its stories are picked from the header. */
const ComponentEntry = ({
  sourceId,
  component,
  isCurrent,
  currentStoryId,
  links
}: {
  readonly sourceId: string;
  readonly component: TreeComponent;
  readonly isCurrent: boolean;
  readonly currentStoryId: string | undefined;
  readonly links: Pick<SidebarProps, "componentHref" | "onOpenComponent">;
}): ReactNode => {
  const current = isCurrent ? currentKind(currentStoryId) : undefined;
  return (
    <div className="forgebook-tree__component">
      <PageLink
        href={links.componentHref(sourceId, component.title)}
        className="forgebook-tree__item"
        current={current}
        onOpen={(): void => links.onOpenComponent(sourceId, component.title)}
      >
        <span className="forgebook-tree__item-name">{component.name}</span>
        <span className="forgebook-tree__count">{component.stories.length}</span>
      </PageLink>
    </div>
  );
};

/** The family a title places a component in: its first segment. */
const familyOf = (title: string): string => title.split("/")[0]?.trim() ?? title;

/**
 * An alias entry: the name of a component that lives elsewhere, marked with the family it lives in, opening its page
 * (D-492). It is never marked as the shown page: the entry where the component lives is, so the sidebar says where
 * it sits.
 */
const AliasEntry = ({
  sourceId,
  alias,
  links
}: {
  readonly sourceId: string;
  readonly alias: TreeAlias;
  readonly links: Pick<SidebarProps, "componentHref" | "onOpenComponent">;
}): ReactNode => (
  <div className="forgebook-tree__component" title={STRINGS.aliasHint(alias.title.split("/").join(" › "))}>
    <PageLink
      href={links.componentHref(sourceId, alias.title)}
      className="forgebook-tree__item"
      current={undefined}
      onOpen={(): void => links.onOpenComponent(sourceId, alias.title)}
    >
      <span className="forgebook-tree__item-name">{alias.name}</span>
      <span className="forgebook-tree__alias">
        <Icon name="external" size={10} />
        {STRINGS.aliasPlace(familyOf(alias.title))}
      </span>
    </PageLink>
  </div>
);

/** A group's entries in name order: its own components and the aliases of components that live elsewhere. */
const groupEntries = (
  group: TreeGroup
): readonly (
  | { readonly kind: "component"; readonly component: TreeComponent }
  | {
      readonly kind: "alias";
      readonly alias: TreeAlias;
    }
)[] =>
  [
    ...group.components.map((component) => ({ kind: "component" as const, component, name: component.name })),
    ...group.aliases.map((alias) => ({ kind: "alias" as const, alias, name: alias.name }))
  ].sort((left, right) => left.name.localeCompare(right.name));

/**
 * The sidebar.
 *
 * @param props - the tree, the shown component and how to open one.
 */
export const Sidebar = ({
  title,
  logo,
  tree,
  isHome,
  homeHref,
  onOpenHome,
  current,
  width,
  isOpen,
  onHide,
  ...links
}: SidebarProps): ReactNode => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // the shown component stays in sight: a page opened by a key, the picker or the address scrolls the list to it
  const currentTitle = current?.title;
  useEffect(() => {
    if (currentTitle === undefined) return;
    navRef.current
      ?.querySelector(".forgebook-tree__item[aria-current]")
      ?.scrollIntoView({ block: "nearest" });
  }, [currentTitle]);
  useEffect(() => {
    // "/" goes to the search from anywhere in the shell, as in most catalogues
    // a hidden sidebar leaves the key to the page
    if (!isOpen) return;
    const focusSearch = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target))
        return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return (): void => document.removeEventListener("keydown", focusSearch);
  }, [isOpen]);
  // the families the user opened or closed, and the ones a shown component opened: once open, a family stays open
  // until the user closes it, so opening a component elsewhere never folds the list under the pointer
  const [familyChoices, setFamilyChoices] = useState<ReadonlyMap<string, boolean>>(new Map());
  const currentFamilyKey = currentFamilyOf(tree, current);
  useEffect(() => {
    if (currentFamilyKey === undefined) return;
    setFamilyChoices((choices) =>
      choices.has(currentFamilyKey) ? choices : new Map(choices).set(currentFamilyKey, true)
    );
  }, [currentFamilyKey]);
  const words = searchWords(query);
  const isSearching = words.length > 0;
  const isCurrentFamily = (source: TreeSource, family: TreeFamily): boolean =>
    current?.sourceId === source.id &&
    family.groups.some((group) => group.components.some((component) => component.title === current.title));
  const setFamilyOpen = (key: string, isOpen: boolean): void =>
    setFamilyChoices((choices) => new Map(choices).set(key, isOpen));

  const sources = tree.sources.map((source) => ({
    source,
    families: source.families.flatMap((family) => {
      const shown = foundFamily(family, words);
      return shown === undefined ? [] : [shown];
    })
  }));
  const hasMatches = sources.some(({ families }) => families.length > 0);

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
          {logo === undefined ? (
            <span className="forgebook-brand__mark">
              <Icon name="compare" size={14} />
            </span>
          ) : (
            // decorative: the name beside it says what it is
            <img className="forgebook-brand__logo" src={logo} alt="" width={28} height={28} />
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
      <label className="forgebook-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          ref={searchRef}
          value={query}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
            // Escape empties the search first, then leaves the field
            if (event.key !== "Escape") return;
            if (query === "") event.currentTarget.blur();
            else setQuery("");
          }}
          placeholder={STRINGS.searchPlaceholder}
          aria-label={STRINGS.searchLabel}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => setQuery(event.target.value)}
        />
        {query === "" ? (
          // the key that comes here; the field's own name (aria-label) says what it is
          <kbd className="forgebook-search__key">/</kbd>
        ) : (
          // the catalogue's own clear button: the platform's draws in its own colours and size
          <button
            type="button"
            className="forgebook-search__clear"
            aria-label={STRINGS.clearSearch}
            title={STRINGS.clearSearch}
            onClick={(): void => {
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            <Icon name="close" size={10} />
          </button>
        )}
      </label>
      <nav ref={navRef} className="forgebook-tree" aria-label={STRINGS.componentsNav}>
        {hasMatches ? null : <p className="forgebook-tree__empty">{STRINGS.noMatch}</p>}
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
                const isOpen = isSearching || (familyChoices.get(key) ?? isCurrentFamily(source, family));
                return (
                  <div key={key} className="forgebook-tree__family">
                    <button
                      type="button"
                      className="forgebook-tree__family-button"
                      aria-expanded={isOpen}
                      onClick={(): void => setFamilyOpen(key, !isOpen)}
                    >
                      <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={12} />
                      <span className="forgebook-tree__family-name">{family.name}</span>
                      <span className="forgebook-tree__count">{componentCount(family)}</span>
                    </button>
                    {isOpen
                      ? family.groups.map((group) => (
                          <div key={group.name ?? ""} className="forgebook-tree__group">
                            {group.name === undefined ? null : (
                              <h3 className="forgebook-tree__group-name">{group.name}</h3>
                            )}
                            {groupEntries(group).map((entry) =>
                              entry.kind === "component" ? (
                                <ComponentEntry
                                  key={entry.component.title}
                                  sourceId={source.id}
                                  component={entry.component}
                                  isCurrent={
                                    current?.sourceId === source.id && current.title === entry.component.title
                                  }
                                  currentStoryId={current?.storyId}
                                  links={links}
                                />
                              ) : (
                                <AliasEntry
                                  key={`alias:${entry.alias.title}`}
                                  sourceId={source.id}
                                  alias={entry.alias}
                                  links={links}
                                />
                              )
                            )}
                          </div>
                        ))
                      : null}
                  </div>
                );
              })}
            </section>
          )
        )}
      </nav>
    </aside>
  );
};
