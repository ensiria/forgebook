/**
 * Tests for the Replay control's wait: endless animations are not awaited, so a story with a shimmer replays.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { endingAnimations, type SettlingAnimation } from "../src/frame/settle.ts";

/** An animation with the given number of iterations. */
const animation = (iterations: number, name: string): SettlingAnimation & { readonly name: string } => ({
  name,
  effect: { getTiming: (): EffectTiming => ({ iterations }) } as AnimationEffect,
  finished: Promise.resolve({} as Animation)
});

describe("endingAnimations", () => {
  it("keeps the animations that end and leaves out the endless ones", () => {
    const kept = endingAnimations([
      animation(1, "fade"),
      animation(Infinity, "shimmer"),
      animation(3, "pulse")
    ]);
    expect(kept.map((item) => item.name)).toEqual(["fade", "pulse"]);
  });
});
