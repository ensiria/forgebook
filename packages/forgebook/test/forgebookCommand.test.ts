/**
 * Tests for the `forgebook` commands as a person, a CI step or an agent runs them: a process on a small catalogue with
 * no dev server running, so each answers from a server of its own; `agents` and `init` in a project folder of their own.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runScriptProcess } from "@ensiria/cli-kit/testing";
import type { ScriptProcessRun } from "@ensiria/cli-kit/testing.types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { KIT_DIR, STORYBOOK_DIR } from "./fixturePaths.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** The command's entry. */
const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");

/** No catalogue answers there, so the command starts a server of its own. */
const NO_SERVER = "http://127.0.0.1:9";

/** How long a test may take that starts a server of its own, on a slow runner, in milliseconds. */
const SERVER_TIMEOUT = 60_000;

/** A catalogue folder with its configuration and story files. */
const catalogue = (root: string, name: string, files: Readonly<Record<string, string>>): string => {
  const dir = join(root, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "forgebook.config.ts"),
    `export default ${JSON.stringify({ framework: STUB_FRAMEWORK, title: name, stories: ["src/*.stories.tsx"] })};\n`
  );
  for (const [file, code] of Object.entries(files)) writeFileSync(join(dir, "src", file), code);
  return join(dir, "forgebook.config.ts");
};

let root = "";
let healthy = "";
let broken = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "forgebook-command-"));
  healthy = catalogue(root, "Healthy", {
    "button.stories.tsx": [
      'export default { title: "Actions/Button", args: { size: "md" } };',
      "/** The main action. */",
      'export const Primary = { args: { label: "Save" } };',
      ""
    ].join("\n")
  });
  broken = catalogue(root, "Broken", {
    "button.stories.tsx": 'export default { title: "Actions/Button" };\nexport const Primary = {};\n',
    "again.stories.tsx": 'export default { title: "Actions/Button" };\nexport const Twice = {};\n'
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Runs the command with a catalogue's configuration. */
const forgebook = (config: string, argv: readonly string[]): ScriptProcessRun =>
  runScriptProcess(ENTRY, [...argv, "--config", config, "--url", NO_SERVER]);

describe("forgebook stories", () => {
  it("lists the stories as JSON from a server of its own, with their links", async () => {
    const run = forgebook(healthy, ["stories", "--json"]);
    expect(run.exitCode).toBe(0);
    const document: unknown = JSON.parse(run.stdout);
    expect(document).toMatchObject({
      schema: 1,
      title: "Healthy",
      components: [
        {
          title: "Actions/Button",
          stories: [{ id: "stories:actions-button--primary", description: "The main action." }]
        }
      ],
      problems: []
    });
    expect(run.stdout).toContain(`${NO_SERVER}/?story=stories%3Aactions-button--primary`);
  }, 60_000);

  it("fails with the index's problems, so a CI step catches a broken story file", async () => {
    const run = forgebook(broken, ["stories"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("again.stories.tsx");
  }, 60_000);
});

describe("forgebook story", () => {
  it("gives a story's args, the meta's under its own, and its links in the view asked for", async () => {
    const run = forgebook(healthy, [
      "story",
      "stories:actions-button--primary",
      "--view",
      "theme=dark",
      "--json"
    ]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      schema: 1,
      args: { size: "md", label: "Save" },
      story: {
        links: {
          frame: `${NO_SERVER}/frame.html?theme=dark&story=stories%3Aactions-button--primary`,
          embed: `${NO_SERVER}/?embed&theme=dark&story=stories%3Aactions-button--primary`
        }
      },
      problems: []
    });
  }, 60_000);

  it("says when a story does not exist", async () => {
    const run = forgebook(healthy, ["story", "stories:nothing--here"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain('No story "stories:nothing--here"');
  }, 60_000);
});

describe("forgebook mcp", () => {
  it("answers an agent's handshake and tool calls on stdout, one message per line, and ends with its input", () => {
    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {} }
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_story", arguments: { id: "stories:actions-button--primary" } }
      }
    ];
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", healthy, "--url", NO_SERVER], {
      input: messages.map((message) => JSON.stringify(message)).join("\n"),
      encoding: "utf8"
    });
    expect(run.status).toBe(0);
    const answers: unknown[] = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(answers).toMatchObject([
      { id: 1, result: { protocolVersion: "2025-11-25", serverInfo: { name: "forgebook" } } },
      { id: 2, result: { isError: false, structuredContent: { args: { size: "md", label: "Save" } } } }
    ]);
  }, 60_000);
});

