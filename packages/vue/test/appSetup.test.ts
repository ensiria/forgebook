/**
 * Tests for what a Vue catalogue's preview does to every story's app (`setup`), in the page and on the server, and a
 * preview run again after an edit.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { describe, expect, it } from "vitest";
import { type App, defineComponent, h, inject } from "vue";

import { setup } from "../src/appSetup.ts";
import { createVueRenderer, vueRenderer } from "../src/vueRenderer.ts";

/** A drawing of a story that draws a component. */
const drawing = (component: ReturnType<typeof defineComponent>): StoryDrawing => {
  const loaded = readStory(
    { default: { title: "Kit/Thing" }, Plain: { render: () => h(component) } },
    "Plain"
  );
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:kit-thing--plain", name: "Plain", title: "Kit/Thing" },
    story: loaded,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** Reads what the story's app provides. */
const Reads = defineComponent({
  setup: () => {
    const value = inject<string>("framework", "none");
    return () => h("p", value);
  }
});

/** Calls a method a global mixin gives. */
const Greets = defineComponent({ template: "<b>{{ greeting() }}</b>" });

describe("setup", () => {
  it("installs on every story's app before it is drawn, in the page and on the server: a value, a global mixin", async () => {
    setup((app) => {
      app.provide("framework", "from the preview");
      app.mixin({ methods: { greeting: (): string => "Hello" } });
    });
    const element = document.createElement("div");
    document.body.append(element);
    const mounted = vueRenderer.mount(element, drawing(Greets), () => undefined);
    await mounted.drawn;
    expect(element.textContent).toBe("Hello");
    mounted.unmount();
    element.remove();
    expect(await vueRenderer.renderToString(drawing(Reads))).toContain("from the preview");
  });

  it("runs after a framework's preparation, so it can use and override it", async () => {
    const renderer = createVueRenderer({
      prepareApp: (app: App): void => {
        app.provide("framework", "Nuxt");
      }
    });
    setup((app) => {
      app.provide("framework", `${String(app._context.provides["framework"])} and the preview`);
    });
    expect(await renderer.renderToString(drawing(Reads))).toContain("Nuxt and the preview");
  });

  it("replaces the earlier set-ups when the preview runs again after stories were drawn", async () => {
    const calls: string[] = [];
    setup(() => {
      calls.push("first");
    });
    await vueRenderer.renderToString(drawing(Reads));
    setup(() => {
      calls.push("edited");
    });
    calls.length = 0;
    await vueRenderer.renderToString(drawing(Reads));
    expect(calls).toEqual(["edited"]);
  });
});
