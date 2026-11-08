#!/usr/bin/env node
/**
 * The `dependencies` command, behind `docs/dependencies.md`: `measure` installs each published package alone and audits
 * it, `table` writes the page from the report, and `publish` puts a changed page up as a pull request. The
 * `dependencies` workflow runs them weekly; see the README.
 *
 * @module
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { exec } from "@ensiria/cli-kit/exec";
import { writeIfChanged } from "@ensiria/cli-kit/files";
import { codeSpan } from "@ensiria/cli-kit/markdown";
import { ScriptError } from "@ensiria/cli-kit/script";

import { fileOnBranch, publishPage, type ReviewTarget } from "../github-pull-request/pullRequest.ts";
import type { DependencyReport, PackageResult } from "./dependencies.types.ts";
import { measuredPackage, parseReport } from "./measure.ts";
import { changedPackages, renderPage, TABLE_COMMAND } from "./table.ts";

/** The repository's root, from this file. */
const ROOT = resolve(import.meta.dirname, "../..");

/** The report the page is drawn from, and the page, from the root. */
const REPORT_PATH = "docs/dependencies.json";
const PAGE_PATH = "docs/dependencies.md";

/** The branch the page's pull request comes from, and its commit's subject. */
const PAGE_TARGET: ReviewTarget = {
  branch: "dependencies/report",
  message: "docs(dependencies): update the dependency report"
};

/** How long one install or audit may take. */
const NPM_TIMEOUT_MS = 180_000;

/** The names of the packages the repository publishes: every `packages/*` that is not private. */
const publishedNames = (): string[] =>
  readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, "packages", entry.name, "package.json")))
    .flatMap((entry) => {
      const manifest: unknown = JSON.parse(
        readFileSync(join(ROOT, "packages", entry.name, "package.json"), "utf8")
      );
      if (typeof manifest !== "object" || manifest === null || !("name" in manifest)) return [];
      const isPrivate = "private" in manifest && manifest.private === true;
      return typeof manifest.name === "string" && !isPrivate ? [manifest.name] : [];
    })
    .toSorted();

/** The report on disk, or an empty one before any run. */
const readReport = (): DependencyReport => {
  const file = join(ROOT, REPORT_PATH);
  return existsSync(file)
    ? parseReport(readFileSync(file, "utf8"), REPORT_PATH)
    : { date: "", npm: "", packages: [] };
};

