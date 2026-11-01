/**
 * A component's page, as a library documents a component: what it is, its demo (the story marked `main`) with
 * its code, the text of its documentation file, its API reference drawn from its types, then every other story as an
 * example.
 *
 * @remarks
 * The demo loads at once; the examples load as they come near the visible part of the page, a few at a time
 * (`useFrameQueue`): a component may have twenty stories. The view's live part reaches every frame as a message, as
 * on the story page; the props panel and Replay belong to a story's own page, which each story's name links to. The
 * documentation file's HTML is the package's own, made at build time (`vite/componentPage.ts`).
 *
 * @module
 */
import { type ReactNode, useMemo, useRef, useState } from "react";

import { groupLabel } from "../catalogue.ts";
import type { ComponentDocs } from "../componentDocs.ts";
import type { PanelArgs, ShellMessage } from "../messages.ts";
import { groupedStories, mainStory, type TreeComponent, type TreeStory } from "../storyTree.ts";
import { liveView, type ViewState } from "../viewState.ts";
import { ApiReference } from "./ApiReference.tsx";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { Example, type ExampleContext } from "./Example.tsx";
import { PackageHtml } from "./PackageHtml.tsx";
import { storyTouchesOf, type TouchOverrides, touchedView } from "./storyTouch.ts";
import { STRINGS } from "./strings.ts";
import { UsedIn, type UsedInProps } from "./UsedIn.tsx";
import { useComponentDocs } from "./useComponentDocs.ts";
import { type ReadyMessage, useFrameMessages } from "./useFrameMessages.ts";
import { useFrameQueue } from "./useFrameQueue.ts";
import { useLiveView, useLoadedView } from "./useLiveView.ts";
import type { Loaded } from "./useLoaded.ts";
import { type PageDoc, usePageDoc } from "./usePageDoc.ts";
import { type PageScroll, useScrollMemory } from "./useScrollMemory.ts";
import { useStoryCode } from "./useStoryCode.ts";

/** The component page's props. */
export type ComponentPageProps = {
  /** The component. */
  readonly component: TreeComponent;
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
};

/**
 * The page's lead: what the component is and does, from its file's `@module` comment (its own TSDoc is often a bare
 * name), read with the documentation file so it comes with the page; else its TSDoc summary, once the docs come.
 *
 * @param props - the loaded page and the component's docs.
 */
const Lead = ({
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
        {STRINGS.pageError}: {page.message}
      </p>
    );
  }
  if (page.status !== "ready" || page.value.html === "") return null;
  return <PackageHtml className="forgebook-prose" html={page.value.html} />;
};

/**
 * A component's page.
 *
 * @param props - the component, the view, its loaders and how to open a story.
 */
export const ComponentPage = ({
  component,
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
  usedIn
}: ComponentPageProps): ReactNode => {
  const pageRef = useRef<HTMLDivElement>(null);
  const docs = useComponentDocs(loadDocs);
  const code = useStoryCode(loadCode);
  const page = usePageDoc(loadPage);
  // each story's own args, as its frame reports them: the code of a story drawn from its args is written from them
  const [storyArgs, setStoryArgs] = useState<ReadonlyMap<string, PanelArgs>>(new Map());
  const demo = mainStory(component);
  const examples = useMemo(
    () => component.stories.filter((story) => story.id !== demo?.id),
    [component, demo]
  );
  // the frames keep the view they loaded with; only the style sheets load them again, the rest of the view (the
  // switches, the language among them) is sent to them live
  const frameView = useLoadedView(view.sheets, view);
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  // each story marked for a phone with its own finger: its frame gets it in place of the toolbar's Touch
  const touches = useMemo(
    () => storyTouchesOf(component.stories, touchOverrides),
    [component, touchOverrides]
  );
  const exampleIds = useMemo(() => examples.map((story) => story.id), [examples]);
  const queue = useFrameQueue(exampleIds, pageRef);
  const { heights, settled } = useFrameMessages({
    onReady: (frame: Window, message: ReadyMessage): void => {
      queue.markReady(message.storyId);
      setStoryArgs((current) => new Map(current).set(message.storyId, message.args));
      const send = (shellMessage: ShellMessage): void =>
        frame.postMessage(shellMessage, window.location.origin);
      send({
        type: "forgebook:view",
        view: touchedView(liveView(view), message.storyId, touches, catalogue.touch)
      });
      send({ type: "forgebook:tools", tools: view.tools });
    },
    onCall: (): void => undefined,
    // a frame that failed is over too: its place in the queue goes to the next one
    onFailed: queue.markReady
  });
  useLiveView(pageRef, view, true, { touches, choice: catalogue.touch });
  useScrollMemory(pageRef, scroll);
  const componentDocs = docs.status === "ready" ? docs.value : undefined;
  const context: ExampleContext = {
    component,
    view,
    frameUrl,
    hrefOf,
    onOpen,
    frameView,
    switches,
    touches,
    onTouchChange,
    heights,
    settled,
    code,
    componentName: componentDocs?.name ?? component.name,
    argsOf: (storyId: string): PanelArgs => storyArgs.get(storyId) ?? {},
    heightOf,
    background
  };

  return (
    <div className="forgebook-workspace">
      {header}
      <div ref={pageRef} className="forgebook-scroll">
        {/* keyed by the component, so another component's page comes in with its own entrance */}
        <div key={`${component.file}|${component.title}`} className="forgebook-doc">
          <Lead page={page} docs={componentDocs} />
          {demo === undefined ? null : <Example {...context} story={demo} isDemo={true} isMounted={true} />}
          <Prose page={page} />
          {componentDocs === undefined || componentDocs.props.length === 0 ? null : (
            <ApiReference docs={componentDocs} />
          )}
          {examples.length === 0 ? null : (
            <section className="forgebook-doc__section" aria-labelledby="forgebook-examples">
              <h2 id="forgebook-examples">{STRINGS.examples}</h2>
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
                      observe={(element: HTMLElement | null): void => queue.observe(story.id, element)}
                    />
                  ))}
                </section>
              ))}
            </section>
          )}
          {usedIn === undefined ? null : <UsedIn title={component.title} {...usedIn} />}
        </div>
      </div>
    </div>
  );
};
