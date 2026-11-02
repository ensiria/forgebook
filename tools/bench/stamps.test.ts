/**
 * The script that stamps a page, and reading its stamps.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { pageStamps, type StampedPage, stampScript, waitForStamps } from "./stamps.ts";

/** A page holding these stamps; an error is a page being replaced. */
const pageOf = (stamps: Readonly<Record<string, number>> | Error): StampedPage => ({
  evaluate: async (): Promise<unknown> => {
    if (stamps instanceof Error) throw stamps;
    return stamps;
  }
});

describe("stampScript", () => {
  it("is valid JavaScript that carries what to watch", () => {
    const script = stampScript({ texts: ["Overlays"], selectors: [".table"] });
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('"Overlays"');
    expect(script).toContain('".table"');
  });
});

describe("pageStamps", () => {
  it("reads the page's stamps", async () => {
    expect(await pageStamps(pageOf({ a: 100 }))).toEqual({ a: 100 });
  });

  it("has none while the page is being replaced", async () => {
    expect(await pageStamps(pageOf(new Error("gone")))).toEqual({});
  });
});

describe("waitForStamps", () => {
  it("gives the times in the order asked", async () => {
    expect(await waitForStamps(pageOf({ a: 1, b: 2 }), ["b", "a"], Date.now() + 1000)).toEqual([2, 1]);
  });

  it("names what never showed, so a broken selector reads as itself", async () => {
    await expect(waitForStamps(pageOf({ a: 1 }), ["a", "b"], Date.now() - 1)).rejects.toThrow(
      "never drawn: b"
    );
  });
});
