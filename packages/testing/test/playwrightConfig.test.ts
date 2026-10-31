/**
 * Tests for the story tests' Playwright configuration: the command that starts the frame page, from the package
 * manager that runs the tests or from the package's own choice.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { frameServerCommand, storyTestConfig } from "../src/playwrightConfig.ts";

describe("frameServerCommand", () => {
  it("runs Vite through the package manager that runs the tests", () => {
    expect(frameServerCommand("pnpm/10.19.0 npm/? node/v24.15.0 darwin arm64")).toBe("pnpm exec vite");
    expect(frameServerCommand("yarn/4.18.1 npm/? node/v24.15.0 darwin arm64")).toBe("yarn vite");
    expect(frameServerCommand("bun/1.3.14 npm/? node/v24.15.0 darwin arm64")).toBe("bunx vite");
    expect(frameServerCommand("npm/11.9.0 node/v24.14.0 darwin arm64 workspaces/false")).toBe("npx vite");
  });

  it("falls back to npx when no package manager says which it is", () => {
    expect(frameServerCommand(undefined)).toBe("npx vite");
  });
});

describe("storyTestConfig", () => {
  it("starts the frame page with the package's own command when it gives one", () => {
    const config = storyTestConfig({
      dir: "/stories",
      port: 4100,
      browserPort: 4101,
      vite: "node ./vite.mjs"
    });
    const server = config.webServer;
    expect(server && !Array.isArray(server) ? server.command : undefined).toBe(
      "node ./vite.mjs --config /stories/vite.config.ts --host 127.0.0.1 --port 4100 --strictPort"
    );
  });
});
