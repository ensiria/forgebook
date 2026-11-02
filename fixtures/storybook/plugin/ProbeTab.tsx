/**
 * The probe's tab, written against the contract alone: no React, the element it is handed and its context.
 *
 * @module
 */
import type { PluginTabContext, PluginView } from "forgebook/plugin";

/** What the tab shows of its context. */
const textOf = (context: PluginTabContext): string =>
  `${context.text("title", "Probe {id}", { id: context.story.id })} ${context.appearance} ` +
  JSON.stringify(context.report ?? null);

/** The tab, as Forgebook mounts it. */
export const view: PluginView<PluginTabContext> = (target, context) => {
  const line = target.ownerDocument.createElement("p");
  line.dataset["testid"] = "probe-tab";
  line.textContent = textOf(context);
  target.replaceChildren(line);
  return {
    update: (next): void => {
      line.textContent = textOf(next);
    },
    unmount: (): void => line.remove()
  };
};
