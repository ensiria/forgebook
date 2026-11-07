/**
 * One example of a component's page: its title and description, its story in a frame, and a bar that shows its code,
 * fills the page with its box (with the story's width set there) and opens its story on its own page.
 *
 * @module
 */
import type { StoryFileCode } from "@forgebook/story-format/source";
import { type ChangeEvent, type MouseEvent, type ReactNode, useId, useState } from "react";

import { deviceDefaultOf, type StoryDevice, shownDevice } from "../deviceView.ts";
import type { PanelArgs } from "../messages.ts";
import type { TreeComponent, TreeStory } from "../storyTree.ts";
import type { ViewSwitch } from "../switches.ts";
import { frameAddress, schemeOf, type ViewState } from "../viewState.ts";
import { type BoxWidth, BoxWidthControl, useBoxWidth } from "./BoxWidth.tsx";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { useCodeWriter } from "./codeWriter.ts";
import {
  DeviceSlot,
  deviceAddress,
  type FramedDevice,
  inkScheme,
  isWaitingForDevice,
  roomSizing,
  useFramedDevice
} from "./DeviceSlot.tsx";
import { FrameView } from "./FrameView.tsx";
import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { StageViewport } from "./StageViewport.tsx";
import { StoryCodeBlock, type StoryCodeSource, storyCodeText } from "./StoryCodeBlock.tsx";
import { type StoryTouches, touchedView } from "./storyTouch.ts";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";
import { type FullPage, useFullPage } from "./useFullPage.ts";
import { useLoadedView } from "./useLiveView.ts";
import type { Loaded } from "./useLoaded.ts";
import { useSystemDark } from "./useSystemDark.ts";

/** The height of a frame before its story reports its own, in CSS px. */
const FALLBACK_HEIGHT = 160;

/** The demo's height before its story reports its own, in CSS px: the demo is the page's first, larger frame. */
const DEMO_FALLBACK_HEIGHT = 280;

/** The least height of a demo an audience draws larger, in CSS px: its room, never a scale, so its sizes stay true. */
const LARGE_DEMO_HEIGHT = 360;

/** How a page's audience draws its examples. */
export type ExampleReading = {
  /** Whether the examples offer their code. */
  readonly hasCode: boolean;
  /** Whether their code starts open. */
  readonly isCodeOpen: boolean;
  /** Whether the demo is drawn larger, with more room around it. */
  readonly isDemoLarge: boolean;
};

/** The heading an example's title is: the level under the heading above it, so no level is skipped. */
type ExampleTitleTag = "h3" | "h4";

/** What every example of the page shares: the frames' address, view and reports, the code, how to open a story. */
export type ExampleContext = {
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
  /** The view the frames loaded with. */
  readonly frameView: ViewState;
  /** The catalogue's switches, for the frames' addresses. */
  readonly switches: readonly ViewSwitch[];
  /** The stories marked for a phone, each with its own finger. */
  readonly touches: StoryTouches;
  /** Called when the user turns a story's finger on or off. */
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
  /** Each frame's reported height, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The addresses of the frames that finished loading. */
  readonly settled: ReadonlySet<string>;
  /** The story file's code. */
  readonly code: Loaded<StoryFileCode>;
  /** The component's name as code writes it (`codeNameOf`), for the code of a story drawn from its args. */
  readonly componentName: string;
  /** A story's own args, as its frame reported them; none before it loads. */
  readonly argsOf: (storyId: string) => PanelArgs;
  /** A story's measured height, for its box while it loads. */
  readonly heightOf: (storyId: string) => number | undefined;
  /** The colour the stories' page has, which each box waits on. */
  readonly background: string | undefined;
  /** How the page's audience draws its examples. */
  readonly reading: ExampleReading;
};

