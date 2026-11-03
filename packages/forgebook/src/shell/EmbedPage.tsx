/**
 * One story alone, for a page of someone else's: no sidebar, no toolbar, no panel, nothing but the story at the width
 * it is given, in the catalogue's theme. What `?embed` mounts instead of the shell; loaded only then.
 *
 * @remarks
 * It stays the catalogue's page around the story's frame, so a story keeps the document of its own it has everywhere
 * else, and whatever is not the story (the wait, the message when there is none) is drawn by the shell's style sheets
 * with the catalogue's theme. Its appearance follows the story, so a dark story has no light edge. It never needs the
 * browser's storage, which a third-party frame may be denied, and nothing listens to the page around it: all that
 * crosses is the height (`EmbedSizeMessage`), for a page that wants to follow it. A page that cannot, such
 * as a wiki with a fixed box, gets a story that fills the box and scrolls inside it when it is taller.
 *
 * @module
 */
import "./embed.scss";

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import { type AddressTexts, addressArgsFor } from "../addressTexts.ts";
import { EMBED_SIZE_TYPE, type EmbedSizeMessage } from "../embed.ts";
import { type PanelArgs, parsePanelArgsParam, type ShellMessage } from "../messages.ts";
import { storyBackground } from "../storyBackground.ts";
import { type FixedView, NOT_FIXED, withFixed } from "../storyGlobals.ts";
import { findStory, type StoryLocation, storyTree } from "../storyTree.ts";
import { frameAddress, parseView, STAGE_HEIGHT_RANGE, type ViewState } from "../viewState.ts";
import { CatalogueContext, useCatalogue, useConfiguredCatalogue } from "./catalogueContext.ts";
import { FrameView } from "./FrameView.tsx";
import { framesOrigin } from "./framesOrigin.ts";
import type { ShellConfig } from "./Shell.tsx";
import { shellIsDark } from "./shellScheme.ts";
import { STRINGS } from "./strings.ts";
import { APPEARANCE_ATTRIBUTE } from "./useAppearance.ts";
import { type ReadyMessage, useFrameMessages } from "./useFrameMessages.ts";
import { useSystemDark } from "./useSystemDark.ts";

/** The height of the frame before its story reports its own, in CSS px, in a page with no height of its own yet. */
const WAITING_HEIGHT = 240;

/**
 * Tells the page around the embed how tall the story is.
 *
 * @param height - the height, in CSS px; none until it is known, so a page never shrinks to a story still loading.
 */
const useHostHeight = (height: number | undefined): void => {
  useEffect(() => {
    if (height === undefined || window.parent === window) return;
    const message: EmbedSizeMessage = { type: EMBED_SIZE_TYPE, height };
    window.parent.postMessage(message, "*");
  }, [height]);
};

/**
 * The height the story's frame is held at: the one the address sets, or the tallest the stage allows. A story that
 * grows with its window would otherwise grow its frame, and a page that follows it, for ever; one that is really
 * taller scrolls inside its frame.
 *
 * @param view - the view.
 * @param reported - the height the story reported, in CSS px.
 */
const heightSet = (view: ViewState, reported: number | undefined): number | undefined => {
  if (view.height !== "auto") return view.height;
  return reported !== undefined && reported > STAGE_HEIGHT_RANGE.max ? STAGE_HEIGHT_RANGE.max : undefined;
};

/** Follows the window's height: the room the page around the embed gives it. */
const subscribeToResize = (onChange: () => void): (() => void) => {
  window.addEventListener("resize", onChange);
  return (): void => window.removeEventListener("resize", onChange);
};

/** The window's height, in CSS px. */
const useWindowHeight = (): number => useSyncExternalStore(subscribeToResize, () => window.innerHeight);

/**
 * An element's height, followed: a message wraps as the page around it narrows.
 *
 * @param element - the element.
 */
const useElementHeight = (element: RefObject<HTMLElement | null>): number | undefined => {
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const shown = element.current;
    if (shown === null) return;
    const observer = new ResizeObserver(() => setHeight(Math.ceil(shown.getBoundingClientRect().height)));
    observer.observe(shown);
    return (): void => observer.disconnect();
  }, [element]);
  return height;
};

/**
 * A text in place of a story, in the catalogue's theme; the frame's own error box would be drawn by the frame.
 *
 * @param props - the message, what went wrong when it is known, and whether something failed.
 */
const EmbedNotice = ({
  message,
  detail,
  isFailure
}: {
  readonly message: string;
  readonly detail?: string;
  readonly isFailure?: boolean;
}): ReactNode => {
  const notice = useRef<HTMLDivElement>(null);
  useHostHeight(useElementHeight(notice));
  return (
    <div
      ref={notice}
      className="forgebook-embed__message"
      role="alert"
      data-failed={isFailure === true ? "" : undefined}
    >
      {message}
      {detail === undefined ? null : <p className="forgebook-embed__detail">{detail}</p>}
    </div>
  );
};

