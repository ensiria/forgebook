/**
 * The catalogue's page: the sidebar, the toolbar, the component's header and either the component's page (every
 * story) or one story's stage, with the page and the view kept in the address.
 *
 * @module
 */
/* eslint-disable max-lines -- the page, its address and its keys; split by what it does when next touched */

import type { StoryFiles, StoryLanguage, StorySource } from "@forgebook/story-format/source";
import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { type AddressTexts, addressArgsFor } from "../addressTexts.ts";
import type { CatalogueLists, CatalogueSettings } from "../catalogue.ts";
import { type DeviceDefault, deviceDefaultOf, pageDeviceDefault } from "../deviceView.ts";
import { type PanelArgs, panelArgsParam, parsePanelArgsParam } from "../messages.ts";
import { anchorOf } from "../pageAddress.ts";
import { findPage, type PageLocation } from "../pageTree.ts";
import type { SearchTarget } from "../search.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { storyBackground } from "../storyBackground.ts";
import { type FixedView, NOT_FIXED } from "../storyGlobals.ts";
import { knownHeight, type StoryHeights } from "../storyHeights.ts";
import {
  type ComponentLocation,
  componentId,
  findComponent,
  findComponentByTitle,
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
import type { ViewSwitch } from "../switches.ts";
import { parseView, type StageWidth, type ViewCatalogue, type ViewState, viewParams } from "../viewState.ts";
import type { WrittenHomeProps } from "./AuthoredHome.tsx";
import type { ComponentPageProps } from "./ComponentPage.tsx";
import { CatalogueContext, NO_PLUGINS, useCatalogue, useConfiguredCatalogue } from "./catalogueContext.ts";
import type { DocPageProps } from "./DocPage.tsx";
import { filesCodeLoader } from "./filesCode.ts";
import type { HomePageProps } from "./HomePage.tsx";
import { Icon } from "./icons.tsx";
import { LazyPage } from "./LazyPage.tsx";
import { LogicMark } from "./LogicMark.tsx";
import { type LazyModule, lazyModule } from "./lazyModule.tsx";
import { type LoadPluginHosts, PluginHostsContext } from "./pluginHostsContext.ts";
import type { ShellPlugin } from "./pluginTabs.tsx";
import { Sidebar, type SidebarProps } from "./Sidebar.tsx";
import { SidebarEdge } from "./SidebarHandle.tsx";
import { Stage } from "./Stage.tsx";
import { StoryPicker } from "./StoryPicker.tsx";
import type { TouchOverrides } from "./storyTouch.ts";
import { STRINGS } from "./strings.ts";
import { ShowSidebarButton, Toolbar, type ToolbarProps } from "./Toolbar.tsx";
import type { UsedInProps } from "./UsedIn.tsx";
import { useAppearance } from "./useAppearance.ts";
import { useEditedProblems } from "./useEditedProblems.ts";
import { type RecentPage, useRecentPages } from "./useRecentPages.ts";
import type { PageScroll, PageVisit } from "./useScrollMemory.ts";
import { useShownView } from "./useShownView.ts";
import { useSidebarLayout } from "./useSidebarLayout.ts";
import { useSidebarOverlay } from "./useSidebarOverlay.ts";
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
   * default: Forgebook's mark. The catalogue belongs to whoever mounts it, so the logo is theirs to give.
   */
  readonly logo?: string;
  /** Whether a catalogue without a logo shows Forgebook's mark; off, it shows its name alone. On by default. */
  readonly hasBranding?: boolean;
  /**
   * The stories' measured heights, the address of the file `forgebook-heights` writes (relative to the page): a story's
   * box waits at its height while it loads. None by default, and a missing file is none: boxes then wait at a guess.
   */
  readonly heights?: string;
  /** The sources, in the order the sidebar lists them. */
  readonly sources: readonly StorySource[];
  /**
   * The frame page's address: relative to the shell's (`frame.html`) when the frames share its origin, on the frames'
   * origin otherwise (`mountShell` makes it).
   */
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
   * Loads the catalogue's written home (`forgebook.home.md`), drawn in place of the generated home: the page's entry
   * gives it only for a catalogue that has one, so the others' first load carries nothing of it. None keeps the
   * generated home.
   */
  readonly home?: () => Promise<ComponentType<WrittenHomeProps>>;
  /** Loads the catalogue's design tokens, on first use; none when it has none. */
  readonly loadTokens?: () => Promise<unknown>;
  /** The plugins with views (the generated page passes them); none by default. */
  readonly plugins?: readonly ShellPlugin[];
  /**
   * Loads the code that draws the plugins' views (`forgebook/shell/plugin-hosts`): the generated page gives it only
   * with plugins that have views, so a catalogue without one ships none of it. None draws no plugin's view.
   */
  readonly pluginHosts?: LoadPluginHosts;
  /**
   * How the framework's stories take the texts the address carries (`addressTexts.ts`): `plain` keeps a shared link's
   * texts that are not plain words from a story that may write them into markup. `any` by default.
   */
  readonly addressTexts?: AddressTexts;
};