/** A link to a story's own page, opened in place unless the user asks for another tab. */
export const StoryLink = ({
  story,
  hrefOf,
  onOpen,
  className,
  label,
  children
}: Pick<ExampleContext, "hrefOf" | "onOpen"> & {
  readonly story: TreeStory;
  readonly className: string;
  /** The link's name when its text is the same for every story; its text by default. */
  readonly label?: string;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    aria-label={label}
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
          {isCopied ? STRINGS.copied : LATER_STRINGS.copy}
        </button>
        <StoryCodeBlock {...source} />
      </div>
    </div>
  );
};

/**
 * The height an example's story is drawn at least at: its scene's, and over the page the room its stage has.
 *
 * @param story - the story.
 * @param stageHeight - the stage's height while the box is over the page, in CSS px; none in the list.
 */
const sceneHeightOf = (story: TreeStory, stageHeight: number | undefined): number | undefined =>
  stageHeight === undefined ? story.height : Math.max(story.height ?? 0, stageHeight);

/**
 * An example's title, a link to its story's page, and its description.
 *
 * @param props - the story and how its link opens it.
 */
const ExampleHead = ({
  story,
  titleTag: Title,
  context
}: {
  readonly story: TreeStory;
  readonly titleTag: ExampleTitleTag;
  readonly context: Pick<ExampleContext, "hrefOf" | "onOpen">;
}): ReactNode => (
  <header className="forgebook-example__head">
    <Title className="forgebook-example__title">
      <StoryLink story={story} hrefOf={context.hrefOf} onOpen={context.onOpen} className="forgebook-link">
        {story.name}
      </StoryLink>
    </Title>
    {story.description === undefined ? null : (
      <p className="forgebook-example__description">
        <CodeText text={story.description} />
      </p>
    )}
  </header>
);

/**
 * What keeps an example's place while its box is over the page: a slot of its height in the list, and the shade
 * under the box, a press on which brings it back.
 *
 * @param props - the box's state over the page.
 */
const FullPageSlot = ({ full }: { readonly full: FullPage }): ReactNode => (
  <>
    <div ref={full.slotRef} className="forgebook-example__slot" style={{ height: full.slotHeight }} />
    {/* the pointer's way back; Escape and the box's button are the others, so the shade stays out of the tree */}
    <div
      ref={full.shadeRef}
      className="forgebook-full-shade"
      aria-hidden="true"
      onClick={(): void => full.toggle()}
    />
  </>
);

/**
 * The Touch toggle of a story marked for a phone: on, the story is touched with a simulated finger whatever the
 * toolbar's Touch switch says.
 *
 * @param props - the story, whether its finger is on, and how to change it.
 */
const TouchToggle = ({
  story,
  isTouch,
  onTouchChange
}: {
  readonly story: TreeStory;
  readonly isTouch: boolean;
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
}): ReactNode => (
  <label className="forgebook-example__touch">
    <input
      type="checkbox"
      role="switch"
      aria-checked={isTouch}
      aria-label={LATER_STRINGS.touchNamed(story.name)}
      className="forgebook-switch"
      checked={isTouch}
      onChange={(event: ChangeEvent<HTMLInputElement>): void =>
        onTouchChange(story.id, event.currentTarget.checked)
      }
    />
    {LATER_STRINGS.touch}
  </label>
);

/**
 * An example's bar: its code shown or hidden, the story's width while its box fills the page, its box filling the page
 * or back in its place, and its story opened on its own page.
 *
 * @param props - the story, what every example shares, its code's state and its box's state over the page.
 */
