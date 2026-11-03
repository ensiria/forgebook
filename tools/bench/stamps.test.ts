/**
 * The script that stamps a page, and reading its stamps.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  combineStamps,
  type FrameReading,
  pageStamps,
  type StampedFrame,
  type StampedPage,
  stampScript,
  waitForStamps
} from "./stamps.ts";

/** What a frame of a fake page answers; an error is a document being replaced. */
type FakeFrame = {
  /** Its stamps, none where no script runs. */
  readonly stamps: Readonly<Record<string, number>> | undefined | Error;
  /** When its element was shown. */
  readonly shown?: number;
  /** The index of its parent. */
  readonly parent?: number;
};

/** A page of these frames, the top page first. */
const framesOf = (fakes: readonly FakeFrame[]): StampedPage => {
  const frames: StampedFrame[] = [];
  for (const fake of fakes) {
    frames.push({
      evaluate: async (): Promise<unknown> => {
        if (fake.stamps instanceof Error) throw fake.stamps;
        return fake.stamps;
      },
      shown: async (): Promise<unknown> => fake.shown,
      parent: fake.parent === undefined ? undefined : frames[fake.parent]
    });
  }
  return { frames: () => frames };
};

/** A page of one document holding these stamps. */
const pageOf = (stamps: Readonly<Record<string, number>> | Error): StampedPage => framesOf([{ stamps }]);

describe("stampScript", () => {
  it("is valid JavaScript that carries what to watch", () => {
    const script = stampScript({ texts: ["Overlays"], selectors: [".table"] });
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('"Overlays"');
    expect(script).toContain('".table"');
  });

  it("stays out of a frame its parent can read, which the parent watches", () => {
    expect(stampScript({ texts: [], selectors: [] })).toContain(
      "if (window !== window.top && window.frameElement !== null) return;"
    );
  });
});

describe("pageStamps", () => {
  it("reads the page's stamps", async () => {
    expect(await pageStamps(pageOf({ a: 100 }))).toEqual({ a: 100 });
  });

  it("has none while the page is being replaced", async () => {
    expect(await pageStamps(pageOf(new Error("gone")))).toEqual({});
  });

  it("reads a frame on another origin itself, from when the page above showed it", async () => {
    const page = framesOf([
      { stamps: { Overlays: 50 } },
      { stamps: { "Story 0": 100 }, shown: 120, parent: 0 }
    ]);
    expect(await pageStamps(page)).toEqual({ Overlays: 50, "Story 0": 120 });
  });

  it("leaves a frame the page above reads to the page above", async () => {
    const page = framesOf([{ stamps: { "Story 0": 80 } }, { stamps: undefined, parent: 0 }]);
    expect(await pageStamps(page)).toEqual({ "Story 0": 80 });
  });
});

describe("combineStamps", () => {
  const top: FrameReading = { stamps: { Overlays: 10 }, shown: undefined, parent: undefined };

  it("counts nothing from a frame not shown yet", () => {
    expect(combineStamps([top, { stamps: { a: 5 }, shown: undefined, parent: 0 }])).toEqual({ Overlays: 10 });
  });

  it("keeps the earliest of a key drawn in two documents", () => {
    const readings: FrameReading[] = [
      { stamps: { a: 300 }, shown: undefined, parent: undefined },
      { stamps: { a: 100 }, shown: 150, parent: 0 },
      { stamps: { a: 100 }, shown: 400, parent: 0 }
    ];
    expect(combineStamps(readings)).toEqual({ a: 150 });
  });

  it("waits for every frame above that stamps itself, past one its parent reads", () => {
    const readings: FrameReading[] = [
      top,
      { stamps: {}, shown: 100, parent: 0 },
      { stamps: undefined, shown: undefined, parent: 1 },
      { stamps: { a: 50 }, shown: 60, parent: 2 }
    ];
    expect(combineStamps(readings)).toEqual({ Overlays: 10, a: 100 });
  });

  it("counts nothing below a frame above that is not shown", () => {
    const readings: FrameReading[] = [
      top,
      { stamps: {}, shown: undefined, parent: 0 },
      { stamps: { a: 50 }, shown: 60, parent: 1 }
    ];
    expect(combineStamps(readings)).toEqual({ Overlays: 10 });
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