/** A docs page, loaded on first use: a catalogue may have none. */
const DOC_PAGE = lazyModule<DocPageProps>(() => import("./DocPage.tsx").then((module) => module.DocPage));

/** The home, loaded when it is opened. */
const HOME_PAGE = lazyModule<HomePageProps>(() => import("./HomePage.tsx").then((module) => module.HomePage));

/** A component's page, loaded when one is opened. */
const COMPONENT_PAGE = lazyModule<ComponentPageProps>(() =>
  import("./ComponentPage.tsx").then((module) => module.ComponentPage)
);

/**
 * The home: the catalogue's written one when it has one, the generated one otherwise, each loaded when first opened.
 *
 * @param props - the written home's module, if any, and each home's props.
 */
const ShellHome = ({
  written,
  home,
  writtenProps
}: {
  readonly written: LazyModule<WrittenHomeProps> | undefined;
  readonly home: HomePageProps;
  readonly writtenProps: WrittenHomeProps;
}): ReactNode =>
  written === undefined ? (
    <LazyPage module={HOME_PAGE} header={home.header} pageProps={home} />
  ) : (
    <LazyPage module={written} header={home.header} pageProps={writtenProps} />
  );

/**
 * The page an address names: one story, a component's page or a docs page with the heading or prop it opens at, or the
 * home (an address that names none).
 */
type Page =
  | { readonly kind: "story"; readonly id: string }
  | { readonly kind: "component"; readonly id: string; readonly anchor?: string | undefined }
  | { readonly kind: "page"; readonly id: string; readonly anchor?: string | undefined }
  | { readonly kind: "home" };

/** The home. */
const HOME: Page = { kind: "home" };

