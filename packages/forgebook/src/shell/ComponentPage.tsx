/**
 * A component's page, as a library documents a component: what it is, its demo (the story marked `main`) with
 * its code, the text of its documentation file, its API reference drawn from its types, then every other story as an
 * example.
 *
 * @remarks
 * The frames load a few at a time (`useFrameQueue`), in the page's order, the demo first, each as it comes near the
 * visible part of the page: a component may have twenty stories. The view's live part reaches every frame as a message, as
 * on the story page; the props panel and Replay belong to a story's own page, which each story's name links to. The
 * documentation file's HTML is the package's own, made at build time (`vite/componentPage.ts`). Who reads the page
 * reorders and filters what goes around the frames (`audienceLayout.ts`); what only one audience wants loads on first use,
 * its data alongside the sections' code rather than after it.
 *
 * @module
 */
import type { RequiredFirst } from "@forgebook/story-format/csf";
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef } from "react";

import { groupLabel } from "../catalogue.ts";
import { type ComponentDocs, codeNameOf } from "../componentDocs.ts";
import {
  groupedStories,
  isLogicComponent,
  mainStory,
  type StoryTree,
  type TreeComponent,
  type TreeStory
} from "../storyTree.ts";
import { usageLoader } from "../usedIn.ts";
import { type ViewState, viewParams } from "../viewState.ts";
import { ApiReference } from "./ApiReference.tsx";
import type { AudienceSectionsProps } from "./AudienceSections.tsx";
import { showsSection } from "./audienceLayout.ts";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { Example, type ExampleContext, type ExampleReading } from "./Example.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import { PackageHtml } from "./PackageHtml.tsx";
import type { TouchOverrides } from "./storyTouch.ts";
import { UsedIn, type UsedInProps } from "./UsedIn.tsx";
import { useComponentDocs } from "./useComponentDocs.ts";
import type { Loaded } from "./useLoaded.ts";
import { type PageDoc, usePageDoc } from "./usePageDoc.ts";
import { usePageFrames } from "./usePageFrames.ts";
import { type PageScroll, useScrollMemory } from "./useScrollMemory.ts";
import { useStoryCode } from "./useStoryCode.ts";

/** What opens the page at an anchor, loaded with the first one: most pages open at their top. */
const AnchorScroll = lazy(() =>
  import("./AnchorScroll.tsx").then(
    (module) => ({ default: module.AnchorScroll }),
    // a chunk gone after a new deployment costs the place on the page, never the page
    () => ({ default: (): ReactNode => null })
  )
);

