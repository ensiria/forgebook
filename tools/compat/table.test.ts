/**
 * The page: drawn from the results only, untested tools said so, the changes a pull request lists; and the
 * repository's page kept equal to what its report draws, so nobody edits a claim into it by hand.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { CellResult, CompatMatrix, CompatReport } from "./compat.types.ts";
import { parseReport } from "./documents.ts";
import { COMPAT_MATRIX } from "./matrix.ts";
import { changedCells, NO_RESULT, renderTable, withMissingCells } from "./table.ts";

const MATRIX: CompatMatrix = {
  hosts: { react: { label: "React", packages: ["react"] }, vite: { label: "Vite", packages: ["vite"] } },
  adapters: [
    {
      name: "@x/react",
      folder: "packages/react",
      fixture: "fixtures/app",
      hosts: [{ host: "react" }, { host: "vite" }]
    }
  ]
};

/** A cell with only what a test sets. */
const cell = (fields: Partial<CellResult>): CellResult => ({
  id: "x",
  adapter: "@x/react",
  host: "react",
  range: "^18.2.0 || ^19.0.0",
  line: "19",
  version: "19.3.1",
  packages: { react: "19.3.1" },
  status: "passed",
  installed: {},
  commands: [],
  node: "24.11.0",
  ...fields
});

describe("renderTable", () => {
  it("claims nothing before any run", () => {
    const page = renderTable(MATRIX, { date: "", cells: [] });
    expect(page).toContain("No run has written results yet");
    expect(page).toContain("Not tested yet: React, Vite.");
    expect(page).not.toContain("| React |");
  });

  it("lists each tested version with its result, released lines before the prerelease", () => {
    const report: CompatReport = {
      date: "2026-11-09",
      runUrl: "https://github.com/o/r/actions/runs/1",
      cells: [
        cell({
          line: "next",
          version: "19.3.0-canary-a",
          tag: "canary",
          status: "failed",
          reason: "failed: pnpm test"
        }),
        cell({
          line: "18",
          version: "18.3.1",
          commands: [{ command: "pnpm --filter @x/react test", code: 0 }]
        }),
        cell({ line: "19" })
      ]
    };
    const page = renderTable(MATRIX, report);
    const rows = page.split("\n").filter((line) => line.startsWith("| React"));
    expect(rows).toEqual([
      "| React | `^18.2.0 \\|\\| ^19.0.0` | 18 | `18.3.1` | ✓ passes |",
      "| React | `^18.2.0 \\|\\| ^19.0.0` | 19 | `19.3.1` | ✓ passes |",
      "| React | `^18.2.0 \\|\\| ^19.0.0` | next (canary) | `19.3.0-canary-a` | ✗ fails (failed: pnpm test) |"
    ]);
    expect(page).toContain("Not tested yet: Vite.");
    expect(page).toContain("Each cell runs `pnpm --filter @x/react test`.");
    expect(page).toContain(
      "Results of 2026-11-09, on Node 24.11.0, [the run](https://github.com/o/r/actions/runs/1)."
    );
  });
});

describe("withMissingCells", () => {
  it("counts a planned cell that left no result as not run", () => {
    const {
      status: _status,
      installed: _installed,
      commands: _commands,
      node: _node,
      ...planned
    } = cell({ id: "hung" });
    expect(withMissingCells([planned], [cell({ id: "done" })])).toEqual([
      cell({ id: "done" }),
      cell({ id: "hung", status: "not-run", reason: NO_RESULT, node: "" })
    ]);
  });
});

describe("changedCells", () => {
  it("lists new, changed and dropped cells, and nothing when the table would say the same", () => {
    const before: CompatReport = {
      date: "2026-11-02",
      cells: [cell({ line: "18", version: "18.3.0" }), cell({})]
    };
    const after: CompatReport = {
      date: "2026-11-09",
      cells: [cell({ line: "18", version: "18.3.1" }), cell({ host: "vite", line: "8", version: "8.3.6" })]
    };
    expect(changedCells(before, after)).toEqual([
      "@x/react react 18: 18.3.0 passed → 18.3.1 passed",
      "@x/react vite 8: 8.3.6 passed (new)",
      "@x/react react 19: no longer tested"
    ]);
    expect(changedCells(after, { ...after, date: "2026-11-16" })).toEqual([]);
  });
});

describe("docs/compatibility.md", () => {
  it("is what docs/compatibility.json draws", () => {
    const root = resolve(import.meta.dirname, "../..");
    const report = parseReport(
      readFileSync(join(root, "docs/compatibility.json"), "utf8"),
      "docs/compatibility.json"
    );
    expect(readFileSync(join(root, "docs/compatibility.md"), "utf8")).toBe(
      renderTable(COMPAT_MATRIX, report)
    );
  });
});
