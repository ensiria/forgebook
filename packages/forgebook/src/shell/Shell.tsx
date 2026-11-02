/**
 * The catalogue's page: the sidebar, the toolbar, the component's header and either the component's page (every
 * story) or one story's stage, with the page and the view kept in the address.
 *
 * @module
 */
/* eslint-disable max-lines -- the page, its address and its keys; split by what it does when next touched */

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import {
  type ComponentType,
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { type CatalogueLists, type CatalogueSettings, catalogueSettings } from "../catalogue.ts";
import { type PanelArgs, panelArgsParam, parsePanelArgsParam } from "../messages.ts";
import { anchorOf } from "../pageAddress.ts";
import { findPage, type PageLocation } from "../pageTree.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { storyBackground } from "../storyBackground.ts";
import { type FixedView, NOT_FIXED } from "../storyGlobals.ts";
import { knownHeight, type StoryHeights } from "../storyHeights.ts";
import {
  type ComponentLocation,
  componentId,
  findComponent,
  findStory,
  isLogicComponent,
  type StoryLocation,
  type StoryTree,
  sidebarStoryIds,
  storyTree,
  type TreeComponent,
  type TreeSource,
  type TreeStory
} from "../storyTree.ts";
import { catalogueSwitches, type ViewSwitch } from "../switches.ts";
import { usageLoader } from "../usedIn.ts";
import { parseView, type StageWidth, type ViewCatalogue, type ViewState, viewParams } from "../viewState.ts";
import type { WrittenHomeProps } from "./AuthoredHome.tsx";
import { ComponentPage } from "./ComponentPage.tsx";
import { CatalogueContext, useCatalogue } from "./catalogueContext.ts";
import { LogicMark } from "./LogicMark.tsx";
import { Sidebar, type SidebarProps } from "./Sidebar.tsx";
import { SidebarHandle } from "./SidebarHandle.tsx";
import { Stage } from "./Stage.tsx";
import { StoryPicker } from "./StoryPicker.tsx";
import type { TouchOverrides } from "./storyTouch.ts";
import { STRINGS } from "./strings.ts";
import { ShowSidebarButton, Toolbar, type ToolbarProps } from "./Toolbar.tsx";
import type { UsedInProps } from "./UsedIn.tsx";
import { useAppearance } from "./useAppearance.ts";
import { type RecentPage, useRecentPages } from "./useRecentPages.ts";
import type { PageScroll, PageVisit } from "./useScrollMemory.ts";
import { useShownView } from "./useShownView.ts";
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
  /**
   * The catalogue's written home (`forgebook.home.md`), drawn in place of the generated home: the page's entry makes
   * it, lazily, only for a catalogue that has one, so the others' first load carries nothing of it. None keeps the
   * generated home.
   */
  readonly home?: ComponentType<WrittenHomeProps>;
};

/** A docs page, loaded on first use: a catalogue may have none. */
const DocPage = lazy(() => import("./DocPage.tsx").then((module) => ({ default: module.DocPage })));

/**
 * The generated home, loaded on first use: a story or a component opened from its address, as a link shares one, pays
 * nothing for it.
 */
const HomePage = lazy(() => import("./HomePage.tsx").then((module) => ({ default: module.HomePage })));

/**
 * The page an address names: one story, a component's page, a docs page with the heading it opens at, or the home (an
 * address that names none).
 */
type Page =
  | { readonly kind: "story"; readonly id: string }
  | { readonly kind: "component"; readonly id: string }
  | { readonly kind: "page"; readonly id: string; readonly anchor?: string | undefined }
  | { readonly kind: "home" };

/** No languages: a catalogue that offers none. */
const NO_LANGUAGES: readonly StoryLanguage[] = [];

/** The home. */
const HOME: Page = { kind: "home" };

/** A page's key: the same for every view of it. */
const pageKey = (page: Page): string => {
  if (page.kind === "home") return page.kind;
  // a heading is a place of its own in the history: Back from it returns to where the reader was
  return page.kind === "page" ? `page:${page.id}#${page.anchor ?? ""}` : `${page.kind}:${page.id}`;
};

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

/**
 * The page an address's query and fragment name: a story wins, then a component, then a docs page; none is the home.
 *
 * @param search - the address's query.
 * @param hash - its fragment.
 */
