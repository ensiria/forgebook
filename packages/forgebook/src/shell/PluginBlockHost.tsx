/**
 * A plugin's block of a docs page: what it is told.
 *
 * @module
 */
import { type ReactNode, useCallback, useMemo, useRef } from "react";

import type { PluginDocBlockContext, PluginStoryFrame, PluginView } from "../plugin.ts";
import { findStory, type StoryTree, type TreeSource } from "../storyTree.ts";
import type { ViewSwitch } from "../switches.ts";
import { frameAddress, isComparing, liveView, type ViewState } from "../viewState.ts";
import { showAsideStory } from "./asideStory.ts";
import { PluginViewHost, pluginText, useShellAppearance } from "./PluginViewHost.tsx";
import { STRINGS } from "./strings.ts";

/** What a block needs of its page. */
export type PluginBlockPage = {
  /** The tree, where a story is found. */
  readonly tree: StoryTree;
  /** The view. */
  readonly view: ViewState;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The catalogue's switches, for a frame's address. */
  readonly switches: readonly ViewSwitch[];
  /** The colour a source's stories' page has in the view. */
  readonly backgroundOf: (source: TreeSource) => string | undefined;
  /** The texts the catalogue replaces, by name. */
  readonly strings: Readonly<Record<string, string>>;
};

/** The host's props. */
export type PluginBlockHostProps = {
  /** Loads the module that draws the block. */
  readonly load: () => Promise<{ readonly view: PluginView<PluginDocBlockContext> }>;
  /** The plugin's id, which names its texts. */
  readonly pluginId: string;
  /** What the fence's line says after its name. */
  readonly argument: string;
  /** The text inside the fence. */
  readonly body: string;
  /** Its page. */
  readonly page: PluginBlockPage;
};

/**
 * A plugin's docs block.
 *
 * @param props - how it loads, and what it is told.
 */
export const PluginBlockHost = ({
  load,
  pluginId,
  argument,
  body,
  page
}: PluginBlockHostProps): ReactNode => {
  const appearance = useShellAppearance();
  // read when the view asks: the page of that moment
  const pageRef = useRef(page);
  pageRef.current = page;
  const showStory = useCallback(
    (
      target: HTMLElement,
      options: { readonly title: string; readonly storyId: string }
    ): PluginStoryFrame => {
      const { tree, view, frameUrl, switches, backgroundOf } = pageRef.current;
      const location = findStory(tree, options.storyId);
      if (location === undefined) throw new Error(STRINGS.unknownStory(options.storyId));
      return showAsideStory(target, options.title, {
        address: frameAddress(frameUrl, options.storyId, view, switches),
        width: "fill",
        background: backgroundOf(location.source),
        args: {},
        view: isComparing(view) ? undefined : liveView(view)
      });
    },
    []
  );
  const text = useMemo(() => pluginText(page.strings, pluginId), [page.strings, pluginId]);
  const context = useMemo(
    (): PluginDocBlockContext => ({ appearance, text, argument, body, showStory }),
    [appearance, text, argument, body, showStory]
  );
  return <PluginViewHost load={load} context={context} />;
};
