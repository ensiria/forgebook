#!/usr/bin/env node
/**
 * The `compat` command: the compatibility matrix behind `docs/compatibility.md`. `plan` asks npm which versions each
 * package's ranges claim, `run` tests one of them in a disposable checkout, `table` writes the page from the results,
 * and `publish` puts a changed page up as a pull request. The `compat` workflow runs them weekly; see the README.
 *
 * @module
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { writeIfChanged } from "@ensiria/cli-kit/files";
import { codeSpan } from "@ensiria/cli-kit/markdown";
import { ScriptError } from "@ensiria/cli-kit/script";

import { runCell } from "./cell.ts";
import type { CompatReport, PlannedCell, RegistryPackage } from "./compat.types.ts";
import { parseCell, parseManifest, parsePlannedCell, parseRegistry, parseReport } from "./documents.ts";
import { COMPAT_MATRIX } from "./matrix.ts";
import { packagesToRead, planCells } from "./plan.ts";
import { fileOnBranch, publishTable } from "./publish.ts";
import { changedCells, renderTable, TABLE_COMMAND, withMissingCells } from "./table.ts";

/** The repository's root, from this file. */
const ROOT = resolve(import.meta.dirname, "../..");

/** The report the page is drawn from, and the page, from the root. */
const REPORT_PATH = "docs/compatibility.json";
const PAGE_PATH = "docs/compatibility.md";

/** A folder's manifest, from the root. */
const readManifest = (folder: string) =>
  parseManifest(readFileSync(join(ROOT, folder, "package.json"), "utf8"), `${folder}/package.json`);

/** The registry's abbreviated document for each package: every version and the dist-tags. */
const readRegistry = async (names: readonly string[]): Promise<Map<string, RegistryPackage>> => {
  const entries = await Promise.all(
    names.map(async (name): Promise<[string, RegistryPackage]> => {
      const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, {
        headers: { accept: "application/vnd.npm.install-v1+json" }
      });
      if (!response.ok) throw new ScriptError(`the npm registry answered ${response.status} for ${name}`);
      return [name, parseRegistry(await response.json(), name)];
    })
  );
  return new Map(entries);
};

/** The report on disk, or an empty one before any run. */
const readReport = (): CompatReport => {
  const file = join(ROOT, REPORT_PATH);
  return existsSync(file) ? parseReport(readFileSync(file, "utf8"), REPORT_PATH) : { date: "", cells: [] };
};

/**
 * The report of one run, from the folder its cells' results were downloaded to and the plan they came from, written
 * over the one on disk. A planned cell with no result reads "not run"; a result for a package or tool the matrix does
 * not have stops the command, so nothing outside the matrix reaches the page.
 *
 * @throws when the folder holds no result, so a run whose cells all vanished never empties the table.
 */