/** What the embedded story needs. */
type EmbedStoryProps = {
  /** The story and its place. */
  readonly location: StoryLocation;
  /** The view the address names. */
  readonly view: ViewState;
  /** The values the address sets on the story's args. */
  readonly panelArgs: PanelArgs;
  /** The frame page's address. */
  readonly frameUrl: string;
};

/**
 * The story, in its frame, as tall as it is and at least the height the window gives it.
 *
 * @param props - the story, the view, its args and the frame page.
 */
const EmbedStory = ({ location, view, panelArgs, frameUrl }: EmbedStoryProps): ReactNode => {
  const catalogue = useCatalogue();
  const { story, component, source } = location;
  const [fixed, setFixed] = useState<FixedView>(NOT_FIXED);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const { heights, settled } = useFrameMessages({
    onReady: (frame: Window, message: ReadyMessage): void => {
      setFixed(message.fixed);
      setFailure(undefined);
      const args: ShellMessage = { type: "forgebook:args", args: panelArgs };
      frame.postMessage(args, framesOrigin());
    },
    onCall: (): void => undefined,
    onFailed: (_storyId: string, message: string): void => setFailure(message)
  });
  const shownView = withFixed(view, fixed);
  const isSystemDark = useSystemDark();
  const isDark = shellIsDark({
    appearance: "story",
    values: shownView.switches,
    switches: catalogue.switches,
    isSystemDark,
    isComparing: false
  });
  useEffect(() => {
    document.documentElement.setAttribute(APPEARANCE_ATTRIBUTE, isDark ? "dark" : "light");
  }, [isDark]);
  const windowHeight = useWindowHeight();
  // the frame's address is the one the page opened with: what the story fixes comes from the frame itself, and a new
  // address would load it again
  const address = frameAddress(frameUrl, story.id, view, catalogue.switches);
  const reported = settled.has(address) ? heights.get(address) : undefined;
  const fixedHeight = heightSet(shownView, reported);
  const ownHeight =
    fixedHeight ?? (reported === undefined ? undefined : Math.max(reported, story.height ?? 0));
  useHostHeight(failure === undefined ? ownHeight : undefined);
  return (
    <main
      className="forgebook-embed"
      style={{
        backgroundColor: storyBackground(source.background, shownView, catalogue, isSystemDark)
      }}
    >
      {failure === undefined ? null : (
        <EmbedNotice message={STRINGS.embedFailed} detail={failure} isFailure={true} />
      )}
      {/* kept while it failed: a frame that recovers (an edited story) says so, and takes the page back */}
      <div
        className="forgebook-embed__story"
        hidden={failure !== undefined}
        style={{ width: shownView.width === "fill" ? undefined : shownView.width }}
      >
        <FrameView
          title={STRINGS.frameTitle(component.name, story.name)}
          address={address}
          heights={heights}
          settled={settled}
          fallbackHeight={WAITING_HEIGHT}
          sceneHeight={Math.max(story.height ?? 0, windowHeight)}
          fixedHeight={fixedHeight}
        />
      </div>
    </main>
  );
};

/**
 * The page: the story the address names, or why there is none.
 *
 * @param props - the catalogue's name, its sources, its frame page, and how its stories take the address's texts.
 */
const EmbedContent = ({
  title,
  sources,
  frameUrl,
  addressTexts
}: Pick<ShellConfig, "title" | "sources" | "frameUrl"> & {
  readonly addressTexts: AddressTexts;
}): ReactNode => {
  const catalogue = useCatalogue();
  const tree = useMemo(() => storyTree(sources), [sources]);
  // the address is read once: an embed has nowhere to go, so nothing rewrites it
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const storyId = params.get("story");
  const location = storyId === null ? undefined : findStory(tree, storyId);
  const name = location?.component.name;
  useEffect(() => {
    document.title = name === undefined ? title : `${name} · ${title}`;
  }, [name, title]);
  if (location === undefined) {
    return (
      <main className="forgebook-embed">
        <EmbedNotice message={storyId === null ? STRINGS.embedNoStory : STRINGS.embedUnknownStory(storyId)} />
      </main>
    );
  }
  return (
    <EmbedStory
      location={location}
      view={parseView(params.toString(), catalogue)}
      // whoever embeds the story writes its address, as whoever shares a link does: the same rule applies
      panelArgs={addressArgsFor(parsePanelArgsParam(params.get("args")), addressTexts)}
      frameUrl={frameUrl}
    />
  );
};

/**
 * One story alone, inside the catalogue's settings.
 *
 * @param props - the catalogue's configuration.
 */
export const EmbedPage = (props: ShellConfig): ReactNode => (
  <CatalogueContext.Provider value={useConfiguredCatalogue(props)}>
    <EmbedContent
      title={props.title}
      sources={props.sources}
      frameUrl={props.frameUrl}
      addressTexts={props.addressTexts ?? "any"}
    />
  </CatalogueContext.Provider>
);
