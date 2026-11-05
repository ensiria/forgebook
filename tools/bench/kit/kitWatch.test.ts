/**
 * Tests for how the kit watches a benchmark: the status lines read, the phase they put a run in, the silence each
 * phase is allowed, and what the person is told.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  describeStatus,
  heartbeatLine,
  lastStatus,
  observe,
  parseStatusLine,
  partLimit,
  phaseOf,
  SILENCE_LIMITS,
  startWatch,
  stoppedLine,
  verdict
} from "./kitWatch.ts";

/** A minute, in milliseconds. */
const MINUTE = 60_000;

/** A sample's line, as the benchmark writes it. */
const STEP = JSON.stringify({
  at: 1,
  tool: "forgebook",
  metric: "hmrStory",
  run: 1,
  runs: 1,
  done: 111,
  total: 340
});

/** An install's line. */
const INSTALL = JSON.stringify({ at: 2, state: "working", activity: "install", tool: "storybook" });

/** The sweep's line. */
const SWEEP = JSON.stringify({
  at: 3,
  state: "working",
  activity: "sweep",
  tool: "forgebook",
  done: 250,
  total: 1500
});

describe("parseStatusLine", () => {
  it("reads a sample, a long step and the end", () => {
    expect(parseStatusLine(STEP)).toEqual({
      kind: "step",
      tool: "forgebook",
      metric: "hmrStory",
      done: 111,
      total: 340
    });
    expect(parseStatusLine(INSTALL)).toEqual({
      kind: "activity",
      activity: "install",
      tool: "storybook",
      done: undefined,
      total: undefined
    });
    expect(parseStatusLine('{"at":4,"state":"finished","warnings":0}')).toEqual({ kind: "end" });
  });

  it("takes a half-written line or another program's for nothing, never for an error", () => {
    expect(parseStatusLine('{"at":4,"tool":"forg')).toBeUndefined();
    expect(parseStatusLine("[]")).toBeUndefined();
    expect(lastStatus(`${STEP}\n${INSTALL}\n{"at":5,"to`)).toEqual(parseStatusLine(INSTALL));
    expect(lastStatus("")).toBeUndefined();
  });
});

describe("phaseOf", () => {
  it("puts a run in the phase its last line says", () => {
    expect(phaseOf(undefined)).toBe("starting");
    expect(phaseOf(parseStatusLine(INSTALL))).toBe("preparing");
    expect(phaseOf(parseStatusLine(SWEEP))).toBe("sweeping");
    expect(phaseOf(parseStatusLine(STEP))).toBe("measuring");
  });
});

describe("verdict", () => {
  const started = startWatch(0);

  it("lets a run be silent as long as its phase allows, and no longer", () => {
    const installing = observe(started, 0, "10:20", parseStatusLine(INSTALL));
    expect(verdict(installing, 90 * MINUTE, undefined).kind).toBe("running");
    expect(verdict(installing, SILENCE_LIMITS.preparing + 1, undefined)).toEqual({
      kind: "silent",
      phase: "preparing",
      silentMs: SILENCE_LIMITS.preparing + 1
    });
    const measuring = observe(started, 0, "10:30", parseStatusLine(STEP));
    expect(verdict(measuring, 31 * MINUTE, undefined)).toMatchObject({ kind: "silent", phase: "measuring" });
  });

  it("counts any growth of the files as a sign of life, and the same sizes as none", () => {
    const first = observe(started, 0, "10:30", parseStatusLine(STEP));
    const grown = observe(first, 25 * MINUTE, "11:30", parseStatusLine(STEP));
    expect(verdict(grown, 50 * MINUTE, undefined).kind).toBe("running");
    const same = observe(first, 25 * MINUTE, "10:30", parseStatusLine(STEP));
    expect(same.lastSignAt).toBe(0);
  });

  it("stops a part past its own limit, however busy it looks", () => {
    const busy = observe(started, 7 * 60 * MINUTE, "99:99", parseStatusLine(STEP));
    expect(verdict(busy, 7 * 60 * MINUTE, partLimit(2 * 60 * MINUTE))).toEqual({
      kind: "overtime",
      elapsedMs: 7 * 60 * MINUTE,
      limitMs: 6 * 60 * MINUTE
    });
  });
});

describe("partLimit", () => {
  it("allows three times the estimate, two hours at least, and none without an estimate", () => {
    expect(partLimit(undefined)).toBeUndefined();
    expect(partLimit(10 * MINUTE)).toBe(120 * MINUTE);
    expect(partLimit(100 * MINUTE)).toBe(300 * MINUTE);
  });
});

describe("what the person is told", () => {
  it("says where a run is every minute, and how long it has been silent once that is long", () => {
    const watch = observe(startWatch(0), 0, "1:1", parseStatusLine(STEP));
    expect(heartbeatLine("Primer (GitHub)", watch, 37 * MINUTE)).toBe(
      "Ancora in corso, Primer (GitHub): misuro forgebook · hmrStory, passo 112 di 340 (32%); da 37 minuti, " +
        "nessun segnale da 37 minuti."
    );
    expect(describeStatus(parseStatusLine(SWEEP))).toBe("apro ogni storia (forgebook): 250 di 1500");
  });

  it("says why a run was stopped", () => {
    const status = parseStatusLine(INSTALL);
    expect(
      stoppedLine("Carbon (IBM)", { kind: "silent", phase: "preparing", silentMs: 100 * MINUTE }, status)
    ).toBe(
      "Carbon (IBM): fermata, nessun segnale da 1 ora e 40 minuti durante la preparazione " +
        "(ultimo passo: installo le dipendenze (storybook))."
    );
  });
});
