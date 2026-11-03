/**
 * A tab that cannot be drawn, so the shell's tests see it said in the tab and the rest of the page standing.
 *
 * @module
 */
import type { PluginTabContext, PluginView } from "forgebook/plugin";

/** The tab, as Forgebook mounts it. */
export const view: PluginView<PluginTabContext> = () => {
  throw new Error("The probe breaks on purpose");
};
