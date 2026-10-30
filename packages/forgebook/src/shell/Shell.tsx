/**
 * The catalogue's page: the sidebar, the toolbar, the component's header and either the component's page (every
 * story) or one story's stage, with the page and the view kept in the address.
 *
 * @module
 */
/* eslint-disable max-lines -- the page, its address and its keys; split by what it does when next touched */

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { type CatalogueLists, type CatalogueSettings, catalogueSettings } from "../catalogue.ts";
import { type PanelArgs, panelArgsParam, parsePanelArgsParam } from "../messages.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { storyBackground } from "../storyBackground.ts";
import { type FixedView, NOT_FIXED } from "../storyGlobals.ts";
import { knownHeight, type StoryHeights } from "../storyHeights.ts";
import {
  type ComponentLocation,
  componentId,
  findComponent,
  findStory,
  type StoryLocation,
  type StoryTree,
  sidebarStoryIds,
  storyTree,
  type TreeStory
} from "../storyTree.ts";
import { catalogueSwitches, type ViewSwitch } from "../switches.ts";
import { parseView, type StageWidth, type ViewCatalogue, type ViewState, viewParams } from "../viewState.ts";
import { ComponentPage } from "./ComponentPage.tsx";
import { CatalogueContext, useCatalogue } from "./catalogueContext.ts";
import { HomePage } from "./HomePage.tsx";
import { Sidebar, type SidebarProps } from "./Sidebar.tsx";
import { SidebarHandle } from "./SidebarHandle.tsx";
import { Stage } from "./Stage.tsx";
import { StoryPicker } from "./StoryPicker.tsx";
import { STRINGS } from "./strings.ts";
import { ShowSidebarButton, Toolbar, type ToolbarProps } from "./Toolbar.tsx";
import { type RecentPage, useRecentPages } from "./useRecentPages.ts";
import type { PageScroll, PageVisit } from "./useScrollMemory.ts";
import { useSidebarLayout } from "./useSidebarLayout.ts";
import { useStoryHeights } from "./useStoryHeights.ts";
import { useStoryIdsElement } from "./useStoryIdsElement.ts";
import { useStoryKeys } from "./useStoryKeys.ts";
import { useSystemDark } from "./useSystemDark.ts";

/** What an app passes to the shell. */
export type ShellConfig = {
  /** The catalogue's name, in the page title and the sidebar. */
  readonly title: string;
  /**
   * The catalogue's logo, the URL of a square image: beside its name in the sidebar and as the page's icon. None by
   * default: the catalogue's own mark. The catalogue belongs to whoever mounts it, so the logo is theirs to give.
   */
  readonly logo?: string;
  /**
   * The stories' measured heights, the address of the file `forgebook-heights` writes (relative to the page): a story's
   * box waits at its height while it loads. None by default, and a missing file is none: boxes then wait at a guess.
   */
  readonly heights?: string;
  /** The sources, in the order the sidebar lists them. */
  readonly sources: readonly StorySource[];
  /** The frame page's address, relative to the shell's (`frame.html`). */
  readonly frameUrl: string;
  /**
   * The languages every story can be drawn in (the View menu's Language row); none turns them off. Give the frame
   * the same list.
   */
  readonly languages?: readonly StoryLanguage[];
  /**
   * The switches of the toolbar and the View menu (`switches.ts`): the theme and the contrast when none are given.
   * Give the frame the same list.
   */
  readonly switches?: readonly ViewSwitch[];
  /** The catalogue's lists (its widths, zoom steps, backgrounds, story groups…); the defaults when none. */
  readonly lists?: CatalogueLists;
};

/** The page an address names: one story, a component's page, or the home (an address that names none). */
type Page =
  | { readonly kind: "story"; readonly id: string }
  | { readonly kind: "component"; readonly id: string }
  | { readonly kind: "home" };

/** No languages: a catalogue that offers none. */
const NO_LANGUAGES: readonly StoryLanguage[] = [];

/** The home. */
const HOME: Page = { kind: "home" };

/** A page's key: the same for every view of it. */
const pageKey = (page: Page): string => (page.kind === "home" ? page.kind : `${page.kind}:${page.id}`);

/**
 * A visit of the page an address shows.
 *
 * @param address - the address.
 * @param isReturn - whether the history brought it back.
 */
const visitOf = (address: Address, isReturn: boolean): PageVisit => ({
  pageKey: pageKey(address.page),
  isReturn
});

/** The width a story that fills the stage is guessed at before the stage measures it, in CSS px. */
const FILL_WIDTH = 1440;

