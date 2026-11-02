/**
 * A design, framed from Figma; a spinner until it answers.
 *
 * @remarks
 * The shell's appearance is read once: following a change would reload the viewer and lose where the reader had panned to.
 *
 * @module
 */
import type { FigmaLink } from "forgebook/figma-link";
import type { PluginViewContext } from "forgebook/plugin";
import { type ReactNode, useState } from "react";

import { figmaEmbedAddress } from "./embedAddress.ts";

/** The embed's props. */
type FigmaEmbedProps = Pick<PluginViewContext, "appearance" | "text"> & {
  /** The design. */
  readonly link: FigmaLink;
  /** What it is of, for the frame's accessible title. */
  readonly title: string;
};

/**
 * The embed.
 *
 * @param props - the design, what it is of, and the view's text and appearance.
 */
export const FigmaEmbed = ({ text, appearance, link, title }: FigmaEmbedProps): ReactNode => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [address] = useState(() => figmaEmbedAddress(link, appearance === "dark"));
  return (
    <div className="figma-design__embed">
      <iframe
        className="figma-design__frame"
        title={text("frame", "Design of {title}, in Figma", { title })}
        src={address}
        allowFullScreen={true}
        // the catalogue's address says nothing Figma needs: `embed-host` names the product
        referrerPolicy="no-referrer"
        onLoad={(): void => setIsLoaded(true)}
      />
      {isLoaded ? null : (
        <div className="figma-design__loading" role="status">
          <span className="forgebook-spinner" aria-hidden="true" />
          {text("loading", "Loading the design…")}
        </div>
      )}
    </div>
  );
};
