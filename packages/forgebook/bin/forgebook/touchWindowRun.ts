/**
 * What `forgebook dev --touch` runs once the dev server listens: the testing package's touch window (Chromium with its
 * own touch emulation), loaded from the project, opened on the catalogue's address without holding the server up.
 *
 * @module
 */
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { TouchWindowRequest } from "../../src/realTouch.ts";
import { testingFunction } from "./storyCheckRun.ts";

/**
 * Opens the touch window on the catalogue; the dev server keeps running when the window closes.
 *
 * @param dir - the catalogue's folder, where the testing package is resolved.
 * @param url - the dev server's address; none when it gave none.
 * @param log - the command's logger.
 * @throws when the testing package or the address is missing.
 */
export const openTouchWindow = async (dir: string, url: string | undefined, log: Logger): Promise<void> => {
  if (url === undefined) throw new ScriptError("The dev server gave no address to open the touch window on");
  const open = await testingFunction(dir, "@forgebook/testing/touch", "openTouchWindow");
  if (typeof open === "string") throw new ScriptError(open);
  const request: TouchWindowRequest = { url };
  log.info("Touch window open: the mouse makes real touch events there (Chromium's emulation)");
  // a window that cannot open (no Chromium installed) is said, and the dev server keeps running
  open(request).then(
    (): void => log.info("Touch window closed; the dev server keeps running"),
    (error: unknown): void =>
      log.error(`The touch window could not open: ${error instanceof Error ? error.message : String(error)}`)
  );
};
