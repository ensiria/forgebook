/**
 * What `forgebook browser` and `forgebook init --browser` leave in the shared browser folder: the real Playwright install
 * runs on a scratch folder that already holds the builds it wants, so nothing is downloaded, beside older builds that
 * belong to other projects.
 *
 * @module
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { exec } from "@ensiria/cli-kit/exec";
import { createTestIo } from "@ensiria/cli-kit/testing";
import { afterEach, describe, expect, it } from "vitest";

import { installBrowser, playwrightCommandFile } from "../bin/forgebook/browserRun.ts";

/** The repo's testing package, the one a project installs. */
const TESTING_PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "testing");

/** Builds that other projects installed with older Playwright versions. */
const OTHER_BUILDS = ["chromium-1217", "chromium-1223", "chromium_headless_shell-1217"];

const scratch: string[] = [];

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A folder holding a finished build: Playwright skips the download of a build whose marker file is there. */
const writeBuild = (browsers: string, name: string): void => {
  mkdirSync(join(browsers, name), { recursive: true });
  writeFileSync(join(browsers, name, "INSTALLATION_COMPLETE"), "");
};

/** The build folders Playwright's install wants on this machine, read from the Playwright the project loads. */
const wantedBuilds = async (project: string): Promise<string[]> => {
  const command = playwrightCommandFile(project);
  if (command === undefined) throw new Error("the testing package has no Playwright beside it");
  const listing = createTestIo({ env: { PLAYWRIGHT_BROWSERS_PATH: join(project, "none") } });
  await exec(process.execPath, [command, "install", "--dry-run", "chromium"], {
    cwd: project,
    output: "prefix",
    prefix: "playwright",
    io: listing.io
  });
  return [...listing.output().matchAll(/Install location:\s+(\S+)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1].split(/[\\/]/).at(-1) ?? ""]
  );
};

describe("installBrowser", () => {
  it("keeps the builds other projects installed in the shared folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "forgebook-browser-"));
    scratch.push(root);
    const project = join(root, "project");
    const browsers = join(root, "browsers");
    mkdirSync(join(project, "node_modules", "@forgebook"), { recursive: true });
    symlinkSync(TESTING_PACKAGE, join(project, "node_modules", "@forgebook", "testing"), "junction");
    const wanted = await wantedBuilds(project);
    expect(wanted.length).toBeGreaterThan(0);
    for (const name of [...OTHER_BUILDS, ...wanted]) writeBuild(browsers, name);

    const run = createTestIo({ env: { PLAYWRIGHT_BROWSERS_PATH: browsers } });
    await installBrowser(project, false, run.io);

    expect(run.output()).not.toContain("Removing unused browser");
    for (const name of OTHER_BUILDS) expect(existsSync(join(browsers, name))).toBe(true);
    expect(
      readdirSync(browsers)
        .filter((name) => !name.startsWith("."))
        .sort()
    ).toEqual([...OTHER_BUILDS, ...wanted].sort());
  }, 60_000);
});