const ExampleBar = ({
  story,
  context,
  hasCode,
  isCodeShown,
  onCodeShownChange,
  codeId,
  full,
  boxWidth,
  isFramed
}: {
  readonly story: TreeStory;
  readonly context: Pick<ExampleContext, "hrefOf" | "onOpen" | "touches" | "onTouchChange">;
  readonly hasCode: boolean;
  readonly isCodeShown: boolean;
  readonly onCodeShownChange: (isShown: boolean) => void;
  readonly codeId: string;
  readonly full: FullPage;
  readonly boxWidth: BoxWidth;
  /** Whether the story is in a device, which sets its width in place of the box's. */
  readonly isFramed: boolean;
}): ReactNode => {
  const isTouch = context.touches.get(story.id);
  return (
    <div className="forgebook-example__bar">
      {hasCode ? (
        <button
          type="button"
          className="forgebook-example__toggle"
          aria-expanded={isCodeShown}
          aria-controls={codeId}
          onClick={(): void => onCodeShownChange(!isCodeShown)}
        >
          <Icon name="chevronRight" size={12} />
          {isCodeShown ? LATER_STRINGS.hideCode : LATER_STRINGS.showCode}
        </button>
      ) : null}
      {isTouch === undefined ? null : (
        <TouchToggle story={story} isTouch={isTouch} onTouchChange={context.onTouchChange} />
      )}
      {isFramed ? null : <BoxWidthControl boxWidth={boxWidth} />}
      <button
        type="button"
        className="forgebook-example__full"
        aria-label={
          full.isFull ? LATER_STRINGS.backToPlaceNamed(story.name) : LATER_STRINGS.fillPageNamed(story.name)
        }
        onClick={(event: MouseEvent<HTMLButtonElement>): void => full.toggle(event)}
      >
        <Icon name={full.isFull ? "collapse" : "expand"} size={12} />
        {full.isFull ? LATER_STRINGS.backToPlace : LATER_STRINGS.fillPage}
      </button>
      <StoryLink
        story={story}
        hrefOf={context.hrefOf}
        onOpen={context.onOpen}
        className="forgebook-example__open"
        label={LATER_STRINGS.openStoryNamed(story.name)}
      >
        {LATER_STRINGS.openStory}
        <Icon name="external" size={12} />
      </StoryLink>
    </div>
  );
};

/**
 * An example's code: what it shows, whether its audience offers it, and whether it is open: the audience's default until
 * the person says otherwise, so changing audience opens or closes what they left alone.
 *
 * @param story - the story.
 * @param context - what every example shares.
 */
const useExampleCode = (
  story: TreeStory,
  context: Pick<ExampleContext, "code" | "componentName" | "argsOf" | "reading">
): {
  readonly source: StoryCodeSource | undefined;
  readonly hasCode: boolean;
  readonly isCodeShown: boolean;
  readonly setIsCodeShown: (isShown: boolean) => void;
} => {
  const [ownCodeShown, setIsCodeShown] = useState<boolean | undefined>(undefined);
  const source: StoryCodeSource | undefined =
    context.code.status === "ready"
      ? {
          code: context.code.value,
          exportName: story.exportName,
          componentName: context.componentName,
          args: context.argsOf(story.id)
        }
      : undefined;
  return {
    source,
    hasCode: source !== undefined && context.reading.hasCode,
    isCodeShown: ownCodeShown ?? context.reading.isCodeOpen,
    setIsCodeShown
  };
};

/**
 * The device an example is drawn in, over the page as in the list: the view's choice over the story's and the
 * catalogue's defaults, and the ink of its status bar.
 *
 * @param story - the story.
 * @param context - the page's view and switches.
 */
const useExampleDevice = (
  story: TreeStory,
  context: Pick<ExampleContext, "view" | "switches">
): {
  readonly shown: StoryDevice | undefined;
  readonly framed: FramedDevice | undefined;
  readonly scheme: "light" | "dark";
} => {
  const shown = shownDevice(context.view, deviceDefaultOf(useCatalogue().device, story.device));
  return {
    shown,
    framed: useFramedDevice(shown),
    scheme: inkScheme(schemeOf(context.view, context.switches), useSystemDark())
  };
};

/**
 * The heights an example's frame waits at: the story's measured one when there is one, a guess otherwise (larger for
 * the demo), never below the height its scene needs; and the least a large demo is given.
 *
 * @param story - the story.
 * @param context - the page's measured heights and how it reads.
 * @param isDemo - whether it is the page's demo.
 */
