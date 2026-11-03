/**
 * Tests for a picture's file name: the story's id and the view's name, kept to letters, digits and hyphens, the
 * default view named so.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { shotName } from "../src/shotStories.ts";

describe("shotName", () => {
  it("names a picture by its story and its view, safe for any file system", () => {
    expect(shotName({ story: { id: "kit:data-badge--default" }, name: "theme=dark&width=360" })).toBe(
      "kit-data-badge--default--theme-dark-width-360.png"
    );
    expect(shotName({ story: { id: "kit:data-badge--default" }, name: "" })).toBe(
      "kit-data-badge--default--default.png"
    );
  });

  it("keeps the letters of any script an id has, so two stories never share a picture", () => {
    expect(shotName({ story: { id: "ui:skjema-knapp--åpen" }, name: "" })).toBe(
      "ui-skjema-knapp--åpen--default.png"
    );
    expect(shotName({ story: { id: "ui:按钮--默认" }, name: "" })).not.toBe(
      shotName({ story: { id: "ui:输入--默认" }, name: "" })
    );
  });

  it("stays quick on a name that is a long run of hyphens", () => {
    const name = `${"-".repeat(200_000)}x${"-".repeat(200_000)}`;
    const started = performance.now();
    expect(shotName({ story: { id: name }, name: "" })).toBe("x--default.png");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
