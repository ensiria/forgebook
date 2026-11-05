/**
 * The status file another program follows.
 *
 * @module
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { statusWriter } from "./statusFile.ts";

describe("statusWriter", () => {
  it("appends one JSON line per step, so a reader can follow the file with tail", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bench-status-")), "status.jsonl");
    const write = statusWriter(file, (): number => 1000);
    write({ tool: "forgebook", metric: "coldStart", run: 1, runs: 5, done: 0, total: 40 });
    write({ tool: "forgebook", metric: "coldStart", run: 2, runs: 5, done: 1, total: 40 });
    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1] ?? "")).toEqual({
      at: 1000,
      tool: "forgebook",
      metric: "coldStart",
      run: 2,
      runs: 5,
      done: 1,
      total: 40
    });
  });

  it("ends with a line that says the run is over, so a reader does not wait for a next step", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bench-status-")), "status.jsonl");
    statusWriter(file, (): number => 2000)({ state: "finished", warnings: 1 });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ at: 2000, state: "finished", warnings: 1 });
  });

  it("says what a run is busy with between measurements", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bench-status-")), "status.jsonl");
    statusWriter(file, (): number => 3000)({ state: "working", activity: "sweep", count: 25, of: 100 });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      at: 3000,
      state: "working",
      activity: "sweep",
      count: 25,
      of: 100
    });
  });

  it("writes nothing without a file", () => {
    expect(() =>
      statusWriter(
        undefined,
        (): number => 0
      )({ tool: "forgebook", metric: "build", run: 1, runs: 1, done: 0, total: 1 })
    ).not.toThrow();
  });
});
