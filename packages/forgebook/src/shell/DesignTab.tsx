/**
 * The panel's Design tab: the story's design, embedded from Figma, and the two side by side.
 *
 * @remarks
 * This module and its style sheet load the first time the tab opens (`DesignTabLoader`), and the embed is framed only
 * while it is shown: Figma's viewer is far heavier than the shell. Everything the tab needs comes through its props.
 *
 * The comparison is a modal dialog that loads the story in a frame of its own, sized as the stage has it. The tab answers
 * that frame itself, with the panel's values and the view, and the stage leaves it alone (`FRAME_ASIDE_ATTRIBUTE`). Being
 * modal, the view cannot change under it, so one answer is enough. Escape closes the dialog only while the focus is on
 * the shell's side: a key pressed inside a frame stays there, so the bar's Close is always on screen. The comparison puts the two where a person can look from one to the other: it draws no overlay
 * and gives no percentage, because Figma's rendering and the browser's differ and such a number would mislead.
 *
 * @module
 */
import type { FigmaLink } from "@forgebook/story-format/source";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { isFrameMessage, type PanelArgs, type ShellMessage } from "../messages.ts";
import type { LiveView, StageWidth } from "../viewState.ts";
import "./designTab.scss";
import { figmaEmbedAddress } from "./figmaEmbed.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { APPEARANCE_ATTRIBUTE } from "./useAppearance.ts";
import { FRAME_ASIDE_ATTRIBUTE } from "./useFrameMessages.ts";

/** The tab's props. */
export type DesignTabProps = {
  /** The story's design. */
  readonly link: FigmaLink;
  /** What the design is of, for the frames' accessible titles and the comparison's heading. */
  readonly title: string;
  /** The story's frame, for the comparison. */
  readonly frame: {
    /** Its address, in the view shown. */
    readonly address: string;
    /** Its width on the stage. */
    readonly width: StageWidth;
    /** The colour its page has in the view; none without one. */
    readonly background: string | undefined;
    /** The values set in the panel, sent once it is ready. */
    readonly args: PanelArgs;
    /** The view's live part, sent once it is ready; none when the address already says it all (the compare view). */
    readonly view: LiveView | undefined;
  };
};

/** The link that opens the design in Figma, whose own tools (the inspector, the layers) an embed leaves out. */
const OpenInFigma = ({ link }: Pick<DesignTabProps, "link">): ReactNode => (
  <a className="forgebook-button" href={link.url} target="_blank" rel="noopener noreferrer">
    <Icon name="external" size={14} />
    {STRINGS.openInFigma}
  </a>
);

/**
 * The design, framed from Figma; a spinner until it answers.
 *
 * @remarks
 * The shell's appearance is read once: following a change would reload the viewer and lose where the reader had panned to.
 *
 * @param props - the design and what it is of.
 */
const FigmaEmbed = ({ link, title }: Pick<DesignTabProps, "link" | "title">): ReactNode => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [address] = useState(() =>
    figmaEmbedAddress(link, document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE) === "dark")
  );
  return (
    <div className="forgebook-design__embed">
      <iframe
        className="forgebook-design__frame"
        title={STRINGS.designFrame(title)}
        src={address}
        allowFullScreen={true}
        // the catalogue's address says nothing Figma needs: `embed-host` names the product
        referrerPolicy="no-referrer"
        onLoad={(): void => setIsLoaded(true)}
      />
      {isLoaded ? null : (
        <div className="forgebook-frame-loading" role="status">
          <span className="forgebook-frame-loading__label">
            <span className="forgebook-spinner" aria-hidden="true" />
            {STRINGS.designLoading}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * The story and its design, side by side, over the whole page.
 *
 * @param props - the design, the story's frame, and what to do once it closes.
 */
const CompareDialog = ({
  link,
  title,
  frame,
  onClosed
}: DesignTabProps & { readonly onClosed: () => void }): ReactNode => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  useEffect(() => {
    const answer = (event: MessageEvent): void => {
      const story = frameRef.current?.contentWindow;
      if (event.origin !== window.location.origin || event.source !== story || !story) return;
      if (!isFrameMessage(event.data) || event.data.type !== "forgebook:ready") return;
      const send = (message: ShellMessage): void => story.postMessage(message, window.location.origin);
      send({ type: "forgebook:args", args: frame.args });
      if (frame.view !== undefined) send({ type: "forgebook:view", view: frame.view });
    };
    window.addEventListener("message", answer);
    return (): void => window.removeEventListener("message", answer);
  }, [frame.args, frame.view]);
  return (
    // the keys stop here: the shell's shortcuts would act on the page the dialog hides
    <dialog
      ref={dialogRef}
      className="forgebook-design__compare"
      aria-label={STRINGS.designCompareTitle(title)}
      onClose={onClosed}
      onKeyDown={(event: KeyboardEvent<HTMLDialogElement>): void => event.stopPropagation()}
    >
      <div className="forgebook-design__bar">
        <h2 className="forgebook-design__heading">{STRINGS.designCompareTitle(title)}</h2>
        <OpenInFigma link={link} />
        <button
          type="button"
          className="forgebook-icon-button"
          title={STRINGS.closeDesignCompare}
          aria-label={STRINGS.closeDesignCompare}
          onClick={(): void => dialogRef.current?.close()}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="forgebook-design__panes">
        <figure className="forgebook-design__pane">
          <figcaption className="forgebook-design__caption">{STRINGS.designStoryPane}</figcaption>
          <div className="forgebook-design__story" style={{ backgroundColor: frame.background }}>
            <iframe
              className="forgebook-design__frame"
              title={STRINGS.frameTitle(title, STRINGS.designStoryPane)}
              ref={frameRef}
              src={frame.address}
              {...{ [FRAME_ASIDE_ATTRIBUTE]: "" }}
              style={frame.width === "fill" ? undefined : { width: frame.width }}
            />
          </div>
        </figure>
        <figure className="forgebook-design__pane">
          <figcaption className="forgebook-design__caption">{STRINGS.designPane}</figcaption>
          {/* keyed: going back in the history changes the story under the dialog */}
          <FigmaEmbed key={link.url} link={link} title={title} />
        </figure>
      </div>
    </dialog>
  );
};

/**
 * The Design tab.
 *
 * @param props - the design and the story's frame.
 */
export const DesignTab = ({ link, title, frame }: DesignTabProps): ReactNode => {
  const [isComparing, setIsComparing] = useState(false);
  return (
    <div className="forgebook-design">
      <div className="forgebook-design__bar">
        <p className="forgebook-design__note">{STRINGS.designNote}</p>
        <button type="button" className="forgebook-button" onClick={(): void => setIsComparing(true)}>
          <Icon name="compare" size={14} />
          {STRINGS.designCompare}
        </button>
        <OpenInFigma link={link} />
      </div>
      {/* one Figma viewer at a time: each holds a WebGL context and a lot of memory */}
      {isComparing ? (
        <CompareDialog link={link} title={title} frame={frame} onClosed={(): void => setIsComparing(false)} />
      ) : (
        <FigmaEmbed key={link.url} link={link} title={title} />
      )}
    </div>
  );
};