describe("forgebook docs", () => {
  it("fails a check when the package's CATALOG.md is missing, and names the command that writes it", () => {
    const run = runScriptProcess(ENTRY, ["docs", "--package", KIT_DIR, "--check"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("CATALOG.md is stale");
    expect(run.stderr).toContain("forgebook docs");
  }, 60_000);
});

describe("forgebook new", () => {
  it("prints a component's first stories, read from its file", () => {
    const run = runScriptProcess(ENTRY, ["new", join(KIT_DIR, "src", "Select.tsx"), "--print"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('import { Select } from "./Select";');
    expect(run.stdout).toContain("args: { options: [] },");
    expect(run.stdout).toContain("export const SizeLg: Story<typeof Select>");
  }, 60_000);

  it("refuses to replace a stories file that exists", () => {
    // Select.stories.tsx exists beside Select.tsx: nothing is written
    const run = runScriptProcess(ENTRY, ["new", join(KIT_DIR, "src", "Select.tsx")]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("Select.stories.tsx exists");
  }, 60_000);
});

describe("forgebook tokens", { timeout: SERVER_TIMEOUT }, () => {
  const withTokens = (): string => {
    const project = join(root, "with-tokens");
    const config = catalogue(root, "with-tokens", { "A.stories.tsx": "export default { title: 'A/B' };\n" });
    writeFileSync(
      join(project, "tokens.json"),
      readFileSync(join(import.meta.dirname, "fixtures", "tokens.json"))
    );
    writeFileSync(
      join(project, "dark.json"),
      JSON.stringify({
        color: {
          brand: {
            primary: Object.fromEntries([
              ["$type", "color"],
              ["$value", "#ffaa88"]
            ])
          }
        }
      })
    );
    const written: unknown = JSON.parse(
      readFileSync(config, "utf8")
        .replace(/^export default /, "")
        .replace(/;\s*$/, "")
    );
    const tokens = ["tokens.json", { file: "dark.json", mode: "dark" }];
    writeFileSync(config, `export default ${JSON.stringify({ ...Object(written), tokens })};\n`);
    return config;
  };

  /** Runs the command on the catalogue and reads its JSON. */
  const tokensOf = (config: string, ...args: readonly string[]): { status: number | null; body: unknown } => {
    const run = runScriptProcess(ENTRY, [
      "tokens",
      ...args,
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    return { status: run.exitCode, body: run.exitCode === 0 ? JSON.parse(run.stdout) : run.stderr };
  };

  /** The exit of a command that is meant to fail. */
  const failing = (config: string, ...args: readonly string[]): string => {
    const run = runScriptProcess(ENTRY, [
      "tokens",
      ...args,
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    expect(run.exitCode).not.toBe(0);
    return run.stderr;
  };

  it("answers an agent: how many, one token, and what to write instead of a raw value", () => {
    const config = withTokens();
    const list = tokensOf(config, "--category", "space");
    expect(list.status).toBe(0);
    expect(list.body).toMatchObject({ schema: 1, isConfigured: true, total: 2, types: { dimension: 2 } });
    expect(tokensOf(config, "--limit", "1").body).toMatchObject({
      tokens: [{ name: "color.brand.primary" }]
    });
    expect(tokensOf(config, "color.brand.primary").body).toMatchObject({
      token: { value: "#e8501c", description: "The accent.", modes: { dark: "#ffaa88" } }
    });
    expect(tokensOf(config, "--nearest", "#1c1b1b").body).toMatchObject({
      type: "color",
      matches: [
        expect.objectContaining({ name: "color.brand.ink", isClose: true, isExact: false }),
        expect.anything(),
        expect.anything()
      ]
    });
    expect(tokensOf(config, "--nearest", "12px", "--type", "padding").body).toMatchObject({
      type: "dimension",
      matches: [expect.objectContaining({ name: "space.small", distance: 4 }), expect.anything()]
    });
  });

  it("fails on what it cannot answer, with why, so an agent does not read it as no token", () => {
    const config = withTokens();
    expect(failing(config, "color.nope")).toContain('No token "color.nope"');
    expect(failing(config, "--nearest", "not a value", "--type", "color")).toContain("Cannot read");
    expect(failing(config, "--nearest", "#000", "--type", "nonsense")).toContain("Cannot compare");
  });

  /** A catalogue over a library in `lib/`, which says what its source module runs when loaded. */
  const withLibrary = (name: string, moduleHead: string): string => {
    const project = join(root, name);
    const config = catalogue(root, name, { "A.stories.tsx": "export default { title: 'A/B' };\n" });
    mkdirSync(join(project, "lib", "themes"), { recursive: true });
    const color = (value: string): unknown =>
      Object.fromEntries([
        ["$type", "color"],
        ["$value", value]
      ]);
    writeFileSync(
      join(project, "lib", "themes", "tokens.json"),
      JSON.stringify({ red: color("#ff0000"), blue: color("#0000ff") })
    );
    writeFileSync(join(project, "tokens.json"), JSON.stringify({ red: color("#ee0000") }));
    writeFileSync(
      join(project, "lib", "source.ts"),
      `${moduleHead}\nexport const source = { id: "lib", name: "Lib", files: [], tokens: ["themes/tokens.json"] };\n`
    );
    const written: unknown = JSON.parse(
      readFileSync(config, "utf8")
        .replace(/^export default /, "")
        .replace(/;\s*$/, "")
    );
    writeFileSync(
      config,
      `export default ${JSON.stringify({ ...Object(written), sources: ["./lib/source.ts"], tokens: ["tokens.json"] })};\n`
    );
    return config;
  };

  it("adds a source's tokens to the catalogue's, the catalogue's standing and the clash reported", () => {
    const config = withLibrary("from-source", "");
    const list = tokensOf(config, "--limit", "10");
    expect(list.status).toBe(0);
    expect(list.body).toMatchObject({
      isConfigured: true,
      total: 2,
      tokens: [
        { name: "red", value: "#ee0000" },
        { name: "blue", value: "#0000ff" }
      ],
      problems: [],
      clashes: [{ name: "red", kept: "tokens.json", replaced: ["./lib/source.ts: themes/tokens.json"] }]
    });
    expect(tokensOf(config, "blue").body).toMatchObject({ token: { source: "lib" }, clashes: [] });
    expect(tokensOf(config, "--nearest", "#0000ff").body).toMatchObject({
      matches: [{ name: "blue", isExact: true }, { name: "red" }]
    });
  });

  it("answers from a source whose module and stories cannot load", () => {
    // what the module imports does not exist, so loading it would fail: its text is all a token needs
    const config = withLibrary("source-broken", 'import "./missing-module";');
    writeFileSync(join(root, "source-broken", "src", "Broken.stories.tsx"), "export const = ;\n");
    expect(forgebook(config, ["stories", "--json"]).exitCode).not.toBe(0);
    expect(tokensOf(config, "blue").body).toMatchObject({ token: { value: "#0000ff" } });
  });

  it("names what a source cannot give, and fails only on tokens known to be declared", () => {
    const config = withLibrary("source-gaps", "");
    writeFileSync(
      join(root, "source-gaps", "lib", "source.ts"),
      'export const source = { id: "lib", name: "Lib", files: [], tokens: ["themes/nowhere.json"] };\n'
    );
    const written = readFileSync(config, "utf8");
    writeFileSync(config, written.replace('"./lib/source.ts"', '"./lib/source.ts","@nowhere/at-all"'));
    const list = tokensOf(config);
    expect(list.status).not.toBe(0);
    expect(JSON.stringify(list.body)).toContain("./lib/source.ts: themes/nowhere.json");
    expect(JSON.stringify(list.body)).toContain("@nowhere/at-all");
    expect(tokensOf(config, "red").body).toMatchObject({ token: { value: "#ee0000" } });
    expect(forgebook(config, ["check-code", "--json"]).stderr).toContain("themes/nowhere.json");
  });

  it("checks a change past a source it cannot read, saying so: it may hold no tokens", () => {
    const config = withLibrary("source-unparsed", "");
    writeFileSync(join(root, "source-unparsed", "lib", "source.ts"), "export const = ;\n");
    const git = (...args: readonly string[]): void => {
      const run = spawnSync("git", args, { cwd: join(root, "source-unparsed") });
      expect(run.status).toBe(0);
    };
    git("init", "-q");
    git(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "first"
    );
    const check = forgebook(config, ["check-code", "--json"]);
    expect(JSON.parse(check.stdout)).toMatchObject({
      skipped: [expect.stringContaining("./lib/source.ts")]
    });
  });

  it("reads a source installed in node_modules, not its prebundle", () => {
    const config = withLibrary("installed", "");
    const project = join(root, "installed");
    const installed = join(project, "node_modules", "@acme", "ui");
    mkdirSync(installed, { recursive: true });
    writeFileSync(
      join(installed, "package.json"),
      JSON.stringify({ name: "@acme/ui", type: "module", exports: { "./stories": "./source.js" } })
    );
    writeFileSync(
      join(installed, "tokens.json"),
      readFileSync(join(project, "lib", "themes", "tokens.json"))
    );
    writeFileSync(
      join(installed, "source.js"),
      'export const source = { id: "acme", name: "Acme", files: [], tokens: ["tokens.json"] };\n'
    );
    const written = readFileSync(config, "utf8");
    writeFileSync(config, written.replace('"./lib/source.ts"', '"@acme/ui/stories"'));
    expect(tokensOf(config, "blue").body).toMatchObject({ token: { source: "acme" }, problems: [] });
  });

  it("reads no path a source writes outside its package, and quotes no file", () => {
    const config = withLibrary("source-escapes", "");
    const project = join(root, "source-escapes");
    writeFileSync(join(project, "package.json"), "{}\n");
    writeFileSync(join(project, "lib", "package.json"), "{}\n");
    writeFileSync(join(project, "secret"), "API_KEY=abc\n");
    writeFileSync(join(project, "lib", "secret"), "API_KEY=abc\n");
    writeFileSync(
      join(project, "lib", "source.ts"),
      'export const source = { id: "lib", name: "Lib", files: [], tokens: ["../secret", "secret"] };\n'
    );
    const body = JSON.stringify(tokensOf(config).body);
    expect(body).toContain("../secret is outside the package");
    expect(body).toContain("./lib/source.ts: secret: it is not JSON");
    expect(body).not.toContain("API_KEY");
  });

  it("names a subpath a package does not export, and still answers", () => {
    const config = withLibrary("not-exported", "");
    const project = join(root, "not-exported");
    const installed = join(project, "node_modules", "@acme", "ui");
    mkdirSync(installed, { recursive: true });
    writeFileSync(
      join(installed, "package.json"),
      JSON.stringify({ name: "@acme/ui", type: "module", exports: { "./other": "./other.js" } })
    );
    const written = readFileSync(config, "utf8");
    writeFileSync(config, written.replace('"./lib/source.ts"', '"@acme/ui/stories"'));
    const answer = tokensOf(config, "red").body;
    expect(answer).toMatchObject({ token: { value: "#ee0000" } });
    expect(JSON.stringify(answer)).toContain("@acme/ui/stories");
  });

  it("says a catalogue names no tokens file, not that there is no such token", () => {
    const config = catalogue(root, "no-tokens", { "A.stories.tsx": "export default { title: 'A/B' };\n" });
    expect(tokensOf(config).body).toMatchObject({ isConfigured: false, total: 0 });
    expect(failing(config, "--nearest", "#000")).toContain("names no tokens file");
  });

  it("answers while a story file is broken: tokens have nothing to do with stories", () => {
    const config = withTokens();
    writeFileSync(join(root, "with-tokens", "src", "Broken.stories.tsx"), "export const = ;\n");
    expect(tokensOf(config, "--nearest", "#e8501c").status).toBe(0);
    rmSync(join(root, "with-tokens", "src", "Broken.stories.tsx"));
  });

  it("keeps a good answer when something else in the files is broken, and fails the whole list", () => {
    const config = withTokens();
    const project = join(root, "with-tokens");
    writeFileSync(
      join(project, "dark.json"),
      JSON.stringify({
        broken: Object.fromEntries([
          ["$type", "color"],
          ["$value", "{nowhere}"]
        ])
      })
    );
    expect(tokensOf(config, "--nearest", "#e8501c").status).toBe(0);
    expect(tokensOf(config, "--category", "color").status).not.toBe(0);
  });

  it("is what an agent's session gets through forgebook mcp, from a raw value to a token", () => {
    const config = withTokens();
    const session = (name: string, args: unknown): string =>
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", config, "--url", NO_SERVER], {
      input: [
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test", version: "1" }
          }
        }),
        session("nearest_token", { value: "#1c1b1b" })
      ].join("\n"),
      encoding: "utf8",
      timeout: 30_000
    });
    expect(run.stdout).toContain("color.brand.ink");
    expect(run.stdout).toContain("isClose");
  });
});

describe("forgebook find", { timeout: SERVER_TIMEOUT }, () => {
  it("finds a component by a word its meta declares, with its first story and its links", () => {
    const config = catalogue(root, "findable", {
      "OptionCards.stories.tsx":
        "export default { title: 'Inputs/OptionCards', keywords: ['radio tile group'] };\nexport const Plain = {};\n"
    });
    const run = runScriptProcess(ENTRY, [
      "find",
      "radio tile group",
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      schema: 1,
      components: [
        { title: "Inputs/OptionCards", missed: [], links: { address: expect.stringContaining("story=") } }
      ]
    });
  });

  it("answers nothing for words nothing holds, and exits well: an empty answer is an answer", () => {
    const config = catalogue(root, "findable-empty", {
      "A.stories.tsx": "export default { title: 'Inputs/A' };\nexport const Plain = {};\n"
    });
    const run = runScriptProcess(ENTRY, ["find", "zebra", "--config", config, "--url", NO_SERVER, "--json"]);
    expect(JSON.parse(run.stdout)).toMatchObject({ components: [] });
    expect(run.exitCode).toBe(0);
  });
});

describe("forgebook search", { timeout: SERVER_TIMEOUT }, () => {
  /** A catalogue with a component and its documentation file. */
  const documented = (name: string): string =>
    catalogue(root, name, {
      "Select.stories.tsx": "export default { title: 'Inputs/Select' };\nexport const Plain = {};\n",
      "select.md": "# Select\n\n## Keyboard\n\nThe arrow keys walk the options in order.\n"
    });

  it("finds a sentence of a component's documentation, with the address of its heading", () => {
    const config = documented("searched");
    const run = runScriptProcess(ENTRY, [
      "search",
      "arrow keys walk",
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      schema: 1,
      total: 1,
      results: [
        {
          kind: "component",
          name: "Select",
          missed: [],
          hits: [
            {
              kind: "text",
              name: "Keyboard",
              text: "The arrow keys walk the options in order.",
              address: expect.stringMatching(/component=[^#]*#keyboard$/)
            }
          ]
        }
      ]
    });
  });

  it("prints the same for a person, and says when nothing is found", () => {
    const config = documented("searched-text");
    const found = runScriptProcess(ENTRY, ["search", "keyboard", "--config", config, "--url", NO_SERVER]);
    expect(found.stdout).toContain("heading Keyboard");
    expect(found.stdout).toContain("#keyboard");
    const none = runScriptProcess(ENTRY, ["search", "zebra", "--config", config, "--url", NO_SERVER]);
    expect(none.stdout).toContain('Nothing in the catalogue holds "zebra"');
    expect(none.exitCode).toBe(0);
  });

  it("is what an agent's session gets through forgebook mcp", () => {
    const config = documented("searched-mcp");
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", config, "--url", NO_SERVER], {
      input: [
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test", version: "1" }
          }
        }),
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "search_catalogue", arguments: { query: "arrow keys", limit: 1 } }
        })
      ].join("\n"),
      encoding: "utf8",
      timeout: 30_000
    });
    expect(run.stdout).toContain("#keyboard");
  });
});