/** The width an example fills on a component's page: its column at its widest (`.forgebook-doc`), in CSS px. */
const PAGE_COLUMN_WIDTH = 832;

/**
 * The width a story is drawn at: the one the view sets, or, for Fill, the room it fills.
 *
 * @param width - the view's width.
 * @param fill - the width Fill gives, in CSS px.
 */
const drawnWidth = (width: StageWidth, fill: number): number => (width === "fill" ? fill : width);

/**
 * A story's measured height on its own page, at the width its stage draws it.
 *
 * @param heights - the measured heights; none when the catalogue has none.
 * @param storyId - the story's id.
 * @param width - the view's width.
 * @param shownWidth - the width the stage measured for Fill; none before it measured.
 */
const stageHeight = (
  heights: StoryHeights | undefined,
  storyId: string,
  width: StageWidth,
  shownWidth: number | undefined
): number | undefined => knownHeight(heights, storyId, drawnWidth(width, shownWidth ?? FILL_WIDTH));

/**
 * The page, the view, the panel's values and the matrix's axes an address names; the values and the axes belong to a
 * story's page.
 */
type Address = {
  readonly page: Page;
  readonly view: ViewState;
  readonly panelArgs: PanelArgs;
  readonly matrix: readonly string[];
};

/** The page of the address's `story` and `component` parameters: a story wins, none is the home. */
const pageOf = (story: string | null, component: string | null): Page => {
  if (story !== null) return { kind: "story", id: story };
  if (component !== null) return { kind: "component", id: component };
  return HOME;
};

/**
 * The current address.
 *
 * @param catalogue - the catalogue's switches and lists, for the view's values.
 */
const readAddress = (catalogue: ViewCatalogue): Address => {
  const params = new URLSearchParams(window.location.search);
  const story = params.get("story");
  const component = params.get("component");
  return {
    page: pageOf(story, component),
    view: parseView(window.location.search, catalogue),
    panelArgs: parsePanelArgsParam(params.get("args")),
    matrix: (params.get("matrix") ?? "").split(",").filter((name) => name !== "")
  };
};

/**
 * The query of an address.
 *
 * @param address - the page, the view, the panel's values and the matrix's axes.
 * @param switches - the catalogue's switches, for the view's values.
 */
const addressQuery = (
  { page, view, panelArgs, matrix }: Address,
  switches: readonly ViewSwitch[]
): string => {
  const params = viewParams(view, switches);
  if (page.kind === "story") params.set("story", page.id);
  if (page.kind === "component") params.set("component", page.id);
  const args = page.kind === "story" ? panelArgsParam(panelArgs) : "";
  if (args !== "") params.set("args", args);
  if (page.kind === "story" && matrix.length > 0) params.set("matrix", matrix.join(","));
  const query = params.toString();
  return query === "" ? window.location.pathname : `?${query}`;
};

/** What a page shows: a story with its place, a component's page with its place, the home, or why there is nothing. */
type Shown =
  | { readonly kind: "story"; readonly location: StoryLocation }
  | { readonly kind: "component"; readonly location: ComponentLocation }
  | { readonly kind: "home" }
  | { readonly kind: "missing"; readonly message: string };

/** What the address's page shows: a story or a component that is not there (renamed, removed) says so, never another. */
const shownPage = (tree: ReturnType<typeof storyTree>, page: Page): Shown => {
  if (page.kind === "story") {
    const location = findStory(tree, page.id);
    return location === undefined
      ? { kind: "missing", message: STRINGS.unknownStory(page.id) }
      : { kind: "story", location };
  }
  if (page.kind === "component") {
    const location = findComponent(tree, page.id);
    return location === undefined
      ? { kind: "missing", message: STRINGS.unknownComponent(page.id) }
      : { kind: "component", location };
  }
  return { kind: "home" };
};

/** The shown page as the home's recent pages list it: a story's or a component's, none for the home or a missing one. */
const recentPageOf = (shown: Shown): RecentPage | undefined => {
  if (shown.kind === "story") return { kind: "story", id: shown.location.story.id };
  if (shown.kind === "component") {
    return { kind: "component", id: componentId(shown.location.source.id, shown.location.component.title) };
  }
  return undefined;
};

/** What the sidebar marks: the shown component and story; none on the home or a missing page. */
const sidebarCurrent = (
  location: ComponentLocation | undefined,
  storyId: string | undefined
): SidebarProps["current"] =>
  location === undefined
    ? undefined
    : { sourceId: location.source.id, title: location.component.title, storyId };

