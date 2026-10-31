/**
 * Tests for `forgebook dev --touch`'s window, before any browser: refused without the dev server's address, and with
 * the install named when the project lacks `@forgebook/testing`.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createLogger } from "@ensiria/cli-kit/log";
import { afterAll, describe, expect, it } from "vitest";

import { openTouchWindow } from "../bin/forgebook/touchWindowRun.ts";

const project = mkdtempSync(join(tmpdir(), "forgebook-touch-"));
writeFileSync(join(project, "package.json"), '{ "name": "no-testing" }\n');

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

/** A logger that keeps nothing. */
const quiet = createLogger({
  stdout: { write: (): boolean => true },
  stderr: { write: (): boolean => true }
});

describe("openTouchWindow", () => {
  it("needs the dev server's address", async () => {
    await expect(openTouchWindow(project, undefined, quiet)).rejects.toThrow("gave no address");
  });

  it("names the install when the project has no @forgebook/testing", () => {
    // in a Node process of its own, without the NODE_PATH pnpm's runner sets: through it the workspace's packages
    // resolve from any folder, and the window would open
    const module = pathToFileURL(
      join(import.meta.dirname, "..", "bin", "forgebook", "touchWindowRun.ts")
    ).href;
    const code = [
      `import { createLogger } from "@ensiria/cli-kit/log";`,
      `import { openTouchWindow } from ${JSON.stringify(module)};`,
      "const quiet = createLogger({ stdout: { write: () => true }, stderr: { write: () => true } });",
      `openTouchWindow(${JSON.stringify(project)}, "http://localhost:5173/", quiet)`,
      "  .then(() => process.stdout.write('opened'), (error) => process.stdout.write(error.message));"
    ].join("\n");
    // biome-ignore lint/style/noProcessEnv: the child takes this process's environment, less the NODE_PATH pnpm's runner sets
    const { NODE_PATH: _nodePath, ...env } = process.env;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: join(import.meta.dirname, ".."),
      env,
      encoding: "utf8"
    });
    expect(run.stdout).toContain("npm install -D @forgebook/testing");
  });
});