const pageOf = (search: string, hash: string): Page => {
  const params = new URLSearchParams(search);
  const story = params.get("story");
  const component = params.get("component");
  const page = params.get("page");
  if (story !== null) return { kind: "story", id: story };
  if (component !== null) return { kind: "component", id: component };
  if (page !== null) return { kind: "page", id: page, anchor: anchorOf(hash.replace(/^#/, "")) };
  return HOME;
};

/**
 * The current address.
 *
 * @param catalogue - the catalogue's switches and lists, for the view's values.
 */
const readAddress = (catalogue: ViewCatalogue): Address => {
  const params = new URLSearchParams(window.location.search);
  return {
    page: pageOf(window.location.search, window.location.hash),
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
  if (page.kind === "page") params.set("page", page.id);
  const args = page.kind === "story" ? panelArgsParam(panelArgs) : "";
  if (args !== "") params.set("args", args);
  if (page.kind === "story" && matrix.length > 0) params.set("matrix", matrix.join(","));
  const query = params.toString();
  // the fragment is part of what is written back on every change of the view, or a change would lose the heading
  const fragment =
    page.kind === "page" && page.anchor !== undefined ? `#${encodeURIComponent(page.anchor)}` : "";
  return `${query === "" ? window.location.pathname : `?${query}`}${fragment}`;
};

/** What a page shows: a story, a component's page or a docs page with its place, the home, or why there is nothing. */
type Shown =
  | { readonly kind: "story"; readonly location: StoryLocation }
  | { readonly kind: "component"; readonly location: ComponentLocation }
  | { readonly kind: "page"; readonly location: PageLocation; readonly anchor: string | undefined }
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
  if (page.kind === "page") {
    const location = findPage(tree, page.id);
    return location === undefined
      ? { kind: "missing", message: STRINGS.unknownPage(page.id) }
      : { kind: "page", location, anchor: page.anchor };
  }
  return { kind: "home" };
};

/** The shown page as the home's recent pages list it: a story's or a component's, none for the home or a missing one. */
const recentPageOf = (shown: Shown): RecentPage | undefined => {
  if (shown.kind === "story") return { kind: "story", id: shown.location.story.id };
  if (shown.kind === "component") {
    return { kind: "component", id: componentId(shown.location.source.id, shown.location.component.title) };
  }
  return shown.kind === "page" ? { kind: "page", id: shown.location.page.id } : undefined;
};

/**
 * Whether the shown page is about logic: a story about logic, or a component whose stories all are.
 *
 * @param shown - the shown page.
 */
const isLogicPage = (shown: Shown): boolean => {
  if (shown.kind === "story") return shown.location.story.isLogic;
  return shown.kind === "component" && isLogicComponent(shown.location.component);
};

/** The shown component's place, a story's too; none on any other page. */
const componentLocationOf = (shown: Shown): ComponentLocation | undefined =>
  shown.kind === "story" || shown.kind === "component" ? shown.location : undefined;

/** The shown docs page's place; none on any other page. */
const pageLocationOf = (shown: Shown): PageLocation | undefined =>
  shown.kind === "page" ? shown.location : undefined;

/** Whether nothing shown follows the view's switches: the home, or a docs page without a story. */
const hasNoStories = (shown: Shown): boolean =>
  shown.kind === "home" || (shown.kind === "page" && shown.location.page.stories.length === 0);

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

/**
 * What "Used in" reads and opens on a source's component pages: its usage, its components by title, and their pages;
 * none without a source (the catalogue turned it off, or no component is shown).
 *
 * @param source - the shown component's source.
 * @param isOffered - whether the catalogue offers "Used in".
 * @param tree - the tree.
 * @param pages - a page's address and how it opens.
 */
const usedInLinks = (
  source: StorySource | undefined,
  isOffered: boolean,
  tree: StoryTree,
  pages: { readonly hrefOf: (page: Page) => string; readonly onOpen: (page: Page) => void }
): Omit<UsedInProps, "title"> | undefined =>
  source === undefined || !isOffered
    ? undefined
    : {
        load: usageLoader(source),
        componentOf: (title: string): TreeComponent | undefined =>
          findComponent(tree, componentId(source.id, title))?.component,
        componentHrefOf: (component: TreeComponent): string =>
          pages.hrefOf(componentPage(source.id, component.title)),
        onOpenComponent: (component: TreeComponent): void =>
          pages.onOpen(componentPage(source.id, component.title)),
        storyHrefOf: (story: TreeStory): string => pages.hrefOf(storyPage(story)),
        onOpenStory: (story: TreeStory): void => pages.onOpen(storyPage(story))
      };

/** A component the header links to: its page and its name. */
type LinkedComponent = { readonly page: Page; readonly name: string };

/**
 * The components related to the shown one, with their names.
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
 * What scrolls above a page: the index's problems, and the component's or the docs page's place and name, or why
 * nothing is shown.
 *
 * @remarks
 * The place is always where the component lives, with the other places it is listed in, so a page opened from an
 * alias entry says where it really sits; its related components follow its name.
 *
 * @param props - the problems, the shown component's place, the message when a named page is missing, the picker
 * of the component's stories, and the related components.
 */
const ShellHeader = ({
  problems,
  location,
  page,
  message,
  picker,
  related,
  isLogic
}: {
  readonly problems: readonly string[];
  readonly location: ComponentLocation | undefined;
  /** The shown docs page; none on any other page. */
  readonly page: PageLocation | undefined;
  readonly message: string | undefined;
  readonly picker: ReactNode;
  readonly related: ReactNode;
  /** Whether the page is about logic (the story, or every story of the component): marked beside the title. */
  readonly isLogic: boolean;
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
          {isLogic ? <LogicMark /> : null}
          {picker}
        </div>
        {related}
      </header>
    )}
    {page === undefined ? null : (
      <header className="forgebook-header">
        <p className="forgebook-header__path">
          {[page.source.name, page.page.group].filter((part) => part !== undefined).join(" · ")}
        </p>
        <div className="forgebook-header__row">
          <h1 className="forgebook-header__title">{page.page.name}</h1>
        </div>
      </header>
    )}
  </>
);

/** A story's page. */
const storyPage = (story: TreeStory): Page => ({ kind: "story", id: story.id });

/**
 * Opens the page an address of the catalogue names, written in a docs page's text.
 *
 * @param href - the address.
 * @param openPage - opens a page.
 * @returns whether it names one.
 */
const openLinkedPage = (href: string, openPage: (page: Page) => void): boolean => {
  const { search, hash } = new URL(href, window.location.href);
  const page = pageOf(search, hash);
  if (page.kind === "home") return false;
  openPage(page);
  return true;
};

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
  /** Goes to a heading of the shown docs page, as a new entry of the history. */
  readonly openAnchor: (anchor: string) => void;
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
  // a height set with the foot handle belongs to the story it was set on: another page starts at its own
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
    openAnchor: (anchor: string): void => {
      if (address.page.kind !== "page") return;
      const next = { ...address, page: { ...address.page, anchor } };
      window.history.pushState(null, "", addressQuery(next, switches));
      setAddress(next);
      setVisit({ ...visitOf(next, false), isInPage: true });
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
const ShellPage = ({ title, logo, heights, sources, frameUrl, home }: ShellConfig): ReactNode => {
  const tree = useMemo(() => storyTree(sources), [sources]);
  const {
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen
  } = useSidebarLayout();
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const { address, visit, pageAddress, openPage, openAnchor, replaceAddress } = useAddress(catalogue);
  // each page's last scroll position, kept across the component pages and the stage
  const scrollPositions = useRef(new Map<string, number>());
  const scroll: PageScroll = { visit, positions: scrollPositions.current };
  // the width the shown story really has, measured on its stage, for the toolbar's width field
  const [shownWidth, setShownWidth] = useState<number | undefined>(undefined);
  // what each story fixes of the view, as its frame reported it: the toolbar shows it for the shown story
  const [fixedViews, setFixedViews] = useState<ReadonlyMap<string, FixedView>>(new Map());
  const storyHeights = useStoryHeights(heights);
  // what the user chose for each story marked for a phone, while the catalogue is open
  const [touchOverrides, setTouchOverrides] = useState<TouchOverrides>(new Map());
  const setTouchOverride = (storyId: string, isTouch: boolean): void =>
    setTouchOverrides((current) => new Map(current).set(storyId, isTouch));
  const isSystemDark = useSystemDark();
  const appearance = useAppearance(address.view, catalogue.switches);
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
  const location = componentLocationOf(shown);
  const recent = useRecentPages(recentPageOf(shown));
  const shownPageLocation = pageLocationOf(shown);
  const pageName = shownPageLocation?.page.name ?? location?.component.name;

  useEffect(() => {
    document.title = pageName === undefined ? title : `${pageName} · ${title}`;
  }, [pageName, title]);

  const changeView = (view: ViewState): void => replaceAddress({ ...address, view });
  // a story marked for a phone has its own Touch on its page, and a story about logic is never compared
  const shownStory = shown.kind === "story" ? shown.location.story : undefined;
  const shownStoryId = shownStory?.id;
  const { view: shownView, onViewChange: changeShownView } = useShownView({
    addressView: address.view,
    story: shownStory,
    touchOverrides,
    onTouchChange: setTouchOverride,
    touch: catalogue.touch,
    onAddressViewChange: changeView
  });

  useStoryKeys(
    tree,
    shownStoryId,
    shown.kind === "component" ? shown.location.component.stories[0]?.id : undefined,
    (id: string): void => openPage({ kind: "story", id })
  );

  const source = sources.find((candidate) => candidate.id === location?.source.id);
  const files = source === undefined ? undefined : sourceFiles(source);
  const storyHrefOf = (story: TreeStory): string => addressQuery(pageAddress(storyPage(story)), switches);
  const columnHeightOf = (storyId: string): number | undefined =>
    knownHeight(storyHeights, storyId, drawnWidth(address.view.width, PAGE_COLUMN_WIDTH));
  const header = (
    <ShellHeader
      problems={tree.problems}
      location={location}
      page={shownPageLocation}
      isLogic={isLogicPage(shown)}
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

  const Home = home ?? HomePage;
  const homeProps = {
    title,
    tree,
    sources,
    recent,
    hrefOf: (page: RecentPage): string => addressQuery(pageAddress(page), switches),
    onOpen: (page: RecentPage): void => openPage(page),
    header
  };
  const docProps = {
    title,
    tree,
    sources,
    view: address.view,
    touchOverrides,
    onTouchChange: setTouchOverride,
    frameUrl,
    storyHrefOf,
    onOpenStory: (story: TreeStory): void => openPage(storyPage(story)),
    pageHrefOf: (id: string, anchor: string | undefined): string =>
      addressQuery(pageAddress({ kind: "page", id, anchor }), switches),
    onOpenAddress: (href: string): boolean => openLinkedPage(href, openPage),
    heightOf: columnHeightOf,
    backgroundOf: (pageSource: TreeSource): string | undefined =>
      storyBackground(pageSource.background, address.view, catalogue, isSystemDark),
    header,
    scroll
  };

  return (
    <div className="catalogue">
      <Sidebar
        width={sidebarWidth}
        isOpen={isSidebarOpen}
        onHide={(): void => setIsSidebarOpen(false)}
        appearance={appearance}
        title={title}
        logo={logo}
        tree={tree}
        isHome={shown.kind === "home"}
        homeHref={addressQuery(pageAddress(HOME), switches)}
        onOpenHome={(): void => openPage(HOME)}
        current={sidebarCurrent(location, shownStoryId)}
        currentPageId={shownPageLocation?.page.id}
        pageHref={(id: string): string => addressQuery(pageAddress({ kind: "page", id }), switches)}
        onOpenPage={(id: string): void => openPage({ kind: "page", id })}
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
          isHome={hasNoStories(shown)}
          view={shownView}
          onViewChange={changeShownView}
          isStoryPage={shown.kind === "story"}
          isLogic={isLogicPage(shown)}
          onShowSidebar={isSidebarOpen ? undefined : (): void => setIsSidebarOpen(true)}
          shownWidth={shown.kind === "story" ? shownWidth : undefined}
          fixed={fixedOfShown(fixedViews, shown)}
        />
        {shown.kind === "component" ? (
          <ComponentPage
            component={shown.location.component}
            view={address.view}
            touchOverrides={touchOverrides}
            onTouchChange={setTouchOverride}
            frameUrl={frameUrl}
            hrefOf={storyHrefOf}
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
            heightOf={columnHeightOf}
            header={header}
            scroll={scroll}
            usedIn={usedInLinks(source, catalogue.hasUsedIn, tree, {
              hrefOf: (page: Page): string => addressQuery(pageAddress(page), switches),
              onOpen: openPage
            })}
          />
        ) : null}
        {/* the pages loaded on first use: the home, generated or written, and a docs page; keyed by the kind of page, so
            the home left behind is never kept, hidden, beside the docs page that loads */}
        <Suspense key={shown.kind} fallback={<div className="forgebook-workspace">{header}</div>}>
          {shown.kind === "home" ? <Home {...homeProps} {...docProps} /> : null}
          {shown.kind === "page" ? (
            // keyed by the page: its frames, its text and its scrolling element are that page's alone
            <DocPage
              {...docProps}
              key={shown.location.page.id}
              location={shown.location}
              anchor={shown.anchor}
              onOpenPage={(id: string): void => openPage({ kind: "page", id })}
              onOpenAnchor={openAnchor}
            />
          ) : null}
        </Suspense>
        {shown.kind === "story" ? (
          <Stage
            component={shown.location.component}
            story={shown.location.story}
            view={shownView}
            onViewChange={changeShownView}
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
    () => catalogueSettings(title, catalogueSwitches(switches, languages, lists?.controls), lists),
    [title, switches, languages, lists]
  );
  return (
    <CatalogueContext.Provider value={catalogue}>
      <ShellPage {...props} />
    </CatalogueContext.Provider>
  );
};
