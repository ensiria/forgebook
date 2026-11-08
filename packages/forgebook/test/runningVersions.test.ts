/**
 * What a catalogue says of the versions it finds itself running with.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { assertViteEight } from "../src/vite/runningVersions.ts";

describe("on a Vite older than 8", () => {
  it("stops at once, naming the command that brings its own", () => {
    expect(() => assertViteEight({ outDir: "dist" })).toThrow("forgebook command");
    expect(() => assertViteEight({ rolldownOptions: {} })).not.toThrow();
    expect(() => assertViteEight(undefined)).not.toThrow();
  });
});
