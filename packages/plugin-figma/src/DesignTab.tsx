/**
 * The Design tab: the story's design, embedded from Figma, and the two side by side.
 *
 * @remarks
 * This module and its style sheet load the first time the tab opens, and the embed is framed only while it is shown:
 * Figma's viewer is far heavier than the shell.
 *
 * The comparison is a modal dialog with the story in a frame of its own, sized as the stage has it, which Forgebook
 * draws (`showStory`). Being modal, the view cannot change under it. Escape closes the dialog only while the focus is on
 * the shell's side: a key pressed inside a frame stays there, so the bar's Close is always on screen. The comparison puts
 * the two where a person can look from one to the other: it draws no overlay and gives no percentage, because Figma's
 * rendering and the browser's differ and such a number would mislead.
 *
 * @module
 */
import type { FigmaLink } from "forgebook/figma-link";
import type { PluginTabContext } from "forgebook/plugin";
import { type PluginViewProps, reactView } from "forgebook/plugin-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import "./designTab.css";
import { FigmaEmbed } from "./FigmaEmbed.tsx";

/** What the tab's parts read. */
type DesignProps = {
  /** What the tab is told. */
  readonly context: PluginTabContext;
  /** The story's design. */
  readonly link: FigmaLink;
  /** What the design is of, for the frames' accessible titles and the comparison's heading. */
  readonly title: string;
};

/**
 * The link that opens the design in Figma, whose own tools (the inspector, the layers) an embed leaves out.
 *
 * @param props - the tab's context and the link.
 */
const OpenInFigma = ({ context, link }: Pick<DesignProps, "context" | "link">): ReactNode => (
  <a className="forgebook-button" href={link.url} target="_blank" rel="noopener noreferrer">
    {context.text("open", "Open in Figma")}
  </a>
);

/**
 * The story and its design, side by side, over the whole page.
 *
 * @param props - the design, and what to do once it closes.
 */
const CompareDialog = ({
  context,
  link,
  title,
  onClosed
}: DesignProps & { readonly onClosed: () => void }): ReactNode => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const { showStory, text } = context;
  const heading = text("compareTitle", "{title}: the story and its design", { title });
  const storyPane = text("storyPane", "Story");
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const storyTitle = `${title} · ${storyPane}`;
  useEffect(() => {
    const target = storyRef.current;
    if (target === null) return undefined;
    const frame = showStory(target, { title: storyTitle });
    return (): void => frame.remove();
  }, [showStory, storyTitle]);
  return (
    // the keys stop here: the shell's shortcuts would act on the page the dialog hides
    <dialog
      ref={dialogRef}
      className="figma-design__compare"
      aria-label={heading}
      onClose={onClosed}
      onKeyDown={(event: KeyboardEvent<HTMLDialogElement>): void => event.stopPropagation()}
    >
      <div className="figma-design__bar">
        <h2 className="figma-design__heading">{heading}</h2>
        <OpenInFigma context={context} link={link} />
        <button type="button" className="forgebook-button" onClick={(): void => dialogRef.current?.close()}>
          {text("close", "Close the comparison")}
        </button>
      </div>
      <div className="figma-design__panes">
        <figure className="figma-design__pane">
          <figcaption className="figma-design__caption">{storyPane}</figcaption>
          <div ref={storyRef} className="figma-design__story" />
        </figure>
        <figure className="figma-design__pane">
          <figcaption className="figma-design__caption">{text("designPane", "Design")}</figcaption>
          <FigmaEmbed text={context.text} appearance={context.appearance} link={link} title={title} />
        </figure>
      </div>
    </dialog>
  );
};

/**
 * The Design tab.
 *
 * @param props - what the tab is told.
 */
const DesignTab = ({ context }: PluginViewProps<PluginTabContext>): ReactNode => {
  const [isComparing, setIsComparing] = useState(false);
  const { story } = context;
  const link = story.design.figma;
  if (link === undefined) return null;
  const title = `${story.componentName} › ${story.name}`;
  return (
    <div className="figma-design">
      <div className="figma-design__bar">
        <p className="figma-design__note">
          {context.text(
            "note",
            "Figma shows this to anyone who can open the file: a private one asks them to sign in."
          )}
        </p>
        <button type="button" className="forgebook-button" onClick={(): void => setIsComparing(true)}>
          {context.text("compare", "Compare with the story")}
        </button>
        <OpenInFigma context={context} link={link} />
      </div>
      {/* one Figma viewer at a time: each holds a WebGL context and a lot of memory */}
      {isComparing ? (
        <CompareDialog
          context={context}
          link={link}
          title={title}
          onClosed={(): void => setIsComparing(false)}
        />
      ) : (
        <FigmaEmbed text={context.text} appearance={context.appearance} link={link} title={title} />
      )}
    </div>
  );
};

/** The tab, as Forgebook mounts it. */
export const view = reactView(DesignTab);