/** A page's key: the same for every view of it. */
const pageKey = (page: Page): string => {
  if (page.kind === "home") return page.kind;
  // a heading is a place of its own in the history: Back from it returns to where the reader was
  return page.kind === "story" ? `story:${page.id}` : `${page.kind}:${page.id}#${page.anchor ?? ""}`;
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
  const anchor = anchorOf(hash.replace(/^#/, ""));
  if (component !== null) return { kind: "component", id: component, anchor };
  if (page !== null) return { kind: "page", id: page, anchor };
  return HOME;
};

/**
 * The current address.
 *
 * @param catalogue - the catalogue's switches and lists, for the view's values.
 * @param addressTexts - how the framework's stories take the texts of the panel's values.
 */
const readAddress = (catalogue: ViewCatalogue, addressTexts: AddressTexts): Address => {
  const params = new URLSearchParams(window.location.search);
  return {
    page: pageOf(window.location.search, window.location.hash),
    view: parseView(window.location.search, catalogue),
    panelArgs: addressArgsFor(parsePanelArgsParam(params.get("args")), addressTexts),
    matrix: (params.get("matrix") ?? "").split(",").filter((name) => name !== "")
  };
};

/** What an address's query reads of the catalogue. */
type AddressCatalogue = Pick<CatalogueSettings, "switches" | "audience">;

/**
 * The query of an address.
 *
 * @param address - the page, the view, the panel's values and the matrix's axes.
 * @param catalogue - the catalogue's switches and default audience, for the view's values.
 */
const addressQuery = ({ page, view, panelArgs, matrix }: Address, catalogue: AddressCatalogue): string => {
  const params = viewParams(view, catalogue.switches, catalogue.audience);
  if (page.kind === "story") params.set("story", page.id);
  if (page.kind === "component") params.set("component", page.id);
  if (page.kind === "page") params.set("page", page.id);
  const args = page.kind === "story" ? panelArgsParam(panelArgs) : "";
  if (args !== "") params.set("args", args);
  if (page.kind === "story" && matrix.length > 0) params.set("matrix", matrix.join(","));
  const query = params.toString();
  // the fragment is part of what is written back on every change of the view, or a change would lose the heading
  const fragment =
    (page.kind === "page" || page.kind === "component") && page.anchor !== undefined
      ? `#${encodeURIComponent(page.anchor)}`
      : "";
  return `${query === "" ? window.location.pathname : `?${query}`}${fragment}`;
};

/** What a page shows: a story, a component's page or a docs page with its place, the home, or why there is nothing. */
type Shown =
  | { readonly kind: "story"; readonly location: StoryLocation }
  | { readonly kind: "component"; readonly location: ComponentLocation; readonly anchor: string | undefined }
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
      : { kind: "component", location, anchor: page.anchor };
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
    return { kind: "component", id: shown.location.component.id };
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
 * The page's default device for the toolbar: the shown story's, a component's stories' on its page (`pageDeviceDefault`),
 * the catalogue's elsewhere.
 *
 * @param catalogueDevice - the catalogue's default.
 * @param shown - the page shown.
 */
const deviceOfShown = (catalogueDevice: DeviceDefault, shown: Shown): DeviceDefault => {
  if (shown.kind === "story") return deviceDefaultOf(catalogueDevice, shown.location.story.device);
  if (shown.kind === "component")
    return pageDeviceDefault(
      catalogueDevice,
      shown.location.component.stories.map((story) => story.device)
    );
  return catalogueDevice;
};

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
        <ShowSidebarButton onShowSidebar={toolbar.onShowSidebar} showSidebarRef={toolbar.showSidebarRef} />
      )}
    </div>
  ) : (
    <Toolbar {...toolbar} />
  );

/** What a page loads of its story files: the docs, the code, and for a component its page. */
type FileLoaders = {
  readonly loadDocs: (() => Promise<unknown>) | undefined;
  readonly loadCode: (() => Promise<unknown>) | undefined;
};

/**
 * What a component's page loads: its first file's docs and page, as Storybook's docs come from the first file of a
 * title, and the code of every file, for each example's Code card.
 *
 * @param files - the source's files; none without a source.
 * @param component - the component.
 */
const componentLoaders = (
  files: StoryFiles | undefined,
  component: TreeComponent
): FileLoaders & { readonly loadPage: (() => Promise<unknown>) | undefined } => ({
  loadDocs: files?.docs[component.file],
  loadCode: files === undefined ? undefined : filesCodeLoader(files.code, component.files),
  loadPage: files?.pages[component.file]
});

/**
 * What a story's page loads: its own file's code, and the docs of the component its file's meta names, which its
 * controls are for.
 *
 * @param files - the source's files; none without a source.
 * @param story - the story.
 */
const storyLoaders = (files: StoryFiles | undefined, story: TreeStory): FileLoaders => ({
  loadDocs: files?.docs[story.file],
  loadCode: files?.code[story.file]
});

/** A component's page. */
const componentPage = (component: TreeComponent): Page => ({ kind: "component", id: component.id });

/**
 * Each component's id by its source and title, made once per tree: the sidebar names a component by its title, for
 * every component on every render.
 *
 * @param tree - the tree.
 */
const componentIdsByTitle = (tree: StoryTree): ReadonlyMap<string, string> =>
  new Map(
    tree.sources.flatMap((source) =>
      source.families.flatMap((family) =>
        family.groups.flatMap((group) =>
          group.components.map((component): [string, string] => [
            `${source.id}\n${component.title}`,
            component.id
          ])
        )
      )
    )
  );

