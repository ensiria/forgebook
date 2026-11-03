/**
 * The catalogue's home: the pages opened last, then each source with its own introduction, its docs pages and its
 * families, each family a card of its components. The logo opens it, and so does an address that names no page.
 *
 * @remarks
 * Everything but a source's introduction is drawn from the tree, so it never goes stale; the introduction is the
 * package's own Markdown (`StorySource.home`), rendered by the plugin. No story loads here: a home of frames would load
 * dozens of them before anyone picked one.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { type MouseEvent, type ReactNode, useState } from "react";

import { findPage } from "../pageTree.ts";
import {
  componentId,
  findComponent,
  findStory,
  type StoryTree,
  type TreeComponent,
  type TreeFamily,
  type TreeSource
} from "../storyTree.ts";
import { PackageHtml } from "./PackageHtml.tsx";
import { STRINGS } from "./strings.ts";
import { type Loaded, useLoaded } from "./useLoaded.ts";
import type { RecentPage } from "./useRecentPages.ts";

/** The most components a family's card lists before "Show all". */
const CARD_COMPONENTS = 6;

/** The home's props. */
export type HomePageProps = {
  /** The catalogue's title. */
  readonly title: string;
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, for their introductions. */
  readonly sources: readonly StorySource[];
  /** The pages opened last, the newest first. */
  readonly recent: readonly RecentPage[];
  /** A page's address, for its link. */
  readonly hrefOf: (page: RecentPage) => string;
  /** Opens a page. */
  readonly onOpen: (page: RecentPage) => void;
  /** What stays above the home: the index's problems, when it has some. */
  readonly header: ReactNode;
};

/** A link to a page, opened in place unless the user asks for another tab. */
const PageLink = ({
  page,
  hrefOf,
  onOpen,
  className,
  children
}: Pick<HomePageProps, "hrefOf" | "onOpen"> & {
  readonly page: RecentPage;
  readonly className: string;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    href={hrefOf(page)}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onOpen(page);
    }}
  >
    {children}
  </a>
);

/** A recent page as the home lists it: its name and its place, or none when the tree no longer has it. */
type RecentEntry = {
  /** The page. */
  readonly page: RecentPage;
  /** The component's or the story's name. */
  readonly name: string;
  /** Where it sits: the component's place, and its name for a story. */
  readonly place: string;
};

/**
 * The recent pages the tree still has, with their names and places.
 *
 * @param tree - the tree.
 * @param recent - the pages opened last.
 */
const recentEntries = (tree: StoryTree, recent: readonly RecentPage[]): RecentEntry[] =>
  recent.flatMap((page): RecentEntry[] => {
    if (page.kind === "story") {
      const location = findStory(tree, page.id);
      if (location === undefined) return [];
      const place = [location.source.name, location.family.name, location.component.name].join(" · ");
      return [{ page, name: location.story.name, place }];
    }
    if (page.kind === "page") {
      const location = findPage(tree, page.id);
      if (location === undefined) return [];
      const place = [location.source.name, location.page.group].filter((part) => part !== undefined);
      return [{ page, name: location.page.name, place: place.join(" · ") }];
    }
    const location = findComponent(tree, page.id);
    if (location === undefined) return [];
    const place = [location.source.name, location.family.name, location.group.name]
      .filter((part) => part !== undefined)
      .join(" · ");
    return [{ page, name: location.component.name, place }];
  });

/** What the plugin answered for a source's introduction, as a state. */
const introState = (value: unknown): Loaded<{ readonly html: string }> => {
  const markdown =
    typeof value === "object" && value !== null && "default" in value ? value.default : undefined;
  if (
    typeof markdown === "object" &&
    markdown !== null &&
    "html" in markdown &&
    typeof markdown.html === "string"
  ) {
    return { status: "ready", value: { html: markdown.html } };
  }
  return { status: "error", message: "The source's introduction has an unexpected shape" };
};

/**
 * A source's introduction, as its package wrote it; nothing while it loads or when the source has none.
 *
 * @param props - the loader.
 */
const SourceIntro = ({ load }: { readonly load: StorySource["home"] }): ReactNode => {
  const intro = useLoaded(load, introState);
  if (intro.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.homeIntroError}: {intro.message}
      </p>
    );
  }
  return intro.status === "ready" ? (
    <PackageHtml className="forgebook-prose" html={intro.value.html} />
  ) : null;
};

/**
 * A family's card: its name and how many components it has, then its components, the first few until asked for all.
 *
 * @param props - the source, the family, and how to open a component.
 */
