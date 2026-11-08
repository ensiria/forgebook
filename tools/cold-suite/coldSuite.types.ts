/**
 * The public types of `cold-suite`: one run of the generated story tests, and the report of all of them.
 *
 * @module
 */

/** What one cold run of the generated suite gave. */
export type ColdRun = {
  /** Wall time from Playwright's start to its exit, the frame page's server included, in seconds. */
  readonly seconds: number;
  /** Playwright's exit code; `null` when a signal ended it. */
  readonly exitCode: number | null;
  /** The tests Playwright ran. */
  readonly tests: number;
  /** The tests that passed. */
  readonly passed: number;
  /** The tests that failed, by their title (`Feedback/Widget5 › Story 2 · dark`). */
  readonly failed: readonly string[];
  /** The tests that failed and passed on a retry (`retries`, 2 in CI), by their title. */
  readonly retried: readonly string[];
  /** One test's time: the median, in milliseconds. */
  readonly medianTestMs: number;
  /** One test's time: the 95th percentile, in milliseconds. */
  readonly p95TestMs: number;
  /** The bytes of the JSON report Playwright wrote. */
  readonly jsonReportBytes: number;
  /** The bytes of what the `list` reporter printed, the one the suite's configuration names. */
  readonly listOutputBytes: number;
  /** The bytes Playwright left in `test-results` (attachments of failures, traces). */
  readonly resultsBytes: number;
};

/** The machine a report was measured on. */
export type ColdMachine = {
  /** `process.platform`. */
  readonly platform: string;
  /** Its CPU's model, as the system names it. */
  readonly cpu: string;
  /** Its logical CPUs. */
  readonly cpus: number;
  /** Its memory, in GiB. */
  readonly memoryGiB: number;
  /** The one-minute load average before the first run; 0 on Windows, which has none. */
  readonly loadBefore: number;
};

/** The report of `cold-suite --json`. */
export type ColdSuiteReport = {
  /** The shape's version. */
  readonly schema: 1;
  /** The commit measured, `-dirty` when the checkout had changes. */
  readonly forgebook: string;
  /** The generated library's size. */
  readonly library: { readonly components: number; readonly stories: number };
  /** Playwright's workers; none when its configuration chose them (one per CPU). */
  readonly workers?: number;
  /** Where it ran. */
  readonly machine: ColdMachine;
  /** Each cold run, in order. */
  readonly runs: readonly ColdRun[];
  /** The tests that passed only on a retry, or failed in a run and passed when run again alone: flaky. */
  readonly flaky: readonly string[];
  /** The tests that failed again when run alone. */
  readonly broken: readonly string[];
};
