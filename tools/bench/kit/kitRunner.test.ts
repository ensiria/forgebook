/**
 * Tests for the benchmark run by the kit: a run that goes silent is stopped with its tree and reported, and the kit
 * goes on; a run that ends is timed. They start real Node processes in the benchmark's place, no browser.
 *
 * @module
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogger } from "@ensiria/cli-kit/log";
import { createTestIo } from "@ensiria/cli-kit/testing";
import { describe, expect, it } from "vitest";

import { journaled } from "./kitJournal.ts";
import { type BenchRequest, runBenchmark, type Watching } from "./kitRunner.ts";

/** A fake benchmark: writes a step to its status file, then the given end. */
const fakeBench = (folder: string, ending: string): string => {
  const script = join(folder, "fake-bench.mjs");
  writeFileSync(
    script,
    `import { appendFileSync } from "node:fs";
const status = process.argv[process.argv.indexOf("--status") + 1];
appendFileSync(status, JSON.stringify({ at: Date.now(), tool: "forgebook", metric: "build", run: 1, runs: 1, done: 0, total: 1 }) + "\\n");
console.log("measuring");
${ending}
`
  );
  return script;
};

/** A watch of a few hundred milliseconds instead of minutes. */
const quick = (entry: string): Watching => ({
  entry,
  lookMs: 50,
  heartbeatMs: 100,
  silenceLimits: { starting: 2000, preparing: 2000, sweeping: 2000, measuring: 500 }
});

/** A run's request in a fresh folder. */
const requestIn = (folder: string, entry: string): BenchRequest => ({
  args: [],
  work: folder,
  status: join(folder, "status.jsonl"),
  log: join(folder, "run.log"),
  label: "Prova",
  limitMs: undefined,
  watching: quick(entry)
});

describe("runBenchmark", () => {
  it("stops a run that went silent, says why, and gives the kit back", async () => {
    const folder = mkdtempSync(join(tmpdir(), "bench-kit-"));
    const { io, output } = createTestIo({ cwd: folder });
    const log = journaled(createLogger({ stdout: io.stdout, stderr: io.stderr }), join(folder, "kit.log"));
    const started = Date.now();
    const run = await runBenchmark(
      requestIn(folder, fakeBench(folder, "setInterval(() => {}, 1000);")),
      io,
      log
    );
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(run.exitCode).toBeNull();
    expect(run.stopped).toMatch(/^Prova: fermata, nessun segnale da 1 minuto durante le misure/);
    expect(output()).toContain("Ancora in corso, Prova: misuro forgebook · build");
    expect(readFileSync(join(folder, "kit.log"), "utf8")).toContain("fermata");
  }, 20_000);

  it("times a run that ends, with no word of stopping it", async () => {
    const folder = mkdtempSync(join(tmpdir(), "bench-kit-"));
    const { io } = createTestIo({ cwd: folder });
    const log = createLogger({ stdout: io.stdout, stderr: io.stderr });
    const run = await runBenchmark(requestIn(folder, fakeBench(folder, "process.exitCode = 3;")), io, log);
    expect(run.exitCode).toBe(3);
    expect(run.stopped).toBeUndefined();
    expect(readFileSync(join(folder, "run.log"), "utf8")).toContain("measuring");
  }, 20_000);
});
