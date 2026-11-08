/**
 * Tests that the shell hands its components their elements on every React it runs on: the shell runs on the project's
 * React, and React 18 passes no `ref` to a function component, so a component that takes one as a prop leaves the
 * caller with nothing (the stage's frame, which Replay, the story check and the clock controls talk to).
 *
 * @module
 */
// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { FrameView } from "../src/shell/FrameView.tsx";

/** The shell's sources. */
const SHELL = join(import.meta.dirname, "..", "src", "shell");

/** A props type's block, from its name to the closing brace at the start of a line. */
const PROPS_TYPES = /export type \w+Props = \{[\s\S]*?\n\};/g;

describe("the shell's refs", () => {
  it("gives the stage its frame's iframe", () => {
    const frameRef = createRef<HTMLIFrameElement>();
    const host = document.createElement("div");
    const root = createRoot(host);
    flushSync(() =>
      root.render(
        <FrameView
          frame={frameRef}
          title="Story"
          address="about:blank"
          heights={new Map()}
          fallbackHeight={100}
          settled={new Set()}
        />
      )
    );
    expect(frameRef.current).toBeInstanceOf(HTMLIFrameElement);
    root.unmount();
  });

  it("has no component that takes `ref` as a prop, which React 18 never passes", () => {
    const offenders = readdirSync(SHELL)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) =>
        [...readFileSync(join(SHELL, file), "utf8").matchAll(PROPS_TYPES)].some((block) =>
          /\n\s+readonly ref\??:/.test(block[0])
        )
      );
    expect(offenders).toEqual([]);
  });
});
