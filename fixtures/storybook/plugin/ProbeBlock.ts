/**
 * The probe's docs block: what the fence says, and the story its line names, in the page.
 *
 * @module
 */
import type { PluginDocBlockContext, PluginStoryFrame, PluginView } from "forgebook/plugin";

/** The block, as Forgebook mounts it. */
export const view: PluginView<PluginDocBlockContext> = (target, context) => {
  const line = target.ownerDocument.createElement("p");
  line.dataset["testid"] = "probe-block";
  line.textContent = context.body.trim();
  const room = target.ownerDocument.createElement("div");
  room.style.height = "6rem";
  target.replaceChildren(line, room);
  const frame: PluginStoryFrame = context.showStory(room, {
    title: "The probed story",
    storyId: context.argument
  });
  return {
    update: (next): void => {
      line.textContent = next.body.trim();
    },
    unmount: (): void => {
      frame.remove();
      target.replaceChildren();
    }
  };
};
