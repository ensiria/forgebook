/**
 * The dependency report: a package measured from npm's lockfile and audit, peers and platform binaries told apart; the
 * report read back field by field; the page drawn from it, with npm's text shown and never trusted as Markdown; the
 * changes a pull request lists; and the repository's page kept equal to what its report draws.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { DependencyReport, MeasuredPackage } from "./dependencies.types.ts";
import { measuredPackage, parseReport } from "./measure.ts";
import { changedPackages, renderPage } from "./table.ts";

/** A lockfile as npm writes it for an empty project that installed `kit`. */
const LOCK = {
  lockfileVersion: 3,
  packages: {
    "": { name: "probe", dependencies: { kit: "^1.0.0" } },
    "node_modules/kit": { version: "1.2.0", dependencies: { parser: "2.0.0", css: "1.0.0" } },
    "node_modules/parser": { version: "2.0.0" },
    "node_modules/css": { version: "1.0.0", optionalDependencies: { "css-linux-x64": "1.0.0" } },
    "node_modules/css-linux-x64": { version: "1.0.0", optional: true },
    "node_modules/css-darwin-arm64": { version: "1.0.0", optional: true },
    "node_modules/parser/node_modules/merge": { version: "4.3.1" },
    "node_modules/react": { version: "19.3.1", peer: true },
    "node_modules/scheduler": { version: "0.28.0", peer: true }
  }
};

/** An advisory as `npm audit --json` writes it under `via`. */
const advisory = (name: string, url: string, severity: string) => ({
  source: 1,
  name,
  dependency: name,
  title: `${name}: a problem`,
  url,
  severity,
  range: "<=4.3.1"
});

/** An audit that finds `merge` in kit's own tree, through `parser`, and `scheduler` through the React peer. */
const AUDIT = {
  auditReportVersion: 2,
  vulnerabilities: {
    merge: {
      name: "merge",
      severity: "low",
      via: [advisory("merge", "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", "low")],
      nodes: ["node_modules/parser/node_modules/merge"]
    },
    parser: { name: "parser", severity: "low", via: ["merge"], nodes: ["node_modules/parser"] },
    scheduler: {
      name: "scheduler",
      severity: "high",
      via: [
        advisory("scheduler", "https://github.com/advisories/GHSA-dddd-eeee-ffff", "high"),
        advisory("scheduler", "https://github.com/advisories/GHSA-dddd-eeee-ffff", "high")
      ],
      nodes: ["node_modules/scheduler"]
    }
  }
};

/** A measured package with only what a test sets. */
const measured = (fields: Partial<MeasuredPackage>): MeasuredPackage => ({
  name: "kit",
  status: "measured",
  version: "1.2.0",
  direct: 2,
  installed: 5,
  platformOnly: 2,
  peers: 2,
  advisories: [],
  ...fields
});

describe("measuredPackage", () => {
  it("counts what the package brings, its peers apart, and its platform binaries among what it brings", () => {
    const result = measuredPackage("kit", LOCK, { vulnerabilities: {} });
    expect(result).toEqual(measured({}));
  });

  it("keeps each advisory once, the most serious first, and says which come through a peer", () => {
    const { advisories } = measuredPackage("kit", LOCK, AUDIT);
    expect(
      advisories.map(({ package: name, severity, isThroughPeer }) => [name, severity, isThroughPeer])
    ).toEqual([
      ["scheduler", "high", true],
      ["merge", "low", false]
    ]);
  });

  it("stops on a lockfile without the package, or an audit in another form", () => {
    expect(() => measuredPackage("other", LOCK, AUDIT)).toThrow("node_modules/other");
    expect(() => measuredPackage("kit", LOCK, { vulnerabilities: { merge: { via: [] } } })).toThrow(
      "has no nodes or via"
    );
    expect(() =>
      measuredPackage("kit", LOCK, {
        vulnerabilities: { merge: { nodes: [], via: [{ ...advisory("merge", "u", "bad") }] } }
      })
    ).toThrow("is not a severity");
  });
});

describe("parseReport", () => {
  it("reads back what a run wrote", () => {
    const report: DependencyReport = {
      date: "2026-11-09",
      npm: "11.9.0",
      runUrl: "https://github.com/o/r/actions/runs/1",
      packages: [measuredPackage("kit", LOCK, AUDIT), { name: "new", status: "unpublished" }]
    };
    expect(parseReport(JSON.stringify(report), "report.json")).toEqual(report);
  });

  it("names the field a hand edit broke", () => {
    const broken = { date: "d", npm: "n", packages: [{ ...measured({}), installed: -1 }] };
    expect(() => parseReport(JSON.stringify(broken), "report.json")).toThrow(
      "report.json.packages[0].installed is not a count"
    );
  });
});

describe("renderPage", () => {
  it("claims nothing before any run", () => {
    const page = renderPage({ date: "", npm: "", packages: [] });
    expect(page).toContain("No run has written results yet.");
    expect(page).not.toContain("| Package |");
  });

  it("lists each package and each advisory, and says when there are none", () => {
    const report: DependencyReport = {
      date: "2026-11-09",
      npm: "11.9.0",
      packages: [measuredPackage("kit", LOCK, AUDIT), { name: "new", status: "unpublished" }]
    };
    const page = renderPage(report);
    expect(page).toContain("| `kit` | `1.2.0` | 2 | 5 | 2 | 2 | 1 high, 1 low |");
    expect(page).toContain("| `new` | not on npm yet |");
    expect(page).toContain(
      "(https://github.com/advisories/GHSA-dddd-eeee-ffff), in `scheduler <=4.3.1`, through a peer"
    );
    expect(renderPage({ ...report, packages: [measured({})] })).toContain(
      "`npm audit` finds none in any package."
    );
  });

  it("shows npm's text as text: no link but GitHub's advisory pages, and no Markdown of its own", () => {
    const page = renderPage({
      date: "2026-11-09",
      npm: "11.9.0",
      packages: [
        measured({
          advisories: [
            {
              url: "https://example.com/x",
              title: "[click](https://example.com) *now*",
              severity: "low",
              package: "merge",
              range: "*",
              isThroughPeer: false
            }
          ]
        })
      ]
    });
    expect(page).not.toContain("](https://example.com");
    expect(page).toContain("\\[click\\]");
  });
});

describe("changedPackages", () => {
  const report: DependencyReport = { date: "2026-11-02", npm: "11.9.0", packages: [measured({})] };

  it("lists nothing when a run only confirms the report, whatever its day", () => {
    expect(changedPackages(report, { ...report, date: "2026-11-09" })).toEqual([]);
  });

  it("lists a package whose result moved, and one no longer measured", () => {
    const next: DependencyReport = {
      ...report,
      packages: [measured({ version: "1.3.0", installed: 7 }), { name: "new", status: "unpublished" }]
    };
    expect(changedPackages(report, next)).toEqual([
      "kit 1.3.0: 7 installed (2 per platform), 2 through peers, audit none",
      "new: not on npm yet"
    ]);
    expect(changedPackages(report, { ...report, packages: [] })).toEqual(["kit: no longer measured"]);
  });
});

describe("the repository's page", () => {
  it("is what docs/dependencies.json draws", () => {
    const docs = resolve(import.meta.dirname, "../../docs");
    const report = parseReport(readFileSync(join(docs, "dependencies.json"), "utf8"), "dependencies.json");
    expect(readFileSync(join(docs, "dependencies.md"), "utf8")).toBe(renderPage(report));
  });
});
