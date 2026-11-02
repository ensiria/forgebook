/**
 * The bench kit's logic: its profiles, its estimate, its state, its results kept free of the person's identity, and
 * the zip they go in.
 *
 * @module
 */
import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { estimate, formatDuration, phaseTiming, profileItems, type Reference } from "./kitPlan.ts";
import { anonymize, HOST_PLACEHOLDER, leaks, USER_PLACEHOLDER } from "./kitResults.ts";
import { failedMetrics } from "./kitRunner.ts";
import { parseState } from "./kitState.ts";
import { zipArchive } from "./zipArchive.ts";

describe("profileItems", () => {
  it("runs the generated library alone in the quick profile", () => {
    expect(profileItems("quick", "win32").map(({ id }) => id)).toEqual(["generated"]);
  });

  it("adds the real libraries in the full one, without Spectrum on Windows", () => {
    expect(profileItems("full", "win32").map(({ id }) => id)).toEqual([
      "generated",
      "primer",
      "carbon",
      "fluentui"
    ]);
    expect(profileItems("full", "linux").map(({ id }) => id)).toContain("spectrum");
  });
});

describe("phaseTiming", () => {
  it("splits a run at its first measurement", () => {
    const status = [
      JSON.stringify({
        at: 1500,
        tool: "forgebook",
        metric: "coldStart",
        run: 1,
        runs: 1,
        done: 0,
        total: 2
      }),
      JSON.stringify({ at: 1900, tool: "forgebook", metric: "build", run: 1, runs: 1, done: 1, total: 2 }),
      JSON.stringify({ at: 2400, state: "finished", warnings: 0 }),
      ""
    ].join("\n");
    expect(phaseTiming(1000, 2500, status)).toEqual({ prepareMs: 500, measureMs: 1000 });
  });

  it("counts a run that never measured as preparation", () => {
    expect(phaseTiming(1000, 4000, "")).toEqual({ prepareMs: 3000, measureMs: 0 });
  });
});

describe("estimate", () => {
  const reference: Reference = {
    machine: "reference",
    calibration: { prepareMs: 60_000, measureMs: 20_000 },
    items: { generated: { prepareMs: 120_000, measureMs: 600_000 } }
  };

  it("scales each phase by its own ratio, within a range", () => {
    const result = estimate(
      reference,
      { prepareMs: 120_000, measureMs: 60_000 },
      profileItems("quick", "linux")
    );
    expect(result.totalMs).toBe(240_000 + 1_800_000);
    expect(result.lowMs).toBeLessThan(result.totalMs);
    expect(result.highMs).toBeGreaterThan(result.totalMs);
  });

  it("says which parts the reference never ran instead of counting them as nothing", () => {
    const result = estimate(reference, reference.calibration, profileItems("full", "win32"));
    expect(result.items.filter(({ ms }) => ms === undefined).map(({ id }) => id)).toEqual([
      "primer",
      "carbon",
      "fluentui"
    ]);
  });
});

describe("failedMetrics", () => {
  it("names the metrics a report records as failed, for every tool", () => {
    const report = {
      version: 1,
      tools: {
        forgebook: {
          versions: {},
          metrics: {
            start: { kind: "failed", reason: "never drawn" },
            build: { kind: "measured", unit: "ms", summary: { median: 1, min: 1, max: 1, samples: 1 } }
          }
        },
        ladle: { versions: {}, metrics: { componentPage: { kind: "absent", reason: "no such page" } } }
      }
    };
    expect(failedMetrics(JSON.stringify(report))).toEqual(["start"]);
  });
});

describe("formatDuration", () => {
  it("speaks in minutes, then hours and minutes", () => {
    expect(formatDuration(20_000)).toBe("1 minuto");
    expect(formatDuration(25 * 60_000)).toBe("25 minuti");
    expect(formatDuration(60 * 60_000)).toBe("1 ora");
    expect(formatDuration(135 * 60_000)).toBe("2 ore e 15 minuti");
  });
});

describe("parseState", () => {
  it("reads a state the kit wrote", () => {
    const state = {
      commit: "abc",
      machine: "win32-x64|cpu|8|1",
      calibration: { prepareMs: 1, measureMs: 2 },
      profile: "quick",
      items: { generated: { outcome: "problems", exitCode: 1, timing: { prepareMs: 3, measureMs: 4 } } }
    };
    expect(parseState(JSON.stringify(state))).toEqual(state);
  });

  it("drops what does not match, and refuses what is not a state", () => {
    const state = {
      commit: "abc",
      machine: "m",
      profile: "huge",
      items: { generated: { outcome: "maybe" } }
    };
    expect(parseState(JSON.stringify(state))).toEqual({ commit: "abc", machine: "m", items: {} });
    expect(parseState("not json")).toBeUndefined();
    expect(parseState("[]")).toBeUndefined();
  });
});

describe("anonymize", () => {
  const identity = { home: "C:\\Users\\Mario Rossi", user: "mrossi", host: "MINI-PC" };

  it("takes the home folder out in every spelling a path takes", () => {
    const text = [
      "C:\\Users\\Mario Rossi\\AppData\\Local\\ForgebookBench",
      "C:/Users/Mario Rossi/AppData",
      '{"path":"C:\\\\Users\\\\Mario Rossi\\\\x"}',
      "c:\\users\\mario rossi\\y"
    ].join("\n");
    const cleaned = anonymize(text, identity);
    expect(cleaned).toBe(
      ["~\\AppData\\Local\\ForgebookBench", "~/AppData", '{"path":"~\\\\x"}', "~\\y"].join("\n")
    );
    expect(leaks(cleaned, identity)).toEqual([]);
  });

  it("replaces the user's and the computer's names as words, not inside other words", () => {
    const cleaned = anonymize("mrossi on mini-pc ran mrossiano", identity);
    expect(cleaned).toBe(`${USER_PLACEHOLDER} on ${HOST_PLACEHOLDER} ran mrossiano`);
  });

  it("finds what is left", () => {
    expect(leaks("MINI-PC said C:/Users/Mario Rossi", identity)).toEqual(["home", "computer"]);
  });
});

/** The files of a zip, read back through its central directory. */
const unzip = (archive: Buffer): Record<string, string> => {
  const end = archive.length - 22;
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let index = 0; index < count; index += 1) {
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const name = archive.toString("utf8", at + 46, at + 46 + nameLength);
    const localNameLength = archive.readUInt16LE(offset + 26);
    const start = offset + 30 + localNameLength;
    files[name] = inflateRawSync(archive.subarray(start, start + size)).toString("utf8");
    at += 46 + nameLength;
  }
  return files;
};

describe("zipArchive", () => {
  it("writes files a reader finds again, names in UTF-8 included", () => {
    const archive = zipArchive(
      [
        { name: "LEGGIMI.txt", data: Buffer.from("perché") },
        { name: "reports/report.json", data: Buffer.from("{}\n".repeat(1000)) }
      ],
      new Date(2026, 10, 2, 12, 30)
    );
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(unzip(archive)).toEqual({ "LEGGIMI.txt": "perché", "reports/report.json": "{}\n".repeat(1000) });
  });
});