/** The component page's props. */
export type ComponentPageProps = {
  /** The component. */
  readonly component: TreeComponent;
  /** The heading or the prop the address names; none when it names none. */
  readonly anchor: string | undefined;
  /** The view. */
  readonly view: ViewState;
  /** What the user chose for each story marked for a phone. */
  readonly touchOverrides: TouchOverrides;
  /** Called when the user turns a story's finger on or off. */
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The address of a story's page, for its link. */
  readonly hrefOf: (story: TreeStory) => string;
  /** Opens a story's page. */
  readonly onOpen: (story: TreeStory) => void;
  /** Loads the component's docs, for its API reference; `undefined` when the source has none for the file. */
  readonly loadDocs: (() => Promise<unknown>) | undefined;
  /** Loads the story file's code, for the demo's code; `undefined` when the source has none. */
  readonly loadCode: (() => Promise<unknown>) | undefined;
  /** Loads the component's documentation file as HTML; `undefined` when the source has none. */
  readonly loadPage: (() => Promise<unknown>) | undefined;
  /** A story's measured height at about the width its example is drawn at, for its box while it loads. */
  readonly heightOf: (storyId: string) => number | undefined;
  /** The colour the stories' page has in the view (their source's), which each box waits on; none without one. */
  readonly background: string | undefined;
  /** What stays above the page while it scrolls: the component's header. */
  readonly header: ReactNode;
  /** Where its scrolling part starts: the shell's visit of the page and every page's last position. */
  readonly scroll: PageScroll;
  /** What "Used in" reads and opens; none when the catalogue turned it off. */
  readonly usedIn?: Omit<UsedInProps, "title"> | undefined;
  /** Called with the changed view: the page's note goes back to the whole page. */
  readonly onViewChange: (view: ViewState) => void;
  /** The tree, where a designer's page finds the docs pages that show the component. */
  readonly tree: StoryTree;
  /** The component's id in the tree. */
  readonly componentId: string;
  /** The address of a docs page. */
  readonly pageHrefOf: (id: string) => string;
  /** Opens a docs page. */
  readonly onOpenPage: (id: string) => void;
  /** Loads the catalogue's design tokens, for a designer; `undefined` when it has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
};

/** What a page drawn for one audience adds around its frames, loaded the first time a page is drawn for one. */
const AUDIENCE_SECTIONS = lazyModule(() =>
  import("./AudienceSections.tsx").then((module) => module.AudienceSections)
);

/**
 * Starts loading what an audience's sections read (the design tokens, "Used in") as soon as the page is drawn for it.
 * Asked by the sections themselves, these loads would wait for the sections' chunk and its styles first: seconds on a
 * dev server's first visit, before a request that may itself take seconds. The loaders keep their answer, so the
 * sections read it at once when they come.
 *
 * @param audience - who the page is drawn for.
 * @param loadTokens - the catalogue's tokens loader; `undefined` when it has none.
 * @param loadUsage - "Used in"'s loader; `undefined` when the catalogue turned it off.
 */
const useAudienceLoads = (
  audience: ViewState["audience"],
  loadTokens: (() => Promise<unknown>) | undefined,
  loadUsage: (() => Promise<unknown>) | undefined
): void => {
  useEffect(() => {
    const loads = [
      showsSection(audience, "tokens") ? loadTokens?.() : undefined,
      showsSection(audience, "usedIn") ? loadUsage?.() : undefined
    ];
    // a failed load is its section's to report, when it asks the same loader
    for (const load of loads) void load?.catch(() => undefined);
  }, [audience, loadTokens, loadUsage]);
};

/**
 * The page's lead: what the component is and does, from its file's `@module` comment (its own TSDoc is often a bare
 * name), read with the documentation file so it comes with the page; else its TSDoc summary, once the docs come.
 *
 * @param props - the loaded page and the component's docs.
 */
export const Lead = ({
  page,
  docs
}: {
  readonly page: Loaded<PageDoc>;
  readonly docs: ComponentDocs | undefined;
}): ReactNode => {
  const summary = page.status === "ready" ? page.value.summary : "";
  const lead = summary || docs?.summary || docs?.description || "";
  return lead === "" ? null : (
    <p className="forgebook-doc__lead">
      <CodeText text={lead} />
    </p>
  );
};

/**
 * The documentation file's text, or why it could not be read.
 *
 * @param props - the loaded page.
 */
const Prose = ({ page }: { readonly page: Loaded<PageDoc> }): ReactNode => {
  if (page.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {LATER_STRINGS.pageError}: {page.message}
      </p>
    );
  }
  if (page.status !== "ready" || page.value.html === "") return null;
  return <PackageHtml className="forgebook-prose" html={page.value.html} />;
};

/** What a page drawn for one audience reads around its frames. */
type AudienceProps = Omit<AudienceSectionsProps, "place">;

/**
 * One place around the frames: the page's own sections, or an audience's in their place. Always one element, so the
 * frames after it keep their place and never load again.
 *
 * @param props - the place, the audience's props (none for everyone) and the page's own sections.
 */
const AudienceSlot = ({
  place,
  audience,
  children
}: {
  readonly place: AudienceSectionsProps["place"];
  readonly audience: AudienceProps | undefined;
  readonly children: ReactNode;
}): ReactNode =>
  audience === undefined ? (
    children
  ) : (
    <LazyView
      module={AUDIENCE_SECTIONS}
      props={{ place, ...audience }}
      loading={null}
      failed={(message: string): ReactNode => (
        <p className="forgebook-problems" role="alert">
          {LATER_STRINGS.audienceError}: {message}
        </p>
      )}
    />
  );

/**
 * The API reference; nothing without props, or a signature for what is about logic.
 *
 * @param props - the component's docs, whether it is about logic, the prop groups its meta lists first, and where its
 * meta puts the required props.
 */
export const PageApi = ({
  docs,
  isLogic,
  componentGroups,
  requiredFirst
}: {
  readonly docs: ComponentDocs | undefined;
  readonly isLogic: boolean;
  readonly componentGroups: readonly string[];
  readonly requiredFirst: RequiredFirst | undefined;
}): ReactNode =>
  docs === undefined || (docs.props.length === 0 && !(isLogic && docs.signature !== undefined)) ? null : (
    <ApiReference
      docs={docs}
      isLogic={isLogic}
      componentGroups={componentGroups}
      requiredFirst={requiredFirst}
    />
  );

/**
 * A component's page.
 *
 * @param props - the component, the view, its loaders and how to open a story.
 */