const reportFromResults = (
  results: string,
  plan: string | undefined,
  date: string | undefined,
  runUrl: string | undefined
): CompatReport => {
  const folder = resolve(results);
  const found = readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".json"))
    .map((file) => parseCell(JSON.parse(readFileSync(join(folder, file), "utf8")), file));
  if (found.length === 0) throw new ScriptError(`no cell results in ${results}`);
  for (const cell of found) {
    const adapter = COMPAT_MATRIX.adapters.find((entry) => entry.name === cell.adapter);
    if (adapter === undefined || !adapter.hosts.some((entry) => entry.host === cell.host))
      throw new ScriptError(
        `a result names what the matrix does not test: ${cell.adapter} with ${cell.host}`
      );
  }
  const planned = plan === undefined ? [] : parsePlan(readFileSync(resolve(plan), "utf8"), plan);
  const report: CompatReport = {
    date: date ?? new Date().toISOString().slice(0, 10),
    ...(runUrl === undefined ? {} : { runUrl }),
    cells: withMissingCells(planned, found).sort((a, b) => a.id.localeCompare(b.id))
  };
  writeIfChanged(join(ROOT, REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

/** The cells of `plan --json`, as the workflow keeps it. */
const parsePlan = (source: string, file: string): PlannedCell[] => {
  const value: unknown = JSON.parse(source);
  const cells = typeof value === "object" && value !== null && "cell" in value ? value.cell : undefined;
  if (!Array.isArray(cells)) throw new ScriptError(`${file} is not a plan: it has no cell list`);
  return cells.map((cell, index) => parsePlannedCell(cell, `${file} cell[${index}]`));
};

await defineCommands({
  name: "compat",
  command: "node tools/compat/compat.mts",
  summary: "Test each package against the versions of the tools it claims, and write docs/compatibility.md.",
  icon: "check",
  json: true,
  commands: (compat) => ({
    plan: compat.command({
      summary:
        "List the cells of a run: each package, each tool, each version its range claims, and the prerelease.",
      examples: [{ command: "compat plan --json", description: "The matrix the workflow's cells run." }],
      run: async ({ log, isJson }) => {
        const cells = planCells(
          COMPAT_MATRIX,
          readManifest,
          await readRegistry(packagesToRead(COMPAT_MATRIX))
        );
        if (!isJson)
          for (const cell of cells) log.plain(`${cell.adapter}  ${cell.host} ${cell.line}  ${cell.version}`);
        return { cell: cells };
      }
    }),
    run: compat.command({
      summary:
        "Test one cell in this checkout: pin the version, install, run the package's and its fixture's commands.",
      description:
        "Rewrites the root package.json and the lockfile: run it in a disposable checkout, as the workflow does.",
      options: {
        cell: {
          type: "string",
          required: true,
          env: "COMPAT_CELL",
          description: "The cell, as JSON: one entry of `plan --json`."
        },
        out: { type: "string", required: true, description: "Where to write the cell's result (JSON)." }
      },
      examples: [
        {
          command:
            'compat run --out result.json --cell \'{"id":"forgebook-preact-10","adapter":"@forgebook/preact","host":"preact","range":"^10.19.0 || ^11.0.0","line":"10","version":"10.29.0"}\'',
          description: "Preact 10 under @forgebook/preact."
        }
      ],
      run: async ({ options, io, log }) => {
        const result = await runCell(COMPAT_MATRIX, parsePlannedCell(JSON.parse(options.cell), "--cell"), {
          root: ROOT,
          io,
          node: process.versions.node
        });
        mkdirSync(dirname(resolve(options.out)), { recursive: true });
        writeFileSync(resolve(options.out), `${JSON.stringify(result, null, 2)}\n`);
        if (result.status !== "passed") {
          throw new ScriptError(`${result.adapter} with ${result.host} ${result.version}: ${result.status}`, {
            hint: result.reason
          });
        }
        log.success(`${result.adapter} with ${result.host} ${result.version}: passed`);
        return result;
      }
    }),
    table: compat.command({
      summary:
        "Write docs/compatibility.md from docs/compatibility.json, after merging a run's results into it.",
      options: {
        plan: {
          type: "string",
          description: "The run's plan (`plan --json`): a planned cell with no result reads not run."
        },
        results: {
          type: "string",
          description: "A folder of cell results (`run --out`): they replace the report, as one run's."
        },
        date: { type: "string", description: "The run's day, YYYY-MM-DD; today when left out." },
        "run-url": {
          type: "string",
          env: "COMPAT_RUN_URL",
          description: "The run's page, linked from the table."
        },
        check: {
          type: "boolean",
          description: "Fail when the page is not what the report draws, instead of writing."
        }
      },
      examples: [
        {
          command: "compat table --check",
          description: "Whether the page is what the report draws, as the unit tests check."
        },
        {
          command: "compat table --plan plan.json --results results",
          description: "What the workflow runs after its cells."
        }
      ],
      run: ({ options, log }) => {
        const report =
          options.results === undefined
            ? readReport()
            : reportFromResults(options.results, options.plan, options.date, options["run-url"]);
        const page = renderTable(COMPAT_MATRIX, report);
        const pageFile = join(ROOT, PAGE_PATH);
        if (options.check) {
          const current = existsSync(pageFile) ? readFileSync(pageFile, "utf8") : "";
          if (current !== page)
            throw new ScriptError(`${PAGE_PATH} is not what ${REPORT_PATH} draws`, {
              hint: `Run ${TABLE_COMMAND}`
            });
          log.success(`${PAGE_PATH} is drawn from ${REPORT_PATH}: ${report.cells.length} cells`);
          return { cells: report.cells.length, isCurrent: true };
        }
        const isWritten = writeIfChanged(pageFile, page);
        log.success(
          `${PAGE_PATH}: ${isWritten ? "written" : "already current"}, ${report.cells.length} cells`
        );
        return { cells: report.cells.length, isWritten };
      }
    }),
    publish: compat.command({
      summary:
        "Open or update the pull request that brings a changed table to its branch; nothing when no result changed.",
      options: {
        token: {
          type: "string",
          required: true,
          env: "GITHUB_TOKEN",
          description: "A token that may write contents and pull requests."
        },
        repository: { type: "string", required: true, env: "GITHUB_REPOSITORY", description: "owner/name." },
        base: { type: "string", default: "develop", description: "The branch the table goes to." }
      },
      run: async ({ options, log }) => {
        const access = { repository: options.repository, token: options.token, base: options.base, fetch };
        const published = await fileOnBranch(access, REPORT_PATH, options.base);
        const previous: CompatReport =
          published === undefined
            ? { date: "", cells: [] }
            : parseReport(published, `${options.base}:${REPORT_PATH}`);
        const report = readReport();
        const changes = changedCells(previous, report);
        if (changes.length === 0) {
          log.success(`no result changed: the table on ${options.base} is current`);
          return { changes, pullRequest: null };
        }
        const body = [
          `The compatibility run found results that differ from the table on ${options.base}:`,
          "",
          ...changes.map((line) => `- ${codeSpan(line).markdown}`),
          "",
          report.runUrl === undefined ? "" : `Run: ${report.runUrl}`,
          "",
          "Written by `node tools/compat/compat.mts publish`; review the failures before merging."
        ].join("\n");
        const files = [REPORT_PATH, PAGE_PATH].map((path) => ({
          path,
          content: readFileSync(join(ROOT, path), "utf8")
        }));
        const pullRequest = await publishTable(access, files, body);
        log.success(`${changes.length} changed results: ${pullRequest}`);
        return { changes, pullRequest };
      }
    })
  })
}).run();
