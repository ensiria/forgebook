/// <reference lib="dom" />
/**
 * The page between a client's app and a story's frame: it shows the frame and says when the story is up and how tall.
 *
 * @remarks
 * The app runs on an origin the host chooses, so a frame cannot talk to it: a frame posts to its own origin only, which
 * keeps its messages (a story's args among them) from any page that embeds it. This page is on the catalogue's origin,
 * reads the frame's messages as the shell does, and passes the app three facts and nothing else: that it runs, that
 * something was drawn, and the height. A page that embeds it learns no more than that, so it can post to any origin, as
 * it has to: the app's may be opaque. A story that fails counts as drawn, as the frame shows the error itself.
 *
 * A frame opened alone on a cold dev server can stay blank: when the server prepares a dependency again, a static import
 * of the frame's own entry fails before any of its code runs, so its reload for a stale module never happens and no
 * shell is there to load it again. So the relay does, once, when the frame loaded and has said nothing at all.
 *
 * Runs in the page, written into it by its source (`previewPages.ts`), so it takes no import.
 *
 * @module
 */

/** What the relay tells the app. */
export type PreviewRelayMessage =
  | {
      /** The relay runs: the host let the frame in, so it is worth waiting for the story. */
      readonly type: "forgebook:preview-started";
    }
  | {
      /** The story was drawn, or its error was. */
      readonly type: "forgebook:preview-ready";
    }
  | {
      /** The story's height changed. */
      readonly type: "forgebook:preview-size";
      /** The height, in CSS px. */
      readonly height: number;
    };

/**
 * Shows a story's frame and tells the embedding app about it.
 *
 * @param frameAddress - the story's frame.
 * @param title - the frame's name for a screen reader: the story's id.
 */
export const previewRelay = (frameAddress: string, title: string): void => {
  /** How long a loaded frame may stay silent before its one reload, in ms. */
  const reloadAfterMs = 4000;
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.style.cssText = "display:block;width:100%;height:100vh;border:0";
  const tell = (message: PreviewRelayMessage): void => {
    window.parent.postMessage(message, "*");
  };
  let hasHeard = false;
  let hasReloaded = false;
  frame.addEventListener("load", () => {
    setTimeout(() => {
      if (hasHeard || hasReloaded) return;
      hasReloaded = true;
      frame.contentWindow?.location.reload();
    }, reloadAfterMs);
  });
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    const { data } = event;
    if (typeof data !== "object" || data === null || !("type" in data)) return;
    hasHeard = true;
    if (data.type === "forgebook:ready" || data.type === "forgebook:error")
      tell({ type: "forgebook:preview-ready" });
    if (
      data.type === "forgebook:size" &&
      "height" in data &&
      typeof data.height === "number" &&
      data.height > 0
    ) {
      frame.style.height = `${data.height}px`;
      tell({ type: "forgebook:preview-size", height: data.height });
    }
  });
  tell({ type: "forgebook:preview-started" });
  frame.src = frameAddress;
  document.body.append(frame);
};