describe("forgebook changed", { timeout: 60_000 }, () => {
  it("lists a story that reaches an edited file, through an import", () => {
    const config = catalogue(root, "changing", {
      "helper.ts": "export const label = 'one';\n",
      "Card.tsx": "import { label } from './helper';\nexport const Card = () => <p>{label}</p>;\n",
      "Card.stories.tsx":
        "import { Card } from './Card';\nexport default { title: 'Layout/Card', component: Card };\nexport const Plain = {};\n",
      "Other.stories.tsx": "export default { title: 'Layout/Other' };\nexport const Plain = {};\n"
    });
    const project = join(root, "changing");
    const git = (...args: readonly string[]): void => {
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
        cwd: project
      });
    };
    writeFileSync(
      join(project, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { jsx: "react-jsx", allowJs: true }, include: ["src"] })
    );
    writeFileSync(join(project, ".gitignore"), "node_modules/\n.vite/\n");
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
    writeFileSync(join(project, "src", "helper.ts"), "export const label = 'two';\n");
    const run = runScriptProcess(ENTRY, ["changed", "--config", config, "--url", NO_SERVER, "--json"]);
    expect(run.exitCode).toBe(0);
    const body: unknown = JSON.parse(run.stdout);
    expect(body).toMatchObject({ files: ["src/helper.ts"], stories: [{ title: "Layout/Card" }] });

    // what asks is a request: an option in the place of a commit must reach git as nothing
    const precious = join(project, "precious.txt");
    writeFileSync(precious, "keep\n");
    const refused = runScriptProcess(ENTRY, [
      "changed",
      `--since=--output=${precious}`,
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr).toContain("names no commit");
    expect(readFileSync(precious, "utf8")).toBe("keep\n");
  });
});

