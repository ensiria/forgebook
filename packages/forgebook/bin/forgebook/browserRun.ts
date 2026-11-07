/**
 * What `forgebook browser` runs: installs the browser the stories' checks run on, with the Playwright that will open it.
 *
 * @remarks
 * Each Playwright version wants its own browser build, and a project may have another Playwright of its own at the top of
 * its `node_modules`, so `playwright install` from the project can fetch a browser the checks never find. The one that
 * counts is the one `@forgebook/testing` loads, found from that package.
 *
 * Playwright's install also deletes every build in the shared browser folder that no project it still knows of uses, so
 * a plain `playwright install` here can remove the browsers of other projects on the machine. `--no-remove` keeps the
 * install to adding the one build the checks need: Forgebook never deletes what it did not install.
 *
 * @module
 */
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { ScriptError } from "@ensiria/cli-kit/script";

/** A package's folder as Node finds it going up from a folder, links followed; none when it is not there. */
const nearestPackage = (dir: string, name: string): string | undefined => {
  const folder = join(dir, "node_modules", name);
  if (existsSync(join(folder, "package.json"))) return realpathSync(folder);
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestPackage(parent, name);
};

/**
 * The file of Playwright's command, as `@forgebook/testing` in a folder finds it.
 *
 * @remarks
 * Looked for by folder: neither package need export its `package.json`, and a strict install keeps Playwright beside the
 * testing package, out of the project's reach.
 *
 * @param dir - the project's folder.
 * @returns its path; none when either package is not there.
 */
export const playwrightCommandFile = (dir: string): string | undefined => {
  const testing = nearestPackage(dir, "@forgebook/testing");
  const playwright = testing === undefined ? undefined : nearestPackage(testing, "@playwright/test");
  return playwright === undefined ? undefined : join(playwright, "cli.js");
};

/**
 * Installs the browser.
 *
 * @param dir - the project's folder.
 * @param shouldInstallSystemPackages - whether to install what the browser needs of the system (`--with-deps`), as CI does.
 * @param io - the run's streams.
 * @throws a `ScriptError` when the testing package is not there, or the install fails.
 */
export const installBrowser = async (
  dir: string,
  shouldInstallSystemPackages: boolean,
  io: ScriptIo
): Promise<void> => {
  const command = playwrightCommandFile(dir);
  if (command === undefined)
    throw new ScriptError("@forgebook/testing and @playwright/test are not installed here", {
      hint: "npm install -D @forgebook/testing @playwright/test, or forgebook init --browser"
    });
  await exec(
    process.execPath,
    [command, "install", "--no-remove", "chromium", ...(shouldInstallSystemPackages ? ["--with-deps"] : [])],
    { cwd: dir, output: "prefix", prefix: "playwright", io }
  );
};
