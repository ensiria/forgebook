/**
 * axe over the catalogue's own shell: the page around the stories, never the stories in their frames, and what a run
 * finds compared with the exceptions the suite names.
 *
 * @remarks
 * The core keeps axe to check stories (`src/frame/checkStory.ts`); here it checks the tool itself. The scan stays out of
 * the frames (`iframes: false`): a story's own failure is the library's to fix and shows in the panel's Accessibility
 * tab, while the `iframe` element around it is the shell's and is still scanned. Every rule axe runs by default stays
 * on: a finding that cannot be fixed yet is named in the spec with its reason, and an exception that stopped matching
 * fails too, so the list never outlives what it excuses.
 *
 * @module
 */
import { createRequire } from "node:module";

import type { Page } from "@playwright/test";
import type axe from "axe-core";

declare global {
  interface Window {
    /** axe's script, added to the page by `scanShell`. */
    axe: typeof axe;
  }
}

/** The file of axe's script. */
const AXE_SCRIPT: string = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** One element a rule failed on. */
export type AxeFinding = {
  /** The rule's id (`color-contrast`). */
  readonly rule: string;
  /** The element's selector, as axe writes it. */
  readonly target: string;
  /** What axe says is wrong, on one line. */
  readonly summary: string;
};

/** A finding too big for now, named with its reason: the only way a finding passes. */
export type AxeException = {
  /** The rule's id. */
  readonly rule: string;
  /** Text of the failing element's selector. */
  readonly target: string;
  /** The names of the states it shows in. */
  readonly states: readonly string[];
  /** Why it stays, and what fixing it takes. */
  readonly reason: string;
};

/** Waits until what is moving has arrived: a colour halfway through its fade is not the colour to check. */
export const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((each) => each.effect?.getTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map((each) => each.finished));
  });

/**
 * Scans the shell as it stands.
 *
 * @param page - the page, in the state to check.
 * @returns every element a rule failed on.
 */
export const scanShell = async (page: Page): Promise<readonly AxeFinding[]> => {
  await page.addScriptTag({ path: AXE_SCRIPT });
  await animationsDone(page);
  return page.evaluate(async () => {
    const results = await window.axe.run(document, { iframes: false, resultTypes: ["violations"] });
    return results.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        rule: violation.id,
        target: node.target.join(" "),
        summary: (node.failureSummary ?? violation.help).replace(/\s+/g, " ").trim()
      }))
    );
  });
};

/**
 * What a state's findings leave once its exceptions are taken out.
 *
 * @param state - the state's name.
 * @param findings - what the scan found.
 * @param exceptions - the suite's named exceptions.
 * @returns the findings no exception names, and the exceptions of this state that nothing matched.
 */
export const unexcused = (
  state: string,
  findings: readonly AxeFinding[],
  exceptions: readonly AxeException[]
): { readonly findings: readonly AxeFinding[]; readonly stale: readonly AxeException[] } => {
  const own = exceptions.filter((exception) => exception.states.includes(state));
  const excuses = (exception: AxeException, finding: AxeFinding): boolean =>
    exception.rule === finding.rule && finding.target.includes(exception.target);
  return {
    findings: findings.filter((finding) => !own.some((exception) => excuses(exception, finding))),
    stale: own.filter((exception) => !findings.some((finding) => excuses(exception, finding)))
  };
};
