/**
 * A plugin's view in its place: loads its module, hands it an element and its context, keeps it up to date, and takes
 * it away.
 *
 * @remarks
 * Loads with the first plugin view shown. A view is someone else's code: one that cannot load, or that throws, is said
 * in its place and leaves the shell standing.
 *
 * @module
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { PluginTabContext, PluginView, PluginViewContext, PluginViewHandle } from "../plugin.ts";
import { LATER_STRINGS } from "./laterStrings.ts";
import { APPEARANCE_ATTRIBUTE } from "./useAppearance.ts";

/** The shell's appearance, as its root says it now. */
const appearanceNow = (): PluginTabContext["appearance"] =>
  document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE) === "dark" ? "dark" : "light";

/**
 * The shell's appearance, followed while a view is shown.
 *
 * @returns the appearance.
 */
export const useShellAppearance = (): PluginTabContext["appearance"] => {
  const [appearance, setAppearance] = useState(appearanceNow);
  useEffect(() => {
    const observer = new MutationObserver((): void => setAppearance(appearanceNow()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [APPEARANCE_ATTRIBUTE] });
    return (): void => observer.disconnect();
  }, []);
  return appearance;
};

/**
 * What a plugin's text says.
 *
 * @param strings - the texts the catalogue replaces, by name.
 * @param pluginId - the plugin's id.
 * @returns the context's `text`.
 */
export const pluginText =
  (strings: Readonly<Record<string, string>>, pluginId: string): PluginViewContext["text"] =>
  (key: string, fallback: string, values: Readonly<Record<string, string>> = {}): string =>
    (strings[`plugin.${pluginId}.${key}`] ?? fallback).replace(
      /\{(\w+)\}/g,
      (written: string, name: string): string => values[name] ?? written
    );

/** An error as a sentence. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * A plugin's view.
 *
 * @param props - how it loads, and what it is told.
 */
export const PluginViewHost = <TContext extends PluginViewContext>({
  load,
  context
}: {
  readonly load: () => Promise<{ readonly view: PluginView<TContext> }>;
  readonly context: TContext;
}): ReactNode => {
  const targetRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<PluginViewHandle<TContext> | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
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
      try {
        viewRef.current?.unmount();
      } catch (error) {
        // nobody is left to read it in place, and thrown here it would take the shell down
        window.reportError(error);
      }
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
        {LATER_STRINGS.pluginError}: {problem}
      </p>
    );
  }
  // no box of its own: a view's height reads its place's
  return <div ref={targetRef} style={{ display: "contents" }} />;
};