const FamilyCard = ({
  source,
  family,
  hrefOf,
  onOpen
}: Pick<HomePageProps, "hrefOf" | "onOpen"> & {
  readonly source: TreeSource;
  readonly family: TreeFamily;
}): ReactNode => {
  const [isOpen, setIsOpen] = useState(false);
  const components: TreeComponent[] = family.groups.flatMap((group) => [...group.components]);
  const shown = isOpen ? components : components.slice(0, CARD_COMPONENTS);
  return (
    <article className="forgebook-home__card" aria-label={family.name}>
      <h3 className="forgebook-home__card-title">
        {family.name}
        <span className="forgebook-home__count">{STRINGS.componentsCount(components.length)}</span>
      </h3>
      <ul className="forgebook-home__components">
        {shown.map((component) => (
          <li key={component.title}>
            <PageLink
              page={{ kind: "component", id: componentId(source.id, component.title) }}
              hrefOf={hrefOf}
              onOpen={onOpen}
              className="forgebook-link"
            >
              {component.name}
            </PageLink>
          </li>
        ))}
      </ul>
      {components.length > CARD_COMPONENTS ? (
        <button
          type="button"
          className="forgebook-text-button"
          aria-expanded={isOpen}
          onClick={(): void => setIsOpen(!isOpen)}
        >
          {isOpen ? STRINGS.showFewer : STRINGS.showAll(components.length)}
        </button>
      ) : null}
    </article>
  );
};

/**
 * A source's docs pages as a card, in their reading order, first among its families.
 *
 * @param props - the source, and how to open a page.
 */
const DocsCard = ({
  source,
  hrefOf,
  onOpen
}: Pick<HomePageProps, "hrefOf" | "onOpen"> & { readonly source: TreeSource }): ReactNode => (
  <article className="forgebook-home__card" aria-label={STRINGS.docsNav}>
    <h3 className="forgebook-home__card-title">{STRINGS.docsNav}</h3>
    <ul className="forgebook-home__components">
      {source.pages.map((page) => (
        <li key={page.id}>
          <PageLink
            page={{ kind: "page", id: page.id }}
            hrefOf={hrefOf}
            onOpen={onOpen}
            className="forgebook-link"
          >
            {page.name}
          </PageLink>
        </li>
      ))}
    </ul>
  </article>
);

/**
 * The home.
 *
 * @param props - the title, the tree, the sources, the recent pages, and how to open a page.
 */
export const HomePage = ({
  title,
  tree,
  sources,
  recent,
  hrefOf,
  onOpen,
  header
}: HomePageProps): ReactNode => {
  const entries = recentEntries(tree, recent);
  const componentCount = tree.sources.reduce(
    (total, source) =>
      total +
      source.families.reduce(
        (sum, family) => sum + family.groups.reduce((count, group) => count + group.components.length, 0),
        0
      ),
    0
  );
  return (
    <div className="forgebook-workspace">
      {header}
      <div className="forgebook-scroll">
        <div className="forgebook-home">
          <header className="forgebook-home__head">
            <h1 className="forgebook-home__title">{title}</h1>
            <p className="forgebook-doc__lead">
              {tree.sources.length === 0
                ? STRINGS.homeEmpty
                : STRINGS.homeSummary(
                    componentCount,
                    tree.sources.filter((source) => source.families.length > 0).length
                  )}
            </p>
          </header>
          {entries.length === 0 ? null : (
            <section className="forgebook-doc__section" aria-labelledby="forgebook-recent">
              <h2 id="forgebook-recent">{STRINGS.recentlyOpened}</h2>
              <ul className="forgebook-home__recent">
                {entries.map((entry) => (
                  <li key={`${entry.page.kind}:${entry.page.id}`}>
                    <PageLink
                      page={entry.page}
                      hrefOf={hrefOf}
                      onOpen={onOpen}
                      className="forgebook-home__recent-link"
                    >
                      <span className="forgebook-home__recent-name">{entry.name}</span>
                      <span className="forgebook-home__recent-place">{entry.place}</span>
                    </PageLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tree.sources.map((source) => (
            <section
              key={source.id}
              className="forgebook-doc__section"
              aria-labelledby={`forgebook-source-${source.id}`}
            >
              <h2 id={`forgebook-source-${source.id}`} className="forgebook-home__source">
                {/* decorative: the name beside it says which library it is */}
                {source.logo === undefined ? null : (
                  <img className="forgebook-source-logo" src={source.logo} alt="" width={28} height={28} />
                )}
                {source.name}
              </h2>
              <SourceIntro load={sources.find((candidate) => candidate.id === source.id)?.home} />
              <div className="forgebook-home__families">
                {source.pages.length === 0 ? null : (
                  <DocsCard source={source} hrefOf={hrefOf} onOpen={onOpen} />
                )}
                {source.families.map((family) => (
                  <FamilyCard
                    key={family.name}
                    source={source}
                    family={family}
                    hrefOf={hrefOf}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
