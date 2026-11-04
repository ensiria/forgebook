/**
 * A docs page: Markdown a package wrote, with live stories, under the catalogue's header, with its contents beside it
 * and the pages around it at its foot.
 *
 * @remarks
 * Loaded on first use, since a catalogue may have none: the shell's first load pays nothing for it, here or in its
 * style sheet. The text comes rendered from the plugin (`vite/docPageMarkdown.ts`); a story's frame loads as it comes
 * near, and the view reaches the frames live, as on a component's page.
 *
 * @module
 */
import "./docPage.scss";

import type { StorySource } from "@forgebook/story-format/source";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { isDocPage, type DocPage as LoadedDocPage } from "../docPages.ts";
import { anchorOf } from "../pageAddress.ts";
import type { PageLocation, TreePage } from "../pageTree.ts";
import { sourcePages } from "../sourceFiles.ts";
import { findStory, type StoryTree, type TreeSource, type TreeStory } from "../storyTree.ts";
import type { ViewState } from "../viewState.ts";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import {
  blockPlaces,
  catalogueValues,
  DocBlocks,
  type DocBlocksContext,
  queuedBlocks
} from "./DocBlocks.tsx";
import { DocContents } from "./DocContents.tsx";
import { Icon } from "./icons.tsx";
import { PAGE_STRINGS } from "./pageStrings.ts";
import type { ShellPlugin } from "./pluginTabs.tsx";
import type { TouchOverrides } from "./storyTouch.ts";
import { STRINGS } from "./strings.ts";
import { useAnchorScroll } from "./useAnchorScroll.ts";
import { type Loaded, useLoaded } from "./useLoaded.ts";
import { usePageFrames } from "./usePageFrames.ts";
import { useProseLinks } from "./useProseLinks.ts";
import { type PageScroll, useScrollMemory } from "./useScrollMemory.ts";

/** The narrowest page that takes the contents as a column beside its text, in CSS px. */
const COLUMN_WIDTH = 900;

/** A page that loaded no block yet: its frames wait for it. */
const NO_BLOCKS: LoadedDocPage = { blocks: [], headings: [], assets: [] };

/** What the plugin answered, as a state. */
const pageState = (value: unknown): Loaded<LoadedDocPage> =>
  isDocPage(value)
    ? { status: "ready", value }
    : { status: "error", message: "The page has an unexpected shape" };

/** The docs page's props. */
export type DocPageProps = {
  /** The catalogue's name, for the values a page's text names. */
  readonly title: string;
  /** The plugins, whose blocks the page may hold. */
  readonly plugins: readonly ShellPlugin[];
  /** The page and its source. */
  readonly location: PageLocation;
  /** The heading the address names; none when it names none. */
  readonly anchor: string | undefined;
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, with their loaders. */
  readonly sources: readonly StorySource[];
  /** The view. */
  readonly view: ViewState;
  /** What the user chose for each story marked for a phone. */
  readonly touchOverrides: TouchOverrides;
  /** Called when the user turns a story's finger on or off. */
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The address of a story's page, for its link. */
  readonly storyHrefOf: (story: TreeStory) => string;
  /** Opens a story's page. */
  readonly onOpenStory: (story: TreeStory) => void;
  /** The address of a docs page, by its id and anchor. */
  readonly pageHrefOf: (id: string, anchor: string | undefined) => string;
  /** Opens a docs page. */
  readonly onOpenPage: (id: string) => void;
  /** Goes to a heading of the shown page, as a new entry of the history. */
  readonly onOpenAnchor: (anchor: string) => void;
  /** Opens an address of the catalogue a page's text links to; `false` when it names no page of the catalogue. */
  readonly onOpenAddress: (address: string) => boolean;
  /** A story's measured height, for its box while it loads. */
  readonly heightOf: (storyId: string) => number | undefined;
  /** The colour a source's stories' page has in the view, which each box waits on. */
  readonly backgroundOf: (source: TreeSource) => string | undefined;
  /** What stays above the page while it scrolls: its header. */
  readonly header: ReactNode;
  /** Where its scrolling part starts: the shell's visit of the page and every page's last position. */
  readonly scroll: PageScroll;
};

/**
 * The pages before and after one, in the reading order of its source.
 *
 * @param pages - the source's pages.
 * @param id - the page's id.
 */
const pagesAround = (
  pages: readonly TreePage[],
  id: string
): { readonly previous: TreePage | undefined; readonly next: TreePage | undefined } => {
  const place = pages.findIndex((page) => page.id === id);
  return { previous: pages[place - 1], next: pages[place + 1] };
};

/**
 * A page's foot: the pages before and after it.
 *
 * @param props - the two pages, and how to open one.
 */
