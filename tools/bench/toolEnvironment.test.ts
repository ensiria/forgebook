/**
 * Tests for the environment the tools' and the libraries' commands get.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { toolEnvironment } from "./toolEnvironment.ts";

describe("toolEnvironment", () => {
  it("keeps what a program needs and leaves out tokens and keys", () => {
    const env = toolEnvironment({
      PATH: "/bin",
      HOME: "/home/a",
      GITHUB_TOKEN: "secret",
      NPM_TOKEN: "secret",
      AWS_SECRET_ACCESS_KEY: "secret",
      UNSET: undefined
    });
    expect(env["PATH"]).toBe("/bin");
    expect(env["HOME"]).toBe("/home/a");
    expect(Object.values(env)).not.toContain("secret");
    expect("UNSET" in env).toBe(false);
  });

  it("turns the tools' daemons off, and lets a command's own variables win", () => {
    const env = toolEnvironment({ PATH: "/bin" }, { NX_DAEMON: "true", BROWSER: "none" });
    expect(env["TURBO_DAEMON"]).toBe("false");
    expect(env["NX_DAEMON"]).toBe("true");
    expect(env["BROWSER"]).toBe("none");
  });
});