/**
 * What the shown story fixes of the view, for the toolbar; nothing on any other page.
 *
 * @param fixedViews - what each story's frame reported.
 * @param shown - the page shown.
 */
const fixedOfShown = (fixedViews: ReadonlyMap<string, FixedView>, shown: Shown): FixedView =>
  shown.kind === "story" ? (fixedViews.get(shown.location.story.id) ?? NOT_FIXED) : NOT_FIXED;

/**
 * The bar above the page: the view's switches, which act on stories; on the home only the way back to a hidden
 * sidebar.
 *
 * @param props - whether the home is shown, and the toolbar's props.
 */
const ShellBar = ({ isHome, ...toolbar }: ToolbarProps & { readonly isHome: boolean }): ReactNode =>
  isHome ? (
    <div className="forgebook-toolbar">
      {toolbar.onShowSidebar === undefined ? null : (
        <ShowSidebarButton onShowSidebar={toolbar.onShowSidebar} />
      )}
    </div>
  ) : (
    <Toolbar {...toolbar} />
  );

/** A component's page, by its title. */
const componentPage = (sourceId: string, title: string): Page => ({
  kind: "component",
  id: componentId(sourceId, title)
});

/** A component the header links to: its page and its name. */
type LinkedComponent = { readonly page: Page; readonly name: string };

/**
 * The components related to the shown one (D-492), with their names.
 *
 * @param tree - the tree.
 * @param location - the shown component's place; none on the home or a missing page.
 */
const relatedComponents = (tree: StoryTree, location: ComponentLocation | undefined): LinkedComponent[] =>
  (location?.component.related ?? []).flatMap((title) => {
    if (location === undefined) return [];
    const found = findComponent(tree, componentId(location.source.id, title));
    return found === undefined
      ? []
      : [{ page: componentPage(location.source.id, title), name: found.component.name }];
  });

/**
 * The links to the related components, at the top of the page; nothing when there are none.
 *
 * @param props - the related components and how to open one.
 */
const RelatedLinks = ({
  related,
  hrefOf,
  onOpen
}: {
  readonly related: readonly LinkedComponent[];
  readonly hrefOf: (page: Page) => string;
  readonly onOpen: (page: Page) => void;
}): ReactNode =>
  related.length === 0 ? null : (
    <nav className="forgebook-header__related" aria-label={STRINGS.related}>
      <span className="forgebook-header__related-label">{STRINGS.related}</span>
      {related.map((component) => (
        <a
          key={component.name}
          className="forgebook-header__related-link"
          href={hrefOf(component.page)}
          onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onOpen(component.page);
          }}
        >
          {component.name}
        </a>
      ))}
    </nav>
  );

/**
 * What scrolls above a page: the index's problems, and the component's place and name, or why nothing is shown.
 *
 * @remarks
 * The place is always where the component lives, with the other places it is listed in, so a page opened from an
 * alias entry says where it really sits; its related components follow its name (D-492).
 *
 * @param props - the problems, the shown component's place, the message when a named page is missing, the picker
 * of the component's stories, and the related components.
 */
