/**
 * The probe's tab, written against the contract alone: no React, the element it is handed and its context. A button
 * sends its frame module a value.
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
  // sends the frame module a value, which comes back in its next report
  let sent = 0;
  const send = target.ownerDocument.createElement("button");
  send.type = "button";
  send.className = "forgebook-button";
  send.textContent = "Ping the frame";
  send.addEventListener("click", () => {
    sent += 1;
    context.send?.({ ping: sent });
  });
  target.replaceChildren(line, send);
  return {
    update: (next): void => {
      line.textContent = textOf(next);
    },
    unmount: (): void => target.replaceChildren()
  };
};
