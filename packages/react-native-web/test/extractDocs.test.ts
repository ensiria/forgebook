/**
 * Tests for the docs of a React Native component, read from its TypeScript props as React's are, on the React Native
 * fixture.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractFileComponent, extractStoryComponent, storyTypesModule } from "../src/vite/extractDocs.ts";
import { NATIVE_FIXTURE_DIR } from "./fixturePaths.ts";

/**
 * How long a case may take to read docs, in milliseconds: the first read builds the fixture's TypeScript program, a
 * second on its own, many on a runner where the other packages' tests build theirs at the same time.
 */
const PROGRAM_TIMEOUT = 60_000;

/** The fixture's components. */
const SRC = join(NATIVE_FIXTURE_DIR, "src");

/**
 * The props a story file's component documents, by name.
 *
 * @param storyFile - the story file, from the fixture's `src`.
 */
const propsOf = (storyFile: string): Map<string, { readonly kind: string; readonly type: string }> => {
  const read = extractStoryComponent(join(SRC, storyFile));
  if (typeof read === "string" || read.docs.name === null) throw new Error(String(read));
  return new Map(read.docs.props.map((prop) => [prop.name, prop]));
};

describe("a React Native component's docs", { timeout: PROGRAM_TIMEOUT }, () => {
  it("lists its props with their kind, a press handler among its events", () => {
    const props = propsOf("ProfileCard.stories.tsx");
    expect([...props.keys()]).toEqual(["name", "role", "isOnline", "tone", "onFollow"]);
    expect(props.get("tone")?.kind).toBe("choice");
    expect(props.get("isOnline")?.kind).toBe("toggle");
    expect(props.get("onFollow")?.kind).toBe("event");
  });

  it("leaves out the props it takes from React Native's own (Pressable's hitSlop, delayLongPress…)", () => {
    const props = propsOf("IconButton.stories.tsx");
    expect([...props.keys()]).toEqual(["icon", "label", "size", "onPress"]);
    expect(props.has("hitSlop")).toBe(false);
  });

  it("reads a component written for the web's file the same as its phone's (a .web.tsx variant)", () => {
    const read = extractStoryComponent(join(SRC, "PlatformNote.stories.tsx"));
    if (typeof read === "string" || read.docs.name === null) throw new Error(String(read));
    expect(read.docs.props.map((prop) => prop.name)).toEqual(["prefix"]);
  });

  it("gives a new story file this package's types to import", () => {
    expect(storyTypesModule).toBe("@forgebook/react-native-web");
    const read = extractFileComponent(join(SRC, "TaskList.tsx"));
    if (typeof read === "string" || read.docs.name === null) throw new Error(String(read));
    expect(read.docs.name).toBe("TaskList");
  });
});
