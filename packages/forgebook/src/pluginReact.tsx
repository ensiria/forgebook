/**
 * A plugin's view written in React: the few lines between the contract, which hands a view an element, and a component.
 *
 * @remarks
 * The view gets a React root of its own, so nothing of the shell's reaches it but its context. An error it does not
 * catch would otherwise leave its panel empty, so it is said in place. The root goes away a moment after the shell asks:
 * the shell asks while React commits, when a root cannot be unmounted.
 *
 * @module
 */
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";

import type { PluginView, PluginViewContext, PluginViewHandle } from "./plugin.ts";

/** The props of a view written in React. */
export type PluginViewProps<TContext extends PluginViewContext> = {
  /** What the view is told, new on every change. */
  readonly context: TContext;
};

/**
 * A component as a view: what a tab's or a block's module exports as `view`.
 *
 * @param View - the component.
 */
export const reactView =
  <TContext extends PluginViewContext>(
    View: ComponentType<PluginViewProps<TContext>>
  ): PluginView<TContext> =>
  (target: HTMLElement, context: TContext): PluginViewHandle<TContext> => {
    const root = createRoot(target, {
      onUncaughtError: (error: unknown): void => {
        const problem = target.ownerDocument.createElement("p");
        problem.className = "forgebook-problems";
        problem.setAttribute("role", "alert");
        problem.textContent = error instanceof Error ? error.message : String(error);
        target.replaceChildren(problem);
      }
    });
    const draw = (next: TContext): ReactNode => <View context={next} />;
    root.render(draw(context));
    return {
      update: (next: TContext): void => root.render(draw(next)),
      unmount: (): void => queueMicrotask(() => root.unmount())
    };
  };
