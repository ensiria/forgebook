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
import type { StoryFileCode } from "@forgebook/story-format/source";
import { type MouseEvent, type ReactNode, useId, useMemo, useRef, useState } from "react";

import { groupLabel } from "../catalogue";
import type { ComponentDocs } from "../componentDocs";
import type { PanelArgs, ShellMessage } from "../messages";
import { groupedStories, mainStory, type TreeComponent, type TreeStory } from "../storyTree";
import type { ViewSwitch } from "../switches";
import { frameAddress, liveView, type ViewState } from "../viewState";
import { ApiReference } from "./ApiReference";
import { CodeText } from "./CodeText";
import { useCatalogue } from "./catalogueContext";
import { useCodeWriter } from "./codeWriter";
import { FrameView } from "./FrameView";
import { Icon } from "./icons";
import { PackageHtml } from "./PackageHtml";
import { StageViewport } from "./StageViewport";
import { StoryCodeBlock, type StoryCodeSource, storyCodeText } from "./StoryCodeBlock";
import { STRINGS } from "./strings";
import { useComponentDocs } from "./useComponentDocs";
import { useCopy } from "./useCopy";
import { type ReadyMessage, useFrameMessages } from "./useFrameMessages";
import { useFrameQueue } from "./useFrameQueue";
import { useLiveView, useLoadedView } from "./useLiveView";
import type { Loaded } from "./useLoaded";
import { type PageDoc, usePageDoc } from "./usePageDoc";
import { type PageScroll, useScrollMemory } from "./useScrollMemory";
import { useStoryCode } from "./useStoryCode";

/** The height of a frame before its story reports its own, in CSS px. */
const FALLBACK_HEIGHT = 160;

/** The demo's height before its story reports its own, in CSS px: the demo is the page's first, larger frame. */
const DEMO_FALLBACK_HEIGHT = 280;

/** The component page's props. */
export type ComponentPageProps = {
  /** The component. */
  readonly component: TreeComponent;
  /** The view. */
  readonly view: ViewState;
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
};

/** What every example of the page shares: the frames' address, view and reports, the code, how to open a story. */
type ExampleContext = Pick<ComponentPageProps, "component" | "view" | "frameUrl" | "hrefOf" | "onOpen"> & {
  /** The view the frames loaded with. */
  readonly frameView: ViewState;
  /** The catalogue's switches, for the frames' addresses. */
  readonly switches: readonly ViewSwitch[];
  /** Each frame's reported height, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The addresses of the frames that finished loading. */
  readonly settled: ReadonlySet<string>;
  /** The story file's code. */
  readonly code: Loaded<StoryFileCode>;
  /** The component's name, for the JSX of a story drawn from its args. */
  readonly componentName: string;
  /** A story's own args, as its frame reported them; none before it loads. */
  readonly argsOf: (storyId: string) => PanelArgs;
  /** A story's measured height, for its box while it loads. */
  readonly heightOf: (storyId: string) => number | undefined;
  /** The colour the stories' page has, which each box waits on. */
  readonly background: string | undefined;
};

/** A link to a story's own page, opened in place unless the user asks for another tab. */
const StoryLink = ({
  story,
  hrefOf,
  onOpen,
  className,
  children
}: Pick<ComponentPageProps, "hrefOf" | "onOpen"> & {
  readonly story: TreeStory;
  readonly className: string;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    href={hrefOf(story)}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onOpen(story);
    }}
  >
    {children}
  </a>
);

/**
 * The code under an example: closed until asked for, then opened in place with a button that copies it.
 *
 * @param props - the story's code and whether it is shown.
 */
const ExampleCode = ({
  id,
  source,
  isShown
}: {
  readonly id: string;
  readonly source: StoryCodeSource;
  readonly isShown: boolean;
}): ReactNode => {
  const { isCopied, copy } = useCopy();
  const write = useCodeWriter();
  return (
    // the code stays in the page while closed, so it opens with a transition; inert keeps it out of Tab and
    // screen readers until then
    <div id={id} className="forgebook-example__code" data-open={isShown ? "" : undefined} inert={!isShown}>
      <div className="forgebook-example__code-inner">
        <button
          type="button"
          className="forgebook-example__copy"
          onClick={(): void => copy(storyCodeText(source, write))}
          aria-live="polite"
        >
          {isCopied ? STRINGS.copied : STRINGS.copy}
        </button>
        <StoryCodeBlock {...source} />
      </div>
    </div>
  );
};

