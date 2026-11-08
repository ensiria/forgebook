/**
 * A story of a composed catalogue (`refs`), shown read-only: its own catalogue's embed page in a frame, on that
 * catalogue's origin, with this catalogue's switches. Loaded the first time one is opened.
 *
 * @remarks
 * The embed page is the composed catalogue's own, so the story runs with its own preview, theme and frames, and this
 * page runs none of its code: what crosses one way is the address (the story and the switches, which the embed reads as
 * any address), the other way a height (`EmbedSizeMessage`), heard only from that frame's window and origin. A change of
 * the toolbar's switches gives the frame a new address. Off this catalogue's origin the frame is sandboxed as a story's
 * frame is, which keeps it from navigating this tab.
 *
 * @module
 */
import "./refStory.scss";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { type CatalogueRef, type RefIndex, refEmbedAddress, refStoryAddress } from "../catalogueRefs.ts";
import { EMBED_SIZE_TYPE } from "../embed.ts";
import { STAGE_HEIGHT_RANGE } from "../viewState.ts";
import { FRAME_SANDBOX, framesOrigin } from "./framesOrigin.ts";
import { Icon } from "./icons.tsx";
import { REF_STRINGS } from "./refStrings.ts";
import { useRefIndex } from "./useRefIndex.ts";

/** The page's props. */
export type RefStoryPageProps = {
  /** The composed catalogues of the configuration. */
  readonly refs: readonly CatalogueRef[];
  /** The id of the catalogue the address names. */
  readonly refId: string;
  /** The story's id in it. */
  readonly storyId: string;
  /** This catalogue's switches, by id, with the values the view gives them. */
  readonly switches: Readonly<Record<string, string>>;
};

/** The frame's height before the embed reports its own, in CSS px. */
const WAITING_HEIGHT = 240;

/**
 * The browser features another site's page may use: what shows a story (full screen, a video, a copy button), and none
 * that asks the reader (the camera, the microphone, the position, the clipboard's reading). A permission the reader
 * gave this catalogue would otherwise be that site's too, without a question.
 */
const REF_PERMISSIONS = [
  "fullscreen",
  "picture-in-picture",
  "autoplay",
  "encrypted-media",
  "clipboard-write"
].join("; ");

/** The story's component title and name, as the index gives them; none until it is read, or when it lists neither. */
const namesOf = (
  index: RefIndex | undefined,
  storyId: string
): { readonly component: string; readonly story: string } | undefined => {
  for (const component of index?.components ?? []) {
    const story = component.stories.find((each) => each.id === storyId);
    if (story !== undefined) return { component: component.title.split("/").join(" › "), story: story.name };
  }
  return undefined;
};

/**
 * Whether a message is a height from the embed page: its type and a number, nothing else is read.
 *
 * @param data - the message.
 */
const heightOf = (data: unknown): number | undefined => {
  if (typeof data !== "object" || data === null) return undefined;
  const type: unknown = Reflect.get(data, "type");
  const height: unknown = Reflect.get(data, "height");
  // never taller than a stage: the embed scrolls a taller story inside its frame, and a page could say any number
  return type === EMBED_SIZE_TYPE && typeof height === "number" && Number.isFinite(height) && height > 0
    ? Math.min(Math.ceil(height), STAGE_HEIGHT_RANGE.max)
    : undefined;
};

/**
 * The embed page's frame, as tall as the story it reports.
 *
 * @param props - the composed catalogue, the frame's address and its accessible name.
 */
const RefFrame = ({
  composed,
  address,
  title
}: {
  readonly composed: CatalogueRef;
  readonly address: string;
  readonly title: string;
}): ReactNode => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const origin = new URL(composed.url).origin;
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      const reported = heightOf(event.data);
      if (reported !== undefined) setHeight(reported);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);
  return (
    <iframe
      ref={frameRef}
      className="forgebook-ref-story__frame"
      src={address}
      title={title}
      allow={REF_PERMISSIONS}
      // on this catalogue's own origin a sandbox could be lifted by what runs in it; elsewhere it keeps this tab
      sandbox={origin === window.location.origin ? undefined : FRAME_SANDBOX}
      style={{ height: height ?? WAITING_HEIGHT }}
    />
  );
};

/**
 * Whether a composed catalogue is served on the origin this catalogue's stories run on, where it is not this page.
 *
 * @param composed - the composed catalogue.
 */
const isOnFramesOrigin = (composed: CatalogueRef): boolean => {
  const origin = new URL(composed.url).origin;
  return origin === framesOrigin() && origin !== window.location.origin;
};

/**
 * Why a story of a composed catalogue is not shown, or none: the shell names only a catalogue it composes, and one on
 * this catalogue's stories' origin would be framed as one of them and share their storage.
 *
 * @param composed - the composed catalogue the address names, if the configuration has it.
 * @param refId - the id the address names.
 */
const refusalOf = (composed: CatalogueRef | undefined, refId: string): string | undefined => {
  if (composed === undefined) return REF_STRINGS.unknownRef(refId);
  return isOnFramesOrigin(composed) ? REF_STRINGS.onFramesOrigin(composed.title) : undefined;
};

/**
 * A story of a composed catalogue, read-only.
 *
 * @param props - the composed catalogues, the one and the story the address names, and the switches.
 */
export const RefStoryPage = ({ refs, refId, storyId, switches }: RefStoryPageProps): ReactNode => {
  const composed = refs.find((each) => each.id === refId);
  const state = useRefIndex(composed, true);
  const refusal = refusalOf(composed, refId);
  if (composed === undefined || refusal !== undefined)
    return (
      <div className="forgebook-workspace" role="alert">
        <h1 className="forgebook-empty">{refusal}</h1>
      </div>
    );
  const names = namesOf(state.status === "ready" ? state.index : undefined, storyId);
  const storyName = names?.story ?? storyId;
  return (
    <div className="forgebook-workspace forgebook-ref-story">
      <header className="forgebook-header">
        <p className="forgebook-header__path">
          {[composed.title, names?.component].filter((part) => part !== undefined).join(" · ")}
        </p>
        <div className="forgebook-header__row">
          <h1 className="forgebook-header__title">{storyName}</h1>
          <a
            className="forgebook-button"
            href={refStoryAddress(composed, storyId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external" size={12} />
            {REF_STRINGS.openThere(composed.title)}
          </a>
        </div>
        <p className="forgebook-ref-story__note">{REF_STRINGS.readOnly}</p>
      </header>
      <div className="forgebook-ref-story__stage">
        <RefFrame
          // a new story is a new frame: its height starts over with it
          key={storyId}
          composed={composed}
          address={refEmbedAddress(composed, storyId, switches)}
          title={REF_STRINGS.storyTitle(storyName, composed.title)}
        />
      </div>
    </div>
  );
};
