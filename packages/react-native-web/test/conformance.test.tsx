/**
 * The React Native renderer passing the adapter suite: the root it draws each story in must not change what every
 * adapter does.
 *
 * @module
 */
import { join } from "node:path";

import { codeOf } from "@forgebook/react/code";
import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";
import { isValidElement, type ReactNode, useState } from "react";
import { Pressable, Text } from "react-native";

import { nativeRenderer } from "../src/nativeRenderer.ts";
import { extractStoryComponent } from "../src/vite/extractDocs.ts";
import { NATIVE_FIXTURE_DIR } from "./fixturePaths.ts";

/** What a decorator's `story()` gave, typed `unknown` by the frame. */
const asNode = (value: unknown): ReactNode => (isValidElement(value) ? value : null);

/** The subject's story: a greeting with a counter of its own, written with React Native's components. */
const Greeting = ({ name }: { readonly name?: unknown }): ReactNode => {
  const [clicks, setClicks] = useState(0);
  if (name === THROWING_NAME) throw new Error("No greeting");
  return (
    <Pressable role="button" onPress={(): void => setClicks(clicks + 1)}>
      <Text>{`Hello ${String(name)} ${clicks}`}</Text>
    </Pressable>
  );
};

/**
 * A drawing of the greeting.
 *
 * @param name - its name.
 */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: { render: (args: { readonly name?: unknown }) => <Greeting name={args.name} /> }
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
  name: "React Native Web",
  renderer: nativeRenderer,
  drawing,
  // the catalogue's decorators are markup of the page around the React Native root, as a web preview's are
  decorator:
    (label: string): LoadedDecorator =>
    (story: () => unknown): ReactNode => <section data-decorator={label}>{asNode(story())}</section>,
  codeOf,
  docsOf: () => {
    const read = extractStoryComponent(join(NATIVE_FIXTURE_DIR, "src", "ProfileCard.stories.tsx"));
    if (typeof read === "string") throw new Error(read);
    return read.docs;
  }
});
