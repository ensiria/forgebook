/**
 * Tests that keep the user documentation in `docs/` true to the code: every message the troubleshooting page quotes is
 * still printed by a package, and every `forgebook` command and option a page names still exists. Then the reading
 * itself, on small texts.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type CommandDescription,
  commandProblems,
  fencesOf,
  isPrintedBy,
  namedCommands,
  quotedMessages,
  sourceTexts
} from "./docsReferences.ts";

/** The repository's root. */
const ROOT = join(import.meta.dirname, "..", "..");

/** The files under a folder whose names pass a test, by absolute path. */
const filesUnder = (dir: string, isWanted: (path: string) => boolean): readonly string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((name) => join(dir, name))
    .filter((path) => !path.includes("node_modules") && isWanted(path));

/** The packages' own code: what can print a message, tests and fixtures left out. */
const SOURCE_FILES = readdirSync(join(ROOT, "packages")).flatMap((name) =>
  ["src", "bin"].flatMap((folder) => {
    const dir = join(ROOT, "packages", name, folder);
    try {
      return filesUnder(
        dir,
        (path) => /\.(?:ts|mts|tsx)$/.test(path) && !/\.(?:test|e2e)\.|[\\/]test[\\/]|\.d\.ts$/.test(path)
      );
    } catch {
      return [];
    }
  })
);

/** The documentation's pages. */
const PAGES = filesUnder(join(ROOT, "docs"), (path) => path.endsWith(".md"));

/** Whether a value is a description of the command, as far as these tests read it. */
const isDescription = (value: unknown): value is CommandDescription =>
  typeof value === "object" &&
  value !== null &&
  "commands" in value &&
  Array.isArray(value.commands) &&
  "options" in value &&
  Array.isArray(value.options);

describe("docs/", () => {
  it("quotes only messages the packages still print", () => {
    const texts = SOURCE_FILES.flatMap((file) => sourceTexts(readFileSync(file, "utf8")));
    const page = join(ROOT, "docs", "troubleshooting.md");
    const messages = quotedMessages(readFileSync(page, "utf8"));
    expect(messages.length).toBeGreaterThan(30);
    const unprinted = messages
      .filter((message) => !isPrintedBy(message.text, texts))
      .map((message) => `docs/troubleshooting.md:${message.line} ${message.text}`);
    expect(unprinted).toEqual([]);
  });

  it("names only commands and options the forgebook command has", () => {
    const output = execFileSync(
      process.execPath,
      [join(ROOT, "packages", "forgebook", "bin", "forgebook", "forgebook.mts")],
      { env: { CLI_KIT_DESCRIBE: "1" }, encoding: "utf8" }
    );
    const description: unknown = JSON.parse(output);
    if (!isDescription(description)) throw new Error("The command's description has an unexpected shape");
    const named = PAGES.flatMap((page) =>
      namedCommands(readFileSync(page, "utf8")).map((command) => ({ page, command }))
    );
    expect(named.length).toBeGreaterThan(40);
    const problems = named.flatMap(({ page, command }) =>
      commandProblems(command, description).map(
        (problem) => `${relative(ROOT, page)}:${command.line} ${problem}`
      )
    );
    expect(problems).toEqual([]);
  }, 30_000);
});

describe("fencesOf", () => {
  it("reads a fence's language and lines, and a longer fence's shorter ones as its text", () => {
    const fences = fencesOf("a\n\n````md\n```story x\n```\n````\n\n```TEXT\none\n```\n");
    expect(fences).toEqual([
      {
        language: "md",
        lines: [
          { line: 4, text: "```story x" },
          { line: 5, text: "```" }
        ]
      },
      { language: "text", lines: [{ line: 9, text: "one" }] }
    ]);
  });
});

describe("quotedMessages", () => {
  it("gives a text fence's lines without the marks a command prints", () => {
    expect(
      quotedMessages("```text\n✗ No package.json here\n  Run it there\n\n```\n```sh\nls\n```\n")
    ).toEqual([
      { line: 2, text: "No package.json here" },
      { line: 3, text: "Run it there" }
    ]);
  });
});

describe("isPrintedBy", () => {
  const texts = [
    ...sourceTexts('const message = "No package.json here, so no framework can be read";'),
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a module's source under test, whose templates are its text
    ...sourceTexts("const a = `No ${files[0]} here`; const b = `--hooks has no ${names.join(', ')}`;")
  ];

  it("finds a fixed text, part of one, and what a template prints", () => {
    expect(isPrintedBy("No package.json here, so no framework can be read", texts)).toBe(true);
    expect(isPrintedBy("No package.json here", texts)).toBe(true);
    expect(isPrintedBy("No forgebook.config.ts here", texts)).toBe(true);
    expect(isPrintedBy("--hooks has no <names>", texts)).toBe(true);
  });

  it("fails a message the source does not print", () => {
    expect(isPrintedBy("No configuration here, so it stops", texts)).toBe(false);
    expect(isPrintedBy("<file> is in no package", texts)).toBe(false);
  });
});

describe("namedCommands and commandProblems", () => {
  const description: CommandDescription = {
    options: [{ name: "config" }],
    commands: [{ name: "init", options: [{ name: "agents" }, { name: "json" }] }]
  };

  it("reads commands from inline code and shell fences, not from prose or text fences", () => {
    const page = [
      "Run `npx forgebook init --agents` here, or forgebook init --nope in prose.",
      "```sh",
      "npx forgebook init --json   # a comment --ignored",
      "```",
      "```text",
      "forgebook init --quoted",
      "```"
    ].join("\n");
    expect(namedCommands(page).map(({ command, options }) => ({ command, options }))).toEqual([
      { command: "init", options: ["json"] },
      { command: "init", options: ["agents"] }
    ]);
  });

  it("names a command that does not exist, and an option a command does not take", () => {
    const [named] = namedCommands("`forgebook init --agents --config x --force` and `forgebook start`");
    expect(named === undefined ? [] : commandProblems(named, description)).toEqual([
      "forgebook init takes no --force"
    ]);
    const started = namedCommands("`forgebook start`")[0];
    expect(started === undefined ? [] : commandProblems(started, description)).toEqual([
      "forgebook start is no command"
    ]);
  });
});

describe("sourceTexts", () => {
  it("reads strings and a template's parts, past comments and regular expressions with quotes in them", () => {
    const source = [
      "// the catalogue's page",
      "/* it's a 'block' */",
      "const quote = /['\"]/g;",
      "const a = 'one' + \"two\";",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a module's source under test, whose templates are its text
      "const b = `x ${a ? `inner ${c}` : 'z'} y`;"
    ].join("\n");
    expect(sourceTexts(source)).toEqual([
      { parts: ["one"] },
      { parts: ["two"] },
      { parts: ["inner ", ""] },
      { parts: ["z"] },
      { parts: ["x ", " y"] }
    ]);
  });
});