const PageFoot = ({
  previous,
  next,
  hrefOf,
  onOpen
}: {
  readonly previous: TreePage | undefined;
  readonly next: TreePage | undefined;
  readonly hrefOf: DocPageProps["pageHrefOf"];
  readonly onOpen: DocPageProps["onOpenPage"];
}): ReactNode => {
  const link = (page: TreePage | undefined, label: string, side: "previous" | "next"): ReactNode =>
    page === undefined ? (
      <span />
    ) : (
      <a
        className="forgebook-docs__around"
        data-side={side}
        href={hrefOf(page.id, undefined)}
        onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onOpen(page.id);
        }}
      >
        <span className="forgebook-docs__around-label">{label}</span>
        <span className="forgebook-docs__around-name">
          {page.name}
          {side === "next" ? <Icon name="chevronRight" size={12} /> : null}
        </span>
      </a>
    );
  return previous === undefined && next === undefined ? null : (
    <nav className="forgebook-docs__foot" aria-label={STRINGS.docsNav}>
      {link(previous, PAGE_STRINGS.previousPage, "previous")}
      {link(next, PAGE_STRINGS.nextPage, "next")}
    </nav>
  );
};

/**
 * The page's width, followed as the window or the sidebar changes it.
 *
 * @param ref - the page's scrolling element.
 */
const usePageWidth = (ref: React.RefObject<HTMLElement | null>): number | undefined => {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    setWidth(element.clientWidth);
    const resizes = new ResizeObserver((): void => setWidth(element.clientWidth));
    resizes.observe(element);
    return (): void => resizes.disconnect();
  }, [ref]);
  return width;
};

/** The page's text once it is there, or why it could not be read. */
const loadedPage = (loaded: Loaded<LoadedDocPage>): LoadedDocPage =>
  loaded.status === "ready" ? loaded.value : NO_BLOCKS;

/**
 * A docs page.
 *
 * @param props - the page, its anchor, the view, and how it opens what it links to.
 */
export const DocPage = ({
  title,
  plugins,
  location,
  anchor,
  tree,
  sources,
  view,
  touchOverrides,
  onTouchChange,
  frameUrl,
  storyHrefOf,
  onOpenStory,
  pageHrefOf,
  onOpenPage,
  onOpenAnchor,
  onOpenAddress,
  heightOf,
  backgroundOf,
  header,
  scroll
}: DocPageProps): ReactNode => {
  const { page, source } = location;
  const pageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const owner = sources.find((candidate) => candidate.id === source.id);
  const load = owner === undefined ? undefined : sourcePages(owner).pages[page.file];
  const loaded = useLoaded(load, pageState);
  const content = loadedPage(loaded);
  const catalogue = useCatalogue();
  const stories = useMemo(
    () => page.stories.flatMap((id) => findStory(tree, id)?.story ?? []),
    [page.stories, tree]
  );
  const queued = useMemo(() => queuedBlocks(content.blocks, tree), [content.blocks, tree]);
  const places = useMemo(() => blockPlaces(content.blocks), [content.blocks]);
  const values = useMemo(() => catalogueValues(title, tree), [title, tree]);
  const frames = usePageFrames({ stories, queued, pageRef, view, touchOverrides });
  useScrollMemory(pageRef, scroll);
  const placeAgain = useAnchorScroll(pageRef, anchor, scroll.visit, loaded.status === "ready");
  const goToAnchor = useCallback(
    (target: string): void => {
      if (target === anchor) placeAgain();
      else onOpenAnchor(target);
    },
    [anchor, onOpenAnchor, placeAgain]
  );
  const width = usePageWidth(pageRef);
  const openLink = useCallback(
    (href: string): boolean => {
      if (href.startsWith("#")) {
        goToAnchor(anchorOf(href.slice(1)) ?? "");
        return true;
      }
      return href.startsWith("?") && onOpenAddress(href);
    },
    [goToAnchor, onOpenAddress]
  );
  useProseLinks(bodyRef, openLink);
  const context: DocBlocksContext = {
    tree,
    sources,
    frames,
    view,
    frameUrl,
    plugins,
    strings: catalogue.strings,
    switches: catalogue.switches,
    assets: content.assets,
    pageHrefOf: (slug: string, target: string | undefined): string =>
      pageHrefOf(`${source.id}:${slug}`, target),
    stories: { hrefOf: storyHrefOf, onOpen: onOpenStory },
    onTouchChange,
    heightOf,
    backgroundOf,
    values,
    onOpenAddress: openLink,
    places
  };
  const isColumn = width !== undefined && width >= COLUMN_WIDTH;
  const contents = (
    <DocContents
      headings={content.headings}
      values={values}
      scrollRef={pageRef}
      isColumn={isColumn}
      hrefOf={(target: string): string => pageHrefOf(page.id, target)}
      onOpen={goToAnchor}
    />
  );
  return (
    <div className="forgebook-workspace">
      {header}
      <div ref={pageRef} className="forgebook-scroll">
        <div className="forgebook-docs">
          <article ref={bodyRef} className="forgebook-doc forgebook-docs__body">
            {page.description === undefined ? null : (
              <p className="forgebook-doc__lead">
                <CodeText text={page.description} />
              </p>
            )}
            {isColumn ? null : contents}
            {loaded.status === "error" ? (
              <p className="forgebook-problems" role="alert">
                {PAGE_STRINGS.docPageError}: {loaded.message}
              </p>
            ) : null}
            <DocBlocks blocks={content.blocks} context={context} />
            <PageFoot {...pagesAround(source.pages, page.id)} hrefOf={pageHrefOf} onOpen={onOpenPage} />
          </article>
          {isColumn ? contents : null}
        </div>
      </div>
    </div>
  );
};
