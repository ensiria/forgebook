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

  it("keeps a variable whatever the case Windows names it in, and the kit's caches", () => {
    const env = toolEnvironment({
      Path: "C:\\bin",
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      npm_config_cache: "C:\\kit\\npm",
      npm_config_authtoken: "secret"
    });
    expect(env["Path"]).toBe("C:\\bin");
    expect(env["COREPACK_ENABLE_DOWNLOAD_PROMPT"]).toBe("0");
    expect(env["npm_config_cache"]).toBe("C:\\kit\\npm");
    expect(Object.values(env)).not.toContain("secret");
  });
});
