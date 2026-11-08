/**
 * Tests for the ports a dev server's frames try: the configured one alone, the catalogue's + 1 and on, or any free port
 * when the catalogue took any free port, so two command servers started together never take each other's port.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { framesPortTries } from "../src/vite/framesServer.ts";

describe("framesPortTries", () => {
  it("tries the port the configuration gives, and only that one", () => {
    expect(framesPortTries(7000, 6006, false)).toEqual([7000]);
    expect(framesPortTries(7000, 51234, true)).toEqual([7000]);
  });

  it("tries the catalogue's port + 1 and the ones after it, then any free port", () => {
    const tries = framesPortTries(undefined, 6006, false);
    expect(tries.slice(0, 3)).toEqual([6007, 6008, 6009]);
    expect(tries.at(-1)).toBe(0);
  });

  it("takes any free port when the catalogue took any free port", () => {
    expect(framesPortTries(undefined, 51234, true)).toEqual([0]);
  });
});