/**
 * The page of a source's component with a title, as the sidebar names a component and an alias its place; a title no
 * component has gives the id it would have, which the page reports as missing.
 *
 * @param idsByTitle - the components' ids by source and title (`componentIdsByTitle`).
 * @param sourceId - the source's id.
 * @param title - the component's title.
 */
const titledPage = (idsByTitle: ReadonlyMap<string, string>, sourceId: string, title: string): Page => ({
  kind: "component",
  id: idsByTitle.get(`${sourceId}\n${title}`) ?? componentId(sourceId, title)
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
        source,
        componentOf: (title: string): TreeComponent | undefined =>
          findComponentByTitle(tree, source.id, title)?.component,
        componentHrefOf: (component: TreeComponent): string => pages.hrefOf(componentPage(component)),
        onOpenComponent: (component: TreeComponent): void => pages.onOpen(componentPage(component)),
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
    const found = findComponentByTitle(tree, location.source.id, title);
    return found === undefined ? [] : [{ page: componentPage(found.component), name: found.component.name }];
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
          {location.component.design === undefined ? null : (
            <a
              className="forgebook-button"
              href={location.component.design.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" size={14} />
              {STRINGS.openInFigma}
            </a>
          )}
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
  /** Opens what a search found, the focus going with it. */
  readonly openFound: (page: Page) => void;
  /** Goes to a heading of the shown docs page, as a new entry of the history. */
  readonly openAnchor: (anchor: string) => void;
  /** Changes the shown page's address (the view, the panel's values), in place. */
  readonly replaceAddress: (next: Address) => void;
};

/** The address, read again when the history goes back or forth. */
const useAddress = (catalogue: CatalogueSettings, addressTexts: AddressTexts): AddressState => {
  const [address, setAddress] = useState<Address>(() => readAddress(catalogue, addressTexts));
  const [visit, setVisit] = useState<PageVisit>(() => visitOf(address, false));
  useEffect(() => {
    const onBack = (): void => {
      const next = readAddress(catalogue, addressTexts);
      setAddress(next);
      setVisit(visitOf(next, true));
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [catalogue, addressTexts]);
  // a height set with the foot handle belongs to the story it was set on: another page starts at its own
  const pageAddress = (page: Page): Address => ({
    page,
    view: { ...address.view, height: "auto" },
    panelArgs: {},
    matrix: []
  });
  const open = (page: Page, movesFocus: boolean): void => {
    const next = pageAddress(page);
    window.history.pushState(null, "", addressQuery(next, catalogue));
    setAddress(next);
    setVisit({ ...visitOf(next, false), movesFocus });
  };
  return {
    address,
    visit,
    pageAddress,
    openPage: (page: Page): void => open(page, false),
    openFound: (page: Page): void => open(page, true),
    openAnchor: (anchor: string): void => {
      if (address.page.kind !== "page") return;
      const next = { ...address, page: { ...address.page, anchor } };
      window.history.pushState(null, "", addressQuery(next, catalogue));
      setAddress(next);
      setVisit({ ...visitOf(next, false), isInPage: true });
    },
    replaceAddress: (next: Address): void => {
      window.history.replaceState(null, "", addressQuery(next, catalogue));
      setAddress(next);
    }
  };
};

/**
 * Writes the shown page's own id into the address when the address named it by a former id (`formerStoryId`), as a
 * redirect would: a link written then keeps opening its page, and the address then shown is the page's own.
 *
 * @param address - the address.
 * @param ownPage - the shown page by its own id; none on the home or a missing page.
 * @param replaceAddress - changes the address in place.
 */
const useOwnPageId = (
  address: Address,
  ownPage: RecentPage | undefined,
  replaceAddress: (next: Address) => void
): void => {
  useEffect(() => {
    if (ownPage === undefined || address.page.kind === "home" || ownPage.id === address.page.id) return;
    replaceAddress({ ...address, page: { ...address.page, id: ownPage.id } });
  }, [address, ownPage, replaceAddress]);
};

/**
 * The catalogue's page inside its settings: everything below reads them, the shell's own hooks (the sidebar's width,
 * the keys, the recent pages) included.
 *
 * @param props - the configuration.
 */
const ShellPage = ({
  title,
  logo,
  hasBranding,
  heights,
  sources,
  frameUrl,
  addressTexts = "any",
  plugins = NO_PLUGINS,
  loadTokens,
  home
}: ShellConfig): ReactNode => {
  const tree = useMemo(() => storyTree(sources), [sources]);
  const problems = useEditedProblems(tree.problems);
  // the written home's module, loaded when the home is first opened
  const writtenHome = useMemo(() => (home === undefined ? undefined : lazyModule(home)), [home]);
  const idsByTitle = useMemo(() => componentIdsByTitle(tree), [tree]);
  const catalogue = useCatalogue();
  const { address, visit, pageAddress, openPage, openFound, openAnchor, replaceAddress } = useAddress(
    catalogue,
    addressTexts
  );
  const {
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen,
    isOverlay: isSidebarOverlay
  } = useSidebarLayout(visit);
  const showSidebar = useCallback((): void => setIsSidebarOpen(true), [setIsSidebarOpen]);
  const hideSidebar = useCallback((): void => setIsSidebarOpen(false), [setIsSidebarOpen]);
  const {
    isOver: isSidebarOver,
    sidebarRef,
    hideButtonRef,
    showButtonRef
  } = useSidebarOverlay({
    isOverlay: isSidebarOverlay,
    isOpen: isSidebarOpen,
    onClose: hideSidebar
  });
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
  const ownPage = recentPageOf(shown);
  const recent = useRecentPages(ownPage);
  useOwnPageId(address, ownPage, replaceAddress);
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
    catalogueDevice: catalogue.device,
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
  const storyHrefOf = (story: TreeStory): string => addressQuery(pageAddress(storyPage(story)), catalogue);
  const columnHeightOf = (storyId: string): number | undefined =>
    knownHeight(storyHeights, storyId, drawnWidth(address.view.width, PAGE_COLUMN_WIDTH));
  const header = (
    <ShellHeader
      problems={problems}
      location={location}
      page={shownPageLocation}
      isLogic={isLogicPage(shown)}
      message={shown.kind === "missing" ? shown.message : undefined}
      picker={
        location === undefined ? null : (
          <StoryPicker
            component={location.component}
            currentStoryId={shownStoryId}
            onOpenComponent={(): void => openPage(componentPage(location.component))}
            onOpenStory={(story: TreeStory): void => openPage(storyPage(story))}
          />
        )
      }
      related={
        <RelatedLinks
          related={relatedComponents(tree, location)}
          hrefOf={(page: Page): string => addressQuery(pageAddress(page), catalogue)}
          onOpen={openPage}
        />
      }
    />
  );

  const homeProps = {
    title,
    tree,
    sources,
    recent,
    hrefOf: (page: RecentPage): string => addressQuery(pageAddress(page), catalogue),
    onOpen: (page: RecentPage): void => openPage(page),
    header
  };
  const docProps = {
    title,
    plugins,
    tree,
    sources,
    view: address.view,
    touchOverrides,
    onTouchChange: setTouchOverride,
    frameUrl,
    storyHrefOf,
    onOpenStory: (story: TreeStory): void => openPage(storyPage(story)),
    pageHrefOf: (id: string, anchor: string | undefined): string =>
      addressQuery(pageAddress({ kind: "page", id, anchor }), catalogue),
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
        isOverlay={isSidebarOverlay}
        sidebarRef={sidebarRef}
        hideButtonRef={hideButtonRef}
        onHide={hideSidebar}
        onShow={showSidebar}
        appearance={appearance}
        title={title}
        logo={logo}
        hasBranding={hasBranding !== false}
        tree={tree}
        sources={sources}
        searchHref={(target: SearchTarget): string => addressQuery(pageAddress(target), catalogue)}
        onOpenResult={openFound}
        isHome={shown.kind === "home"}
        homeHref={addressQuery(pageAddress(HOME), catalogue)}
        onOpenHome={(): void => openPage(HOME)}
        current={sidebarCurrent(location, shownStoryId)}
        currentPageId={shownPageLocation?.page.id}
        pageHref={(id: string): string => addressQuery(pageAddress({ kind: "page", id }), catalogue)}
        onOpenPage={(id: string): void => openPage({ kind: "page", id })}
        componentHref={(sourceId: string, componentTitle: string): string =>
          addressQuery(pageAddress(titledPage(idsByTitle, sourceId, componentTitle)), catalogue)
        }
        onOpenComponent={(sourceId: string, componentTitle: string): void =>
          openPage(titledPage(idsByTitle, sourceId, componentTitle))
        }
      />
      <SidebarEdge
        isOverlay={isSidebarOverlay}
        isOpen={isSidebarOpen}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onHide={hideSidebar}
      />
      {/* under a sidebar lying over it, the page leaves Tab, screen readers and the pointer */}
      <main className="forgebook-main" inert={isSidebarOver}>
        <ShellBar
          isHome={hasNoStories(shown)}
          view={shownView}
          onViewChange={changeShownView}
          isStoryPage={shown.kind === "story"}
          isComponentPage={shown.kind === "component"}
          isLogic={isLogicPage(shown)}
          // under a sidebar lying over the page the button stays, so the bar's controls never move behind it
          onShowSidebar={isSidebarOpen && !isSidebarOver ? undefined : showSidebar}
          showSidebarRef={showButtonRef}
          shownWidth={shown.kind === "story" ? shownWidth : undefined}
          fixed={fixedOfShown(fixedViews, shown)}
          deviceDefault={deviceOfShown(catalogue.device, shown)}
        />
        {shown.kind === "component" ? (
          <LazyPage
            module={COMPONENT_PAGE}
            header={header}
            pageProps={{
              component: shown.location.component,
              anchor: shown.anchor,
              view: address.view,
              touchOverrides,
              onTouchChange: setTouchOverride,
              frameUrl,
              hrefOf: storyHrefOf,
              onOpen: (story: TreeStory): void => openPage(storyPage(story)),
              ...componentLoaders(files, shown.location.component),
              background: storyBackground(
                shown.location.source.background,
                address.view,
                catalogue,
                isSystemDark
              ),
              heightOf: columnHeightOf,
              header,
              scroll,
              usedIn: usedInLinks(source, catalogue.hasUsedIn, tree, {
                hrefOf: (page: Page): string => addressQuery(pageAddress(page), catalogue),
                onOpen: openPage
              }),
              onViewChange: changeView,
              tree,
              componentId: shown.location.component.id,
              pageHrefOf: (id: string): string => addressQuery(pageAddress({ kind: "page", id }), catalogue),
              onOpenPage: (id: string): void => openPage({ kind: "page", id }),
              loadTokens
            }}
          />
        ) : null}
        {shown.kind === "home" ? (
          <ShellHome written={writtenHome} home={homeProps} writtenProps={{ ...homeProps, ...docProps }} />
        ) : null}
        {shown.kind === "page" ? (
          // keyed by the page: its frames, its text and its scrolling element are that page's alone
          <LazyPage
            key={shown.location.page.id}
            module={DOC_PAGE}
            header={header}
            pageProps={{
              ...docProps,
              location: shown.location,
              anchor: shown.anchor,
              onOpenPage: (id: string): void => openPage({ kind: "page", id }),
              onOpenAnchor: openAnchor
            }}
          />
        ) : null}
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
            plugins={plugins}
            {...storyLoaders(files, shown.location.story)}
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
export const Shell = (props: ShellConfig): ReactNode => (
  <CatalogueContext.Provider value={useConfiguredCatalogue(props)}>
    <PluginHostsContext.Provider value={props.pluginHosts}>
      <ShellPage {...props} />
    </PluginHostsContext.Provider>
  </CatalogueContext.Provider>
);
