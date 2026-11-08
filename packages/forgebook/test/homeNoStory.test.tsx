/**
 * Tests for the home of a catalogue with no story yet: where it looks and how to write one, for a catalogue that names
 * patterns; the sources' one sentence otherwise.
 *
 * @module
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomePage, type HomePageProps } from "../src/shell/HomePage.tsx";
import { storyTree } from "../src/storyTree.ts";

/** The home's props, with no source. */
const PROPS: HomePageProps = {
  title: "First",
  tree: storyTree([]),
  sources: [],
  recent: [],
  hrefOf: (): string => "",
  onOpen: (): void => undefined,
  header: null
};

describe("HomePage", () => {
  it("names the patterns that list files, and how to write the first story", () => {
    const html = renderToStaticMarkup(
      <HomePage {...PROPS} storyGlobs={["src/**/*.stories.tsx", "!src/drafts/**", "!(old)/*.stories.tsx"]} />
    );
    expect(html).toContain("No stories yet");
    expect(html).toContain("<code>src/**/*.stories.tsx</code>");
    expect(html).toContain("<code>!(old)/*.stories.tsx</code>");
    expect(html).not.toContain("!src/drafts");
    expect(html).toContain("forgebook new");
  });

  it("keeps its one sentence for a catalogue that names no pattern", () => {
    const html = renderToStaticMarkup(<HomePage {...PROPS} />);
    expect(html).toContain("a source with story files shows its families here");
    expect(html).not.toContain("forgebook new");
  });
});