export const ComponentPage = ({
  component,
  anchor,
  view,
  touchOverrides,
  onTouchChange,
  frameUrl,
  hrefOf,
  onOpen,
  loadDocs,
  loadCode,
  loadPage,
  heightOf,
  background,
  header,
  scroll,
  usedIn,
  onViewChange,
  tree,
  componentId,
  pageHrefOf,
  onOpenPage,
  loadTokens
}: ComponentPageProps): ReactNode => {
  const pageRef = useRef<HTMLDivElement>(null);
  const docs = useComponentDocs(loadDocs);
  const code = useStoryCode(loadCode);
  const page = usePageDoc(loadPage);
  const demo = mainStory(component);
  const examples = useMemo(
    () => component.stories.filter((story) => story.id !== demo?.id),
    [component, demo]
  );
  const catalogue = useCatalogue();
  // the demo first in the queue, at the top of the page, and counted in it: a frame of a library served as source asks
  // for thousands of modules, and one more beside those the queue allows makes the browser refuse some of them
  const queued = useMemo(
    () => [...(demo === undefined ? [] : [demo.id]), ...examples.map((story) => story.id)],
    [demo, examples]
  );
  const { queue, ...frames } = usePageFrames({
    stories: component.stories,
    queued,
    pageRef,
    view,
    touchOverrides
  });
  useScrollMemory(pageRef, scroll);
  useAudienceLoads(view.audience, loadTokens, usedIn === undefined ? undefined : usageLoader(usedIn.source));
  const componentDocs = docs.status === "ready" ? docs.value : undefined;
  const isLogic = isLogicComponent(component);
  const reading: ExampleReading = {
    hasCode: view.audience !== "designer",
    isCodeOpen: view.audience === "coder",
    isDemoLarge: view.audience === "designer"
  };
  const context: ExampleContext = {
    ...frames,
    component,
    view,
    frameUrl,
    hrefOf,
    onOpen,
    switches: catalogue.switches,
    onTouchChange,
    code,
    componentName: componentDocs === undefined ? component.name : codeNameOf(componentDocs),
    heightOf,
    background,
    reading
  };
  const audienceProps: AudienceProps | undefined =
    view.audience === "everyone"
      ? undefined
      : {
          audience: view.audience,
          hasNote: catalogue.ownControls.includes("audience"),
          onShowAll: (): void => onViewChange({ ...view, audience: "everyone" }),
          component,
          docs: componentDocs,
          isLogic,
          page,
          tree,
          componentId,
          pageHrefOf,
          onOpenPage,
          loadTokens,
          coverage: {
            viewKey: viewParams(view, catalogue.switches, catalogue.audience).toString(),
            stories: component.stories,
            storyGroups: catalogue.storyGroups,
            queue,
            pageRef,
            settled: frames.settled,
            hrefOf,
            onOpen
          },
          usedIn,
          pageRef
        };

  return (
    <div className="forgebook-workspace">
      {header}
      {anchor === undefined ? null : (
        <Suspense fallback={null}>
          <AnchorScroll
            pageRef={pageRef}
            anchor={anchor}
            visit={scroll.visit}
            isReady={docs.status !== "loading" && page.status !== "loading"}
          />
        </Suspense>
      )}
      <div ref={pageRef} className="forgebook-scroll">
        {/* keyed by the component, so another component's page comes in with its own entrance */}
        <div
          key={`${component.file}|${component.title}`}
          className="forgebook-doc"
          data-audience={view.audience === "everyone" ? undefined : view.audience}
        >
          <AudienceSlot place="beforeDemo" audience={audienceProps}>
            <Lead page={page} docs={componentDocs} />
          </AudienceSlot>
          {demo === undefined ? null : (
            <Example
              {...context}
              story={demo}
              isDemo={true}
              isMounted={queue.mounted.has(demo.id)}
              observe={queue.observerOf(demo.id)}
            />
          )}
          <AudienceSlot place="afterDemo" audience={audienceProps}>
            <Prose page={page} />
            <PageApi
              docs={componentDocs}
              isLogic={isLogic}
              componentGroups={component.propGroups}
              requiredFirst={component.requiredFirst}
            />
          </AudienceSlot>
          {examples.length === 0 ? null : (
            <section className="forgebook-doc__section" aria-labelledby="forgebook-examples">
              <h2 id="forgebook-examples">{LATER_STRINGS.examples}</h2>
              {groupedStories(
                examples,
                catalogue.storyGroups.map((group) => group.id)
              ).map((section) => (
                <section key={section.group ?? ""} className="forgebook-doc__group">
                  {section.group === undefined ? null : (
                    <h3 className="forgebook-doc__group-name">
                      {groupLabel(catalogue.storyGroups, section.group)}
                    </h3>
                  )}
                  {section.stories.map((story) => (
                    <Example
                      key={story.id}
                      {...context}
                      story={story}
                      isDemo={false}
                      isMounted={queue.mounted.has(story.id)}
                      observe={queue.observerOf(story.id)}
                    />
                  ))}
                </section>
              ))}
            </section>
          )}
          <AudienceSlot place="afterExamples" audience={audienceProps}>
            {usedIn === undefined ? null : <UsedIn title={component.title} {...usedIn} />}
          </AudienceSlot>
        </div>
      </div>
    </div>
  );
};
