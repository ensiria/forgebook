/**
 * A plugin's tab in the panel: loads its view, hands it an element and its context, keeps it up to date, and takes it
 * away with the tab.
 *
 * @remarks
 * Loads with the first plugin's tab to open. A view is someone else's code: one that cannot load, or that throws, is
 * said in its tab and leaves the shell standing. The dock draws a tab's content only while it is chosen, so a view's own
 * state goes when another tab is chosen; a frame's report does not, since the stage keeps it.
 *
 * @module
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  type JsonValue,
  PLUGIN_API_VERSION,
  type PluginStory,
  type PluginTabContext,
  type PluginView,
  type PluginViewHandle
} from "../plugin.ts";
import { type AsideStory, showAsideStory } from "./asideStory.ts";
import { STRINGS } from "./strings.ts";
import { APPEARANCE_ATTRIBUTE } from "./useAppearance.ts";

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

/** The shell's appearance, as its root says it now. */
const appearanceNow = (): PluginTabContext["appearance"] =>
  document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE) === "dark" ? "dark" : "light";

/** The shell's appearance, followed while the tab is shown. */
const useShellAppearance = (): PluginTabContext["appearance"] => {
  const [appearance, setAppearance] = useState(appearanceNow);
  useEffect(() => {
    const observer = new MutationObserver((): void => setAppearance(appearanceNow()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [APPEARANCE_ATTRIBUTE] });
    return (): void => observer.disconnect();
  }, []);
  return appearance;
};

/** An error as a sentence. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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
  const targetRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<PluginViewHandle<PluginTabContext> | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const appearance = useShellAppearance();
  // read when the view asks: the frame's view of that moment, without a new context for every change of the stage
  const asideRef = useRef(aside);
  asideRef.current = aside;
  const context = useMemo(
    (): PluginTabContext => ({
      apiVersion: PLUGIN_API_VERSION,
      appearance,
      text: (key: string, fallback: string): string => strings[`plugin.${pluginId}.${key}`] ?? fallback,
      story,
      report,
      showStory: (target: HTMLElement, title: string): (() => void) =>
        showAsideStory(target, title, asideRef.current)
    }),
    [appearance, pluginId, strings, story, report]
  );
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    let isCurrent = true;
    load()
      .then((module) => {
        const target = targetRef.current;
        if (isCurrent && target !== null) viewRef.current = module.view(target, contextRef.current);
      })
      .catch((error: unknown) => {
        if (isCurrent) setProblem(messageOf(error));
      });
    return (): void => {
      isCurrent = false;
      viewRef.current?.unmount();
      viewRef.current = undefined;
    };
  }, [load]);

  useEffect(() => {
    try {
      viewRef.current?.update(context);
    } catch (error) {
      setProblem(messageOf(error));
    }
  }, [context]);

  if (problem !== undefined) {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.pluginError}: {problem}
      </p>
    );
  }
  // no box of its own: a view's height reads the panel's
  return <div ref={targetRef} style={{ display: "contents" }} />;
};