describe("forgebook check-code", { timeout: SERVER_TIMEOUT }, () => {
  it("names what a change adds, with the token to use, and fails; a clean change passes", () => {
    const config = catalogue(root, "checking", { "A.stories.tsx": "export default { title: 'A/B' };\n" });
    const project = join(root, "checking");
    const written: unknown = JSON.parse(
      readFileSync(config, "utf8")
        .replace(/^export default /, "")
        .replace(/;\s*$/, "")
    );
    writeFileSync(
      config,
      `export default ${JSON.stringify({ ...Object(written), tokens: ["tokens.json"] })};\n`
    );
    writeFileSync(
      join(project, "tokens.json"),
      readFileSync(join(import.meta.dirname, "fixtures", "tokens.json"))
    );
    writeFileSync(join(project, ".gitignore"), "node_modules/\n.vite/\n");
    writeFileSync(join(project, "src", "a.css"), "body { margin: 0; }\n");
    const git = (...args: readonly string[]): void => {
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
        cwd: project
      });
    };
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
    const check = (): ScriptProcessRun =>
      runScriptProcess(ENTRY, ["check-code", "--config", config, "--url", NO_SERVER, "--json"]);
    expect(check().exitCode).toBe(0);
    writeFileSync(join(project, "src", "a.css"), "body { margin: 0; color: #1c1b1b; }\n");
    const run = check();
    expect(run.exitCode).not.toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      skipped: [],
      problems: [{ rule: "raw-color", file: "src/a.css", line: 1, fix: "color.brand.ink" }]
    });

    // a new file, which `git diff` does not show, and what an agent writes most
    writeFileSync(
      join(project, "src", "New.tsx"),
      'export const New = () => <p style={{ color: "#1c1b1b" }} />;\n'
    );
    expect(JSON.parse(check().stdout).problems).toContainEqual(
      expect.objectContaining({ rule: "raw-color", file: "src/New.tsx", line: 1 })
    );

    // an option in the place of a commit reaches git as nothing, and a file stays as it is
    const precious = join(project, "precious.txt");
    writeFileSync(precious, "keep\n");
    const refused = runScriptProcess(ENTRY, [
      "check-code",
      `--since=--output=${precious}`,
      "--config",
      config,
      "--url",
      NO_SERVER,
      "--json"
    ]);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr).toContain("names no commit");
    expect(readFileSync(precious, "utf8")).toBe("keep\n");

    // tokens that were asked for and cannot be read stop the check, or it would pass having checked less
    writeFileSync(join(project, "tokens.json"), "{ broken");
    const broken = check();
    expect(broken.exitCode).not.toBe(0);
    expect(broken.stderr).toContain("tokens files have problems");
  });
});

