/**
 * A design in a docs page, written as a `figma` fence with its link after the name; the text inside the fence names it
 * for the frame's accessible title.
 *
 * @module
 */
import { figmaLink } from "forgebook/figma-link";
import type { PluginDocBlockContext } from "forgebook/plugin";
import { type PluginViewProps, reactView } from "forgebook/plugin-react";
import type { ReactNode } from "react";

import "./designTab.css";
import { FigmaEmbed } from "./FigmaEmbed.tsx";

/**
 * The block: a link that is not Figma's is said, and never framed.
 *
 * @param props - what the block is told.
 */
const DesignBlock = ({ context }: PluginViewProps<PluginDocBlockContext>): ReactNode => {
  const { argument, body, text, appearance } = context;
  const link = figmaLink(argument);
  if (typeof link === "string") {
    return (
      <p className="forgebook-problems" role="alert">
        {link}
      </p>
    );
  }
  return (
    <div className="figma-design figma-design--block">
      <FigmaEmbed text={text} appearance={appearance} link={link} title={body.trim() || argument} />
    </div>
  );
};

/** The block, as Forgebook mounts it. */
export const view = reactView(DesignBlock);