await defineCommands({
  name: "dependencies",
  command: "node tools/dependencies/dependencies.mts",
  summary:
    "What each published package brings into a project and what npm audit says about it: measure, write the page, publish it.",
  icon: "package",
  json: true,
  commands: (dependencies) => ({
    measure: dependencies.command({
      summary:
        "Install each published package alone in an empty project, as npm would, audit it, and write docs/dependencies.json.",
      description:
        "Asks the npm registry: it writes only lockfiles, in folders of the system's temporary directory, and runs no install script.",
      options: {
        date: { type: "string", description: "The run's day, YYYY-MM-DD; today when left out." },
        "run-url": {
          type: "string",
          env: "DEPENDENCIES_RUN_URL",
          description: "The run's page, linked from the page."
        }
      },
      run: async ({ options, io, log }) => {
        const npm = (await exec("npm", ["--version"], { io })).stdout.trim();
        const packages: PackageResult[] = [];
        for (const name of publishedNames()) {
          const folder = mkdtempSync(join(tmpdir(), "forgebook-dependencies-"));
          try {
            writeFileSync(join(folder, "package.json"), '{ "name": "probe", "private": true }\n');
            const install = await exec(
              "npm",
              [
                "install",
                `${name}@latest`,
                "--package-lock-only",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund"
              ],
              { cwd: folder, check: false, timeoutMs: NPM_TIMEOUT_MS, io }
            );
            if (install.code !== 0) {
              if (!/\bE404\b/.test(install.stderr))
                throw new ScriptError(`npm could not install ${name}`, { hint: install.stderr.slice(-2000) });
              log.warn(`${name}: not on npm yet`);
              packages.push({ name, status: "unpublished" });
              continue;
            }
            // npm audit exits non-zero when it finds an advisory: its answer is read either way
            const audit = await exec("npm", ["audit", "--json"], {
              cwd: folder,
              check: false,
              timeoutMs: NPM_TIMEOUT_MS,
              io
            });
            const lock: unknown = JSON.parse(readFileSync(join(folder, "package-lock.json"), "utf8"));
            const result = measuredPackage(name, lock, JSON.parse(audit.stdout));
            log.info(
              `${name} ${result.version}: ${result.installed} installed, ${result.peers} through peers, ${result.advisories.length} advisories`
            );
            packages.push(result);
          } finally {
            rmSync(folder, { recursive: true, force: true });
          }
        }
        const report: DependencyReport = {
          date: options.date ?? new Date().toISOString().slice(0, 10),
          npm,
          ...(options["run-url"] === undefined ? {} : { runUrl: options["run-url"] }),
          packages
        };
        writeFileSync(join(ROOT, REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
        log.success(`${REPORT_PATH}: ${packages.length} packages`);
        return report;
      }
    }),
    table: dependencies.command({
      summary: "Write docs/dependencies.md from docs/dependencies.json.",
      options: {
        check: {
          type: "boolean",
          description: "Fail when the page is not what the report draws, instead of writing."
        }
      },
      examples: [
        {
          command: "dependencies table --check",
          description: "Whether the page is what the report draws, as the unit tests check."
        }
      ],
      run: ({ options, log }) => {
        const report = readReport();
        const page = renderPage(report);
        const pageFile = join(ROOT, PAGE_PATH);
        if (options.check) {
          const current = existsSync(pageFile) ? readFileSync(pageFile, "utf8") : "";
          if (current !== page)
            throw new ScriptError(`${PAGE_PATH} is not what ${REPORT_PATH} draws`, {
              hint: `Run ${TABLE_COMMAND}`
            });
          log.success(`${PAGE_PATH} is drawn from ${REPORT_PATH}: ${report.packages.length} packages`);
          return { packages: report.packages.length, isCurrent: true };
        }
        const isWritten = writeIfChanged(pageFile, page);
        log.success(`${PAGE_PATH}: ${isWritten ? "written" : "already current"}`);
        return { packages: report.packages.length, isWritten };
      }
    }),
    publish: dependencies.command({
      summary:
        "Open or update the pull request that brings a changed report to its branch; nothing when no result changed.",
      options: {
        token: {
          type: "string",
          required: true,
          env: "GITHUB_TOKEN",
          description: "A token that may write contents and pull requests."
        },
        repository: { type: "string", required: true, env: "GITHUB_REPOSITORY", description: "owner/name." },
        base: { type: "string", default: "develop", description: "The branch the report goes to." }
      },
      run: async ({ options, log }) => {
        const access = { repository: options.repository, token: options.token, base: options.base, fetch };
        const published = await fileOnBranch(access, REPORT_PATH, options.base);
        const previous: DependencyReport =
          published === undefined
            ? { date: "", npm: "", packages: [] }
            : parseReport(published, `${options.base}:${REPORT_PATH}`);
        const report = readReport();
        const changes = changedPackages(previous, report);
        if (changes.length === 0) {
          log.success(`no result changed: the report on ${options.base} is current`);
          return { changes, pullRequest: null };
        }
        const body = [
          `The dependency run found results that differ from the report on ${options.base}:`,
          "",
          ...changes.map((line) => `- ${codeSpan(line).markdown}`),
          "",
          report.runUrl === undefined ? "" : `Run: ${report.runUrl}`,
          "",
          "Written by `node tools/dependencies/dependencies.mts publish`; read any new advisory before merging."
        ].join("\n");
        const files = [REPORT_PATH, PAGE_PATH].map((path) => ({
          path,
          content: readFileSync(join(ROOT, path), "utf8")
        }));
        const pullRequest = await publishPage(access, PAGE_TARGET, files, body);
        log.success(`${changes.length} changed packages: ${pullRequest}`);
        return { changes, pullRequest };
      }
    })
  })
}).run();
