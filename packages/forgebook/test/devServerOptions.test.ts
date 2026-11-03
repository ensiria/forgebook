/**
 * Tests for the dev server's options the command line sets: `--port`, `--host` and `--poll`.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { devServerOptions } from "../bin/forgebook/catalogueVite.ts";

describe("devServerOptions", () => {
  it("leaves Vite's defaults when nothing is asked", () => {
    expect(devServerOptions({ port: undefined, host: undefined, isPolling: false })).toEqual({});
  });

  it("listens on the port asked, and only there", () => {
    expect(devServerOptions({ port: 6006, host: undefined, isPolling: false })).toEqual({
      port: 6006,
      strictPort: true
    });
  });

  it("listens on the address asked", () => {
    expect(devServerOptions({ port: undefined, host: "127.0.0.1", isPolling: false })).toEqual({
      host: "127.0.0.1"
    });
  });

  it("notices file edits by polling when asked", () => {
    expect(devServerOptions({ port: undefined, host: undefined, isPolling: true })).toEqual({
      watch: { usePolling: true }
    });
  });
});