const ShellHeader = ({
  problems,
  location,
  message,
  picker,
  related
}: {
  readonly problems: readonly string[];
  readonly location: ComponentLocation | undefined;
  readonly message: string | undefined;
  readonly picker: ReactNode;
  readonly related: ReactNode;
}): ReactNode => (
  <>
    {problems.length > 0 ? (
      <div className="forgebook-problems" role="alert">
        <strong>{STRINGS.indexProblems}</strong>
        <ul>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {message === undefined ? null : (
      <p className="forgebook-empty" role="alert">
        {message}
      </p>
    )}
    {location === undefined ? null : (
      <header className="forgebook-header">
        <p className="forgebook-header__path">
          {[location.source.name, location.family.name, location.group.name]
            .filter((part) => part !== undefined)
            .join(" · ")}
          {location.component.alsoIn.length === 0 ? null : (
            <span className="forgebook-header__also-in">
              {" · "}
              {STRINGS.alsoIn(
                location.component.alsoIn.map((place) => place.split("/").join(" › ")).join(", ")
              )}
            </span>
          )}
        </p>
        <div className="forgebook-header__row">
          <h1 className="forgebook-header__title">{location.component.name}</h1>
          {picker}
        </div>
        {related}
      </header>
    )}
  </>
);

/** A story's page. */
const storyPage = (story: TreeStory): Page => ({ kind: "story", id: story.id });

/** The address and how to change it: a new page as a new history entry, a change of the shown page in place. */
type AddressState = {
  /** The current address. */
  readonly address: Address;
  /** The visit of its page: a new one for each page opened and each move of the history, not for a change in place. */
  readonly visit: PageVisit;
  /** A page's address, with the current view: another page starts without the panel's values and the matrix. */
  readonly pageAddress: (page: Page) => Address;
  /** Opens a page, as a new entry of the history. */
  readonly openPage: (page: Page) => void;
  /** Changes the shown page's address (the view, the panel's values), in place. */
  readonly replaceAddress: (next: Address) => void;
};

/** The address, read again when the history goes back or forth. */
const useAddress = (catalogue: CatalogueSettings): AddressState => {
  const { switches } = catalogue;
  const [address, setAddress] = useState<Address>(() => readAddress(catalogue));
  const [visit, setVisit] = useState<PageVisit>(() => visitOf(address, false));
  useEffect(() => {
    const onBack = (): void => {
      const next = readAddress(catalogue);
      setAddress(next);
      setVisit(visitOf(next, true));
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [catalogue]);
  // a height set with the foot handle belongs to the story it was set on: another page starts at its own (D-515)
  const pageAddress = (page: Page): Address => ({
    page,
    view: { ...address.view, height: "auto" },
    panelArgs: {},
    matrix: []
  });
  return {
    address,
    visit,
    pageAddress,
    openPage: (page: Page): void => {
      const next = pageAddress(page);
      window.history.pushState(null, "", addressQuery(next, switches));
      setAddress(next);
      setVisit(visitOf(next, false));
    },
    replaceAddress: (next: Address): void => {
      window.history.replaceState(null, "", addressQuery(next, switches));
      setAddress(next);
    }
  };
};

/**
 * The catalogue's page inside its settings: everything below reads them, the shell's own hooks (the sidebar's width,
 * the keys, the recent pages) included.
 *
 * @param props - the configuration.
 */
const ShellPage = ({ title, logo, heights, sources, frameUrl }: ShellConfig): ReactNode => {
  const tree = useMemo(() => storyTree(sources), [sources]);
  const {
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen
  } = useSidebarLayout();
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const { address, visit, pageAddress, openPage, replaceAddress } = useAddress(catalogue);
  // each page's last scroll position, kept across the component pages and the stage
  const scrollPositions = useRef(new Map<string, number>());
  const scroll: PageScroll = { visit, positions: scrollPositions.current };
  // the width the shown story really has, measured on its stage, for the toolbar's width field
  const [shownWidth, setShownWidth] = useState<number | undefined>(undefined);
  // what each story fixes of the view, as its frame reported it: the toolbar shows it for the shown story
  const [fixedViews, setFixedViews] = useState<ReadonlyMap<string, FixedView>>(new Map());
  const storyHeights = useStoryHeights(heights);
  const isSystemDark = useSystemDark();
  useStoryIdsElement(
    useMemo(
      () =>
        sidebarStoryIds(
          tree,
          catalogue.storyGroups.map((group) => group.id)
        ),
      [tree, catalogue.storyGroups]
    )
  );

  const shown = shownPage(tree, address.page);
  const location = shown.kind === "story" || shown.kind === "component" ? shown.location : undefined;
  const recent = useRecentPages(recentPageOf(shown));

  useEffect(() => {
    document.title = location === undefined ? title : `${location.component.name} · ${title}`;
  }, [location, title]);

  const changeView = (view: ViewState): void => replaceAddress({ ...address, view });
  const shownStoryId = shown.kind === "story" ? shown.location.story.id : undefined;

  useStoryKeys(
    tree,
    shownStoryId,
    shown.kind === "component" ? shown.location.component.stories[0]?.id : undefined,
    (id: string): void => openPage({ kind: "story", id })
  );

  const source = sources.find((candidate) => candidate.id === location?.source.id);
  const files = source === undefined ? undefined : sourceFiles(source);
  const header = (
    <ShellHeader
      problems={tree.problems}
      location={location}
      message={shown.kind === "missing" ? shown.message : undefined}
      picker={
        location === undefined ? null : (
          <StoryPicker
            component={location.component}
            currentStoryId={shownStoryId}
            onOpenComponent={(): void =>
              openPage(componentPage(location.source.id, location.component.title))
            }
            onOpenStory={(story: TreeStory): void => openPage(storyPage(story))}
          />
        )
      }
      related={
        <RelatedLinks
          related={relatedComponents(tree, location)}
          hrefOf={(page: Page): string => addressQuery(pageAddress(page), switches)}
          onOpen={openPage}
        />
      }
    />
  );

  return (
    <div className="catalogue">
      <Sidebar
        width={sidebarWidth}
        isOpen={isSidebarOpen}
        onHide={(): void => setIsSidebarOpen(false)}
        title={title}
        logo={logo}
        tree={tree}
        isHome={shown.kind === "home"}
        homeHref={addressQuery(pageAddress(HOME), switches)}
        onOpenHome={(): void => openPage(HOME)}
        current={sidebarCurrent(location, shownStoryId)}
        componentHref={(sourceId: string, componentTitle: string): string =>
          addressQuery(pageAddress(componentPage(sourceId, componentTitle)), switches)
        }
        onOpenComponent={(sourceId: string, componentTitle: string): void =>
          openPage(componentPage(sourceId, componentTitle))
        }
      />
      {isSidebarOpen ? <SidebarHandle width={sidebarWidth} onWidthChange={setSidebarWidth} /> : null}
      <main className="forgebook-main">
        <ShellBar
          isHome={shown.kind === "home"}
          view={address.view}
          onViewChange={changeView}
          isStoryPage={shown.kind === "story"}
          onShowSidebar={isSidebarOpen ? undefined : (): void => setIsSidebarOpen(true)}
          shownWidth={shown.kind === "story" ? shownWidth : undefined}
          fixed={fixedOfShown(fixedViews, shown)}
        />
        {shown.kind === "home" ? (
          <HomePage
            title={title}
            tree={tree}
            sources={sources}
            recent={recent}
            hrefOf={(page: RecentPage): string => addressQuery(pageAddress(page), switches)}
            onOpen={(page: RecentPage): void => openPage(page)}
            header={header}
          />
        ) : null}
        {shown.kind === "component" ? (
          <ComponentPage
            component={shown.location.component}
            view={address.view}
            frameUrl={frameUrl}
            hrefOf={(story: TreeStory): string => addressQuery(pageAddress(storyPage(story)), switches)}
            onOpen={(story: TreeStory): void => openPage(storyPage(story))}
            loadDocs={files?.docs[shown.location.component.file]}
            loadCode={files?.code[shown.location.component.file]}
            loadPage={files?.pages[shown.location.component.file]}
            background={storyBackground(
              shown.location.source.background,
              address.view,
              catalogue,
              isSystemDark
            )}
            heightOf={(storyId: string): number | undefined =>
              knownHeight(storyHeights, storyId, drawnWidth(address.view.width, PAGE_COLUMN_WIDTH))
            }
            header={header}
            scroll={scroll}
          />
        ) : null}
        {shown.kind === "story" ? (
          <Stage
            component={shown.location.component}
            story={shown.location.story}
            view={address.view}
            onViewChange={changeView}
            onFixedChange={(storyId: string, fixed: FixedView): void =>
              setFixedViews((current) => new Map(current).set(storyId, fixed))
            }
            panelArgs={address.panelArgs}
            onPanelArgsChange={(panelArgs: PanelArgs): void => replaceAddress({ ...address, panelArgs })}
            matrixAxes={address.matrix}
            onMatrixAxesChange={(matrix: readonly string[]): void => replaceAddress({ ...address, matrix })}
            frameUrl={frameUrl}
            loadCode={files?.code[shown.location.component.file]}
            loadDocs={files?.docs[shown.location.component.file]}
            namedValues={source?.namedValues}
            header={header}
            onShownWidthChange={setShownWidth}
            scroll={scroll}
            backgroundOf={(view: Pick<ViewState, "switches" | "backdrop">): string | undefined =>
              storyBackground(shown.location.source.background, view, catalogue, isSystemDark)
            }
            measuredHeight={stageHeight(
              storyHeights,
              shown.location.story.id,
              address.view.width,
              shownWidth
            )}
          />
        ) : null}
        {shown.kind === "missing" ? header : null}
      </main>
    </div>
  );
};

/**
 * The catalogue's page: its settings computed once from the configuration (its switches, its languages' switch, its
 * lists) and provided to the whole page.
 *
 * @param props - the configuration.
 */
export const Shell = (props: ShellConfig): ReactNode => {
  const { title, switches, languages = NO_LANGUAGES, lists } = props;
  const catalogue = useMemo(
    () => catalogueSettings(title, catalogueSwitches(switches, languages), lists),
    [title, switches, languages, lists]
  );
  return (
    <CatalogueContext.Provider value={catalogue}>
      <ShellPage {...props} />
    </CatalogueContext.Provider>
  );
};
