/**
 * The kit's journal: everything it tells the person, also appended to `logs/kit.log` in its folder as it is said.
 *
 * @remarks
 * The console is not a record: a window closed, or a console that stopped taking output, loses it. Each line is
 * appended to the file before it is printed, with the time, so the results file holds what the person saw even when
 * the run ended badly.
 *
 * @module
 */
import { appendFileSync } from "node:fs";

import type { Logger } from "@ensiria/cli-kit/log.types";

/** The kinds of message a logger prints that go in the journal. */
const KINDS = ["info", "success", "warn", "error", "step", "hint", "plain"] as const;

/**
 * A logger that also appends every message to a file, first.
 *
 * @param log - the logger.
 * @param file - the journal's file.
 * @param now - the clock.
 */
export const journaled = (log: Logger, file: string, now: () => Date = () => new Date()): Logger => {
  const write = (kind: string, message: string): void => {
    try {
      appendFileSync(file, `${now().toISOString()} ${kind} ${message}\n`);
    } catch {
      // a journal that cannot be written must not stop the run it records
    }
  };
  const wrapped: Logger = { ...log };
  for (const kind of KINDS) {
    wrapped[kind] = (message: string): void => {
      write(kind, message);
      log[kind](message);
    };
  }
  return wrapped;
};