const exampleHeights = (
  story: TreeStory,
  context: Pick<ExampleContext, "heightOf" | "reading">,
  isDemo: boolean
): { readonly fallback: number; readonly least: number } => {
  const least = isDemo && context.reading.isDemoLarge ? LARGE_DEMO_HEIGHT : 0;
  const guess = isDemo ? DEMO_FALLBACK_HEIGHT : FALLBACK_HEIGHT;
  return { fallback: Math.max(story.height ?? 0, context.heightOf(story.id) ?? guess, least), least };
};

/**
 * One example: its title and description (the demo has none: it opens the page), its story in a frame, and a bar
 * that shows its code and opens the story on its own page.
 *
 * @param props - the story, whether it is the demo, whether its frame may load, where the queue watches it, and what
 * every example shares.
 */
export const Example = ({
  story,
  isDemo,
  titleTag = "h3",
  isMounted,
  observe,
  ...context
}: ExampleContext & {
  readonly story: TreeStory;
  readonly isDemo: boolean;
  readonly titleTag?: ExampleTitleTag;
  readonly isMounted: boolean;
  readonly observe?: (element: HTMLElement | null) => void;
}): ReactNode => {
  const { source, hasCode, isCodeShown, setIsCodeShown } = useExampleCode(story, context);
  const codeId = useId();
  const full = useFullPage();
  const { touch } = useCatalogue();
  const { shown, framed, scheme } = useExampleDevice(story, context);
  // the frame loads with the story's finger as it is then; a change after reaches it live, keeping the story's state
  const loadedView = useLoadedView(
    `${context.frameView.sheets}|${context.frameView.play}`,
    touchedView(context.frameView, story.id, context.touches, touch)
  );
  const boxWidth = useBoxWidth(full.isOver, context.view.width);
  const { fallback: fallbackHeight, least: leastHeight } = exampleHeights(story, context, isDemo);
  return (
    <article
      ref={observe}
      className="forgebook-example"
      data-demo={isDemo ? "" : undefined}
      aria-label={isDemo ? STRINGS.frameTitle(context.component.name, story.name) : story.name}
    >
      {isDemo ? null : <ExampleHead story={story} titleTag={titleTag} context={context} />}
      {full.isOver ? <FullPageSlot full={full} /> : null}
      <div
        ref={full.boxRef}
        className="forgebook-example__box"
        data-full={full.isOver ? "" : undefined}
        // over the page, the box is a dialog named after its story
        {...(full.isFull ? { role: "dialog", "aria-label": story.name } : {})}
      >
        <div ref={full.stageRef} className="forgebook-example__stage">
          <StageViewport
            {...roomSizing(framed, {
              width: boxWidth.width,
              onWidthChange: boxWidth.onWidthChange,
              onShownWidthChange: boxWidth.onShownWidthChange,
              background: context.background
            })}
          >
            <DeviceSlot framed={framed} scheme={scheme} background={context.background}>
              {isMounted && !isWaitingForDevice(shown, framed) ? (
                <FrameView
                  title={STRINGS.frameTitle(context.component.name, story.name)}
                  address={deviceAddress(
                    frameAddress(context.frameUrl, story.id, loadedView, context.switches),
                    framed
                  )}
                  heights={context.heights}
                  settled={context.settled}
                  fallbackHeight={fallbackHeight}
                  // over the page, the story fills the room it has
                  sceneHeight={Math.max(sceneHeightOf(story, full.stageHeight) ?? 0, leastHeight)}
                  fixedHeight={framed?.area.height}
                />
              ) : (
                // the frame's room until its turn comes, so the page does not jump when it loads
                <div
                  className="forgebook-frame-placeholder"
                  style={{ height: framed?.area.height ?? fallbackHeight }}
                />
              )}
            </DeviceSlot>
          </StageViewport>
        </div>
        <ExampleBar
          story={story}
          context={context}
          hasCode={hasCode}
          isCodeShown={isCodeShown}
          onCodeShownChange={setIsCodeShown}
          codeId={codeId}
          full={full}
          boxWidth={boxWidth}
          isFramed={framed !== undefined}
        />
        {source === undefined || !hasCode ? null : (
          <ExampleCode id={codeId} source={source} isShown={isCodeShown} />
        )}
      </div>
    </article>
  );
};