/**
 * One example: its title and description (the demo has none: it opens the page), its story in a frame, and a bar
 * that shows its code.
 *
 * @param props - the story, whether it is the demo, whether its frame may load, where the queue watches it, and what
 * every example shares.
 */
const Example = ({
  story,
  isDemo,
  isMounted,
  observe,
  ...context
}: ExampleContext & {
  readonly story: TreeStory;
  readonly isDemo: boolean;
  readonly isMounted: boolean;
  readonly observe?: (element: HTMLElement | null) => void;
}): ReactNode => {
  const [isCodeShown, setIsCodeShown] = useState(false);
  const codeId = useId();
  // the story's measured height when there is one; a guess otherwise, larger for the demo; never below the height its
  // scene needs, which its frame has from the start (D-469)
  const fallbackHeight = Math.max(
    story.height ?? 0,
    context.heightOf(story.id) ?? (isDemo ? DEMO_FALLBACK_HEIGHT : FALLBACK_HEIGHT)
  );
  const source: StoryCodeSource | undefined =
    context.code.status === "ready"
      ? {
          code: context.code.value,
          exportName: story.exportName,
          componentName: context.componentName,
          args: context.argsOf(story.id)
        }
      : undefined;
  return (
    <article
      ref={observe}
      className="forgebook-example"
      data-demo={isDemo ? "" : undefined}
      aria-label={isDemo ? STRINGS.frameTitle(context.component.name, story.name) : story.name}
    >
      {isDemo ? null : (
        <header className="forgebook-example__head">
          <h4 className="forgebook-example__title">
            <StoryLink
              story={story}
              hrefOf={context.hrefOf}
              onOpen={context.onOpen}
              className="forgebook-link"
            >
              {story.name}
            </StoryLink>
          </h4>
          {story.description === undefined ? null : (
            <p className="forgebook-example__description">
              <CodeText text={story.description} />
            </p>
          )}
        </header>
      )}
      <div className="forgebook-example__box">
        <div className="forgebook-example__stage">
          <StageViewport width={context.view.width} background={context.background}>
            {isMounted ? (
              <FrameView
                title={STRINGS.frameTitle(context.component.name, story.name)}
                address={frameAddress(context.frameUrl, story.id, context.frameView, context.switches)}
                heights={context.heights}
                settled={context.settled}
                fallbackHeight={fallbackHeight}
                sceneHeight={story.height}
              />
            ) : (
              // the frame's room until its turn comes, so the page does not jump when it loads
              <div className="forgebook-frame-placeholder" style={{ height: fallbackHeight }} />
            )}
          </StageViewport>
        </div>
        <div className="forgebook-example__bar">
          {source === undefined ? null : (
            <button
              type="button"
              className="forgebook-example__toggle"
              aria-expanded={isCodeShown}
              aria-controls={codeId}
              onClick={(): void => setIsCodeShown(!isCodeShown)}
            >
              <Icon name="chevronRight" size={12} />
              {isCodeShown ? STRINGS.hideCode : STRINGS.showCode}
            </button>
          )}
          {isDemo ? (
            <StoryLink
              story={story}
              hrefOf={context.hrefOf}
              onOpen={context.onOpen}
              className="forgebook-example__open"
            >
              {STRINGS.openStory}
              <Icon name="external" size={12} />
            </StoryLink>
          ) : null}
        </div>
        {source === undefined ? null : <ExampleCode id={codeId} source={source} isShown={isCodeShown} />}
      </div>
    </article>
  );
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
  frameUrl,
  hrefOf,
  onOpen,
  loadDocs,
  loadCode,
  loadPage,
  heightOf,
  background,
  header,
  scroll
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
  const exampleIds = useMemo(() => examples.map((story) => story.id), [examples]);
  const queue = useFrameQueue(exampleIds, pageRef);
  const { heights, settled } = useFrameMessages({
    onReady: (frame: Window, message: ReadyMessage): void => {
      queue.markReady(message.storyId);
      setStoryArgs((current) => new Map(current).set(message.storyId, message.args));
      const send = (shellMessage: ShellMessage): void =>
        frame.postMessage(shellMessage, window.location.origin);
      send({ type: "forgebook:view", view: liveView(view) });
      send({ type: "forgebook:tools", tools: view.tools });
    },
    onCall: (): void => undefined,
    // a frame that failed is over too: its place in the queue goes to the next one
    onFailed: queue.markReady
  });
  useLiveView(pageRef, view, true);
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
        </div>
      </div>
    </div>
  );
};
