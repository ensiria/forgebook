/**
 * Vue passing the adapter suite: the definition of done every framework adapter meets.
 *
 * @module
 */
import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";
import { createCommentVNode, defineComponent, h, isVNode, ref, type VNode } from "vue";

import { codeOf } from "../src/storyTemplate.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import { vueRenderer } from "../src/vueRenderer.ts";

/** What a decorator's `story()` gave, typed `unknown` by the frame. */
const asVNode = (value: unknown): VNode => (isVNode(value) ? value : createCommentVNode());

/** The subject's story: a greeting with a counter of its own. */
const Greeting = defineComponent({
  props: { name: { type: null, default: undefined } },
  setup: (props: Readonly<{ name?: unknown }>): (() => VNode) => {
    const clicks = ref(0);
    return (): VNode => {
      if (props.name === THROWING_NAME) throw new Error("No greeting");
      return h("button", { type: "button", onClick: () => (clicks.value += 1) }, [
        `Hello ${String(props.name)} ${clicks.value}`
      ]);
    };
  }
});

/** A drawing of the greeting. */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: { render: (args: { readonly name?: unknown }) => h(Greeting, { name: args.name }) }
    },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "kit:kit-greeting--plain", name: "Plain", title: "Kit/Greeting" },
    story,
    args: { name },
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

describeAdapter({
  name: "Vue",
  renderer: vueRenderer,
  drawing,
  decorator:
    (label: string): LoadedDecorator =>
    (story: () => unknown): VNode =>
      h("section", { "data-decorator": label }, [asVNode(story())]),
  codeOf,
  docsOf: () =>
    extractComponentDocs(join(import.meta.dirname, "..", "fixtures", "docs", "src", "Badge.stories.ts"))
});
