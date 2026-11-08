/**
 * Tests for the predicate a page polls a story's frame with until the frame says what became of its story.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { isFrameSettled } from "../src/frameSettled.ts";

/** A document whose root carries this status, or that has no root, as between a reload's two documents. */
const documentWith = (status: string | null | undefined): unknown => ({
  querySelector: (): unknown => (status === undefined ? null : { getAttribute: (): string | null => status })
});

describe("isFrameSettled", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true once the frame says its story is ready, failed or waiting on purpose", () => {
    for (const status of ["ready", "error", "pending"]) {
      vi.stubGlobal("document", documentWith(status));
      expect(isFrameSettled("data-forgebook-status")).toBe(true);
    }
  });

  it("is false while the frame has said nothing", () => {
    vi.stubGlobal("document", documentWith(null));
    expect(isFrameSettled("data-forgebook-status")).toBe(false);
  });

  it("is false, and does not throw, while a reloading frame has no root: a throw would end the wait at once", () => {
    vi.stubGlobal("document", documentWith(undefined));
    expect(isFrameSettled("data-forgebook-status")).toBe(false);
  });
});
