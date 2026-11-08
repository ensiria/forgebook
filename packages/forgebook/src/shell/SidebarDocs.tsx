/**
 * The sidebar's Docs section, above the components: each source's pages in their reading order, by group, a group
 * open until the reader folds it, since a catalogue's docs are few and read in order.
 *
 * @module
 */
import type { ReactNode } from "react";

import { type PageGroup, pageGroups, type TreePage } from "../pageTree.ts";
import type { TreeSource } from "../storyTree.ts";
import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { PageLink, TreeFold } from "./SidebarEntries.tsx";

/** How the section links its pages. */
export type SidebarPageLinks = {
  /** The address of a docs page, by its id, for its link. */
  readonly pageHref: (id: string) => string;
  /** Opens a docs page, by its id. */
  readonly onOpenPage: (id: string) => void;
};

/** The section's props. */
export type SidebarDocsProps = SidebarPageLinks & {
  /** The sources with the pages shown, those with none left out. */
  readonly sources: readonly { readonly source: TreeSource; readonly pages: readonly TreePage[] }[];
  /** The shown page's id; none on any other page. */
  readonly currentPageId: string | undefined;
  /** Whether a search is on: every group it finds something in opens at once. */
  readonly isSearching: boolean;
  /** Whether the reader folded a group open or shut, by its key. */
  readonly foldChoices: ReadonlyMap<string, boolean>;
  /** Called when the reader folds a group. */
  readonly onFoldChange: (key: string, isOpen: boolean) => void;
};

/**
 * A page's link.
 *
 * @param props - the page, whether it is shown, and its link.
 */
const PageEntry = ({
  page,
  isCurrent,
  pageHref,
  onOpenPage
}: SidebarPageLinks & { readonly page: TreePage; readonly isCurrent: boolean }): ReactNode => (
  <div className="forgebook-tree__component">
    <PageLink
      href={pageHref(page.id)}
      className="forgebook-tree__item"
      current={isCurrent ? "page" : undefined}
      onOpen={(): void => onOpenPage(page.id)}
    >
      <span className="forgebook-tree__item-name">{page.name}</span>
    </PageLink>
  </div>
);

/**
 * A group of pages, under a button that folds it when it has a name.
 *
 * @param props - the group, its source and what the section shares.
 */
const PageGroupEntries = ({
  sourceId,
  group,
  currentPageId,
  isSearching,
  foldChoices,
  onFoldChange,
  ...links
}: Omit<SidebarDocsProps, "sources"> & {
  readonly sourceId: string;
  readonly group: PageGroup;
}): ReactNode => {
  const entries = (): ReactNode =>
    group.pages.map((page) => (
      <PageEntry key={page.id} page={page} isCurrent={page.id === currentPageId} {...links} />
    ));
  if (group.name === undefined) return <div className="forgebook-tree__group">{entries()}</div>;
  const key = `docs/${sourceId}/${group.name}`;
  const isOpen = isSearching || (foldChoices.get(key) ?? true);
  return (
    <div className="forgebook-tree__group">
      <h3 className="forgebook-tree__group-name">
        <button
          type="button"
          className="forgebook-tree__group-button"
          aria-expanded={isOpen}
          onClick={(): void => onFoldChange(key, !isOpen)}
        >
          <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
            <Icon name="chevronRight" size={12} />
          </span>
          <span className="forgebook-tree__family-name">{group.name}</span>
          <span className="forgebook-tree__count">{group.pages.length}</span>
        </button>
      </h3>
      <TreeFold isOpen={isOpen} isInstant={isSearching} content={entries} />
    </div>
  );
};

/**
 * The section; nothing when no page is shown.
 *
 * @param props - the sources with their pages, the shown page, the folds and the links.
 */
export const SidebarDocs = ({ sources, ...shared }: SidebarDocsProps): ReactNode =>
  sources.length === 0 ? null : (
    <section className="forgebook-tree__source">
      <h2 className="forgebook-tree__source-name">{LATER_STRINGS.docsNav}</h2>
      {sources.map(({ source, pages }) => (
        <div key={source.id}>
          {/* a single library's pages need no name: the section is theirs */}
          {sources.length > 1 ? <h3 className="forgebook-tree__docs-source">{source.name}</h3> : null}
          {pageGroups(pages).map((group) => (
            <PageGroupEntries
              key={group.name ?? group.pages[0]?.id}
              sourceId={source.id}
              group={group}
              {...shared}
            />
          ))}
        </div>
      ))}
    </section>
  );
