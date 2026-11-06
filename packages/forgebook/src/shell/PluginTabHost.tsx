/**
 * A plugin's tab in the panel: what it is told. The dock draws a tab's content only while it is chosen, so a view's own
 * state goes when another tab is chosen; a frame's report does not, since the stage keeps it.
 *
 * @module
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

import type { JsonValue, PluginStory, PluginStoryFrame, PluginTabContext, PluginView } from "../plugin.ts";
import { type AsideFrame, type AsideStory, showAsideStory } from "./asideStory.ts";
import { PluginViewHost, pluginText, useShellAppearance } from "./PluginViewHost.tsx";

/** The host's props. */
export type PluginTabHostProps = {
  /** Loads the module that draws the tab. */
  readonly load: () => Promise<{ readonly view: PluginView<PluginTabContext> }>;
  /** The plugin's id, which names its texts. */
  readonly pluginId: string;
  /** The texts the catalogue replaces, by name. */
  readonly strings: Readonly<Record<string, string>>;
  /** The story shown. */
  readonly story: PluginStory;
  /** What the plugin's frame module last reported; none before it did. */
  readonly report: JsonValue | undefined;
  /** How the story is drawn again for the view. */
  readonly aside: AsideStory;
};

/**
 * A plugin's tab.
 *
 * @param props - how it loads, and what it is told.
 */
export const PluginTabHost = ({
  load,
  pluginId,
  strings,
  story,
  report,
  aside
}: PluginTabHostProps): ReactNode => {
  const appearance = useShellAppearance();
  // read when the view asks: the stage of that moment, without a new context for every change of the stage
  const asideRef = useRef(aside);
  asideRef.current = aside;
  const asideFrames = useRef(new Set<AsideFrame>());
  const showStory = useCallback(
    (target: HTMLElement, { title }: { readonly title: string }): PluginStoryFrame => {
      const frame = showAsideStory(target, title, asideRef.current);
      asideFrames.current.add(frame);
      return {
        remove: (): void => {
          asideFrames.current.delete(frame);
          frame.remove();
        }
      };
    },
    []
  );
  const { args } = aside;
  useEffect(() => {
    if (args === undefined) return;
    for (const frame of asideFrames.current) frame.settle(args);
  }, [args]);
  const text = useMemo(() => pluginText(strings, pluginId), [strings, pluginId]);
  const context = useMemo(
    (): PluginTabContext => ({ appearance, text, story, report, showStory }),
    [appearance, text, story, report, showStory]
  );
  return <PluginViewHost load={load} context={context} />;
};
