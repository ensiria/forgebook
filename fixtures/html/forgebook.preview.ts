/**
 * The HTML fixture's preview: a decorator around every story, so a story shows it is inside the catalogue's own wrapper
 * and which language it is drawn in. It answers in the story's own kind: HTML around HTML, so drawing again keeps what
 * stays, and a node around a node.
 *
 * @module
 */
import type { Preview } from "@forgebook/html";

export default {
  decorators: [
    (story, context) => {
      const lang = String(context.globals["lang"] ?? "en").replace(/[^\w-]/g, "");
      const inner = story();
      if (typeof inner === "string") return `<div data-testid="preview" data-lang="${lang}">${inner}</div>`;
      const wrapper = document.createElement("div");
      wrapper.dataset["testid"] = "preview";
      wrapper.dataset["lang"] = lang;
      wrapper.append(inner);
      return wrapper;
    }
  ]
} satisfies Preview;
