/**
 * Tests for a story's links and router: `NuxtLink`'s boolean props written in a template, a click that would open
 * another tab, the cells of a matrix sharing one router, and an external navigation.
 *
 * @module
 */
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type VNode } from "vue";

import { NuxtLink } from "../src/app/components.ts";
import { navigateTo, useRoute } from "../src/app/router.ts";
import { storyNuxt } from "../src/storyNuxt.ts";
import { drawing, drawn, settled, takeAway } from "./drawStory.ts";

afterEach(() => {
  takeAway();
});

/** Shows the route's path. */
const PathReader = defineComponent(() => {
  const route = useRoute();
  return (): VNode => h("p", route.path);
});

describe("NuxtLink", () => {
  it("reads its boolean props as a template writes them, bare", async () => {
    const element = await drawn(
      drawing(() =>
        h(
          defineComponent({
            template:
              '<NuxtLink to="/blog/a" custom v-slot="{ href }"><b :data-href="href">a</b></NuxtLink>' +
              '<NuxtLink to="/about" external>about</NuxtLink>'
          })
        )
      )
    );
    await settled();
    expect(element.querySelector("b")?.dataset["href"]).toBe("/blog/a");
    // a custom link draws only its slot
    expect(element.querySelectorAll("a")).toHaveLength(1);
    element.querySelector("a")?.click();
    expect(storyNuxt().calls).toEqual([{ name: "navigateTo", values: ["/about", { external: true }] }]);
  });

  it("keeps a click that would open another tab, recording it", async () => {
    const element = await drawn(
      drawing(() => h("div", [h(NuxtLink, { to: "/blog/b" }, () => "b"), h(PathReader)]))
    );
    const event = new MouseEvent("click", { cancelable: true, bubbles: true, metaKey: true });
    element.querySelector("a")?.dispatchEvent(event);
    const middle = new MouseEvent("auxclick", { cancelable: true, bubbles: true, button: 1 });
    element.querySelector("a")?.dispatchEvent(middle);
    await settled();
    expect(event.defaultPrevented && middle.defaultPrevented).toBe(true);
    expect(element.querySelector("p")?.textContent).toBe("/");
    expect(storyNuxt().calls.map((call) => call.values[1])).toEqual([{ open: true }, { open: true }]);
  });
});

describe("the router", () => {
  it("is one for the cells of a story drawn at once, so a handler in any cell moves them all", async () => {
    const story = drawing(() => h(PathReader));
    const first = await drawn(story);
    const second = await drawn(story);
    await navigateTo("/about");
    await settled();
    expect([first.textContent, second.textContent]).toEqual(["/about", "/about"]);
  });

  it("records an external navigation inside the app instead of moving", async () => {
    await drawn(drawing(() => h(PathReader)));
    await navigateTo("/about", { external: true });
    expect(storyNuxt().route.path).toBe("/");
    expect(storyNuxt().calls).toEqual([{ name: "navigateTo", values: ["/about", { external: true }] }]);
  });
});