describe("forgebook agents", () => {
  it("prints the instructions, with the commands that check a story", () => {
    const run = runScriptProcess(ENTRY, ["agents", "--print"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("## Stories (Forgebook)");
    expect(run.stdout).toContain("npx forgebook check <id> --json");
  });

  it("adds its section to the project's AGENTS.md, renews it when run again, and writes the skill", () => {
    const project = join(root, "project");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "AGENTS.md"), "# Ours\n\nKeep this.\n");
    const agents = (): number | null =>
      spawnSync(process.execPath, [ENTRY, "agents", "--skill"], { cwd: project, encoding: "utf8" }).status;
    expect(agents()).toBe(0);
    expect(agents()).toBe(0);
    const text = readFileSync(join(project, "AGENTS.md"), "utf8");
    expect(text.startsWith("# Ours\n\nKeep this.\n")).toBe(true);
    expect(text.split("## Stories (Forgebook)")).toHaveLength(2);
    const skill = readFileSync(join(project, ".agents", "skills", "forgebook", "SKILL.md"), "utf8");
    expect(skill).toContain("name: forgebook");
    expect(readFileSync(join(project, ".claude", "skills", "forgebook", "SKILL.md"), "utf8")).toBe(skill);
  });
});

describe("forgebook init", () => {
  it("writes forgebook.config.ts from a project's Storybook files, and refuses to replace it without --force", () => {
    const project = join(root, "on-storybook");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(project, ".storybook"), { recursive: true });
    writeFileSync(join(project, "package.json"), '{ "name": "on-storybook", "type": "module" }\n');
    const init = (...extra: readonly string[]): ReturnType<typeof spawnSync> =>
      spawnSync(process.execPath, [ENTRY, "init", "--from", "storybook", ...extra], {
        cwd: project,
        encoding: "utf8"
      });
    const first = init();
    expect(first.status).toBe(0);
    const config = readFileSync(join(project, "forgebook.config.ts"), "utf8");
    expect(config).toContain('  title: "on-storybook",');
    expect(config).toContain('"src/**/*.stories.tsx"');
    expect(config).toContain('  preview: ".storybook/preview.tsx",');
    expect(config).toContain('id: "density"');
    expect(first.stdout).toContain("forgebook dev");
    expect(first.stderr).toContain("The MDX pages are left out");
    const again = init();
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("forgebook.config.ts is already there");
    expect(init("--force").status).toBe(0);
    // a configuration of another name the catalogue would read is not shadowed either
    const other = join(root, "on-storybook-mts");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(other, ".storybook"), { recursive: true });
    writeFileSync(join(other, "forgebook.config.mts"), "export default {};\n");
    const shadowing = spawnSync(process.execPath, [ENTRY, "init", "--from", "storybook"], {
      cwd: other,
      encoding: "utf8"
    });
    expect(shadowing.status).toBe(1);
    expect(shadowing.stderr).toContain("forgebook.config.mts is already there");
  }, 60_000);
});
