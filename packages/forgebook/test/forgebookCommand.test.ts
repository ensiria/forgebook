/**
 * Tests for the `forgebook` commands as a person, a CI step or an agent runs them: a process on a small catalogue with
 * no dev server running, so each answers from a server of its own; `agents` and `init` in a project folder of their own.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { runScriptProcess } from "@ensiria/cli-kit/testing";
import type { ScriptProcessRun } from "@ensiria/cli-kit/testing.types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { printable } from "../bin/forgebook/auditRun.ts";
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
    // a second file of the title, with a story whose id the first file's story has
    "again.stories.tsx": 'export default { title: "Actions/Button" };\nexport const Primary = {};\n'
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Runs the command with a catalogue's configuration. */
const forgebook = (config: string, argv: readonly string[]): ScriptProcessRun =>
  runScriptProcess(ENTRY, [...argv, "--config", config, "--url", NO_SERVER]);

describe("a configuration that cannot be used", () => {
  /** A folder of files, one of them the configuration. */
  const folderOf = (name: string, files: Readonly<Record<string, string>>): string => {
    const dir = join(root, name);
    mkdirSync(join(dir, "src"), { recursive: true });
    for (const [file, code] of Object.entries(files)) writeFileSync(join(dir, file), code);
    return dir;
  };
  const brokenFile = 'export default {\n  title: "x"\n  framework: 1,\n};\n';

  it.each(["forgebook.config.ts", "forgebook.config.mts", "forgebook.config.js"])(
    "names the file, line and column of a syntax error in %s",
    (file) => {
      const dir = folderOf(`syntax-${file}`, { "package.json": '{"type":"module"}', [file]: brokenFile });
      const run = forgebook(join(dir, file), ["stories"]);
      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain(`${join(dir, file)}:3:3: `);
    }
  );

  it("names the file at fault when the configuration imports it", () => {
    const dir = folderOf("syntax-imported", {
      "forgebook.config.ts": 'import shared from "./shared.ts";\nexport default shared;\n',
      "shared.ts": brokenFile
    });
    const run = forgebook(join(dir, "forgebook.config.ts"), ["stories"]);
    expect(run.exitCode).toBe(1);
    // Node resolves an import to its real path, which a temporary folder may not be
    expect(run.stderr).toContain(`${realpathSync(join(dir, "shared.ts"))}:3:3: `);
  });

  it("names the configuration when it fails for another reason", () => {
    const dir = folderOf("throws", { "forgebook.config.ts": 'throw new Error("boom");\n' });
    const run = forgebook(join(dir, "forgebook.config.ts"), ["stories"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(`${join(dir, "forgebook.config.ts")}: it did not load: boom`);
  });

  it("stops on a misspelt key before answering", () => {
    const dir = folderOf("misspelt", {
      "forgebook.config.ts": `export default ${JSON.stringify({
        framework: STUB_FRAMEWORK,
        title: "T",
        stories: ["src/*.stories.tsx"],
        toolbr: []
      })};\n`
    });
    const run = forgebook(join(dir, "forgebook.config.ts"), ["stories", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain('it has no key "toolbr". Did you mean toolbar?');
  });

  it.each(["build", "stories", "check x"])(
    "%s stops on a story pattern that matches nothing, naming it",
    (command) => {
      const empty = catalogue(root, `empty-${command.split(" ")[0]}`, {});
      const run = runScriptProcess(ENTRY, [...command.split(" "), "--config", empty]);
      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain('No story file matches "src/*.stories.tsx"');
    }
  );
});

describe("forgebook verify with a story pattern that matches nothing", () => {
  it(
    "answers not verified, naming the pattern, and still gives the rest of its answer",
    () => {
      const empty = catalogue(root, "empty-verify-answer", {});
      const dir = dirname(empty);
      const git = (...args: readonly string[]): void => {
        spawnSync(
          "git",
          ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
          { cwd: dir }
        );
      };
      git("init", "-q");
      git("add", "-A");
      git("commit", "-q", "-m", "first");
      const run = runScriptProcess(ENTRY, [
        "verify",
        "--since",
        "HEAD",
        "--json",
        "--config",
        empty,
        "--url",
        NO_SERVER
      ]);
      expect(run.exitCode).toBe(1);
      const document: unknown = JSON.parse(run.stdout);
      expect(document).toMatchObject({
        verdict: "not-verified",
        skipped: expect.arrayContaining([
          expect.stringContaining('No story file matches "src/*.stories.tsx"')
        ])
      });
    },
    SERVER_TIMEOUT
  );
});

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

  it("keeps the good stories of a catalogue with a story file that does not parse, and names its place", () => {
    const config = catalogue(root, "Unparsed", {
      "good.stories.tsx": 'export default { title: "Good" };\nexport const Main = {};\n',
      "bad.stories.tsx": 'export default { title: "Bad" };\nexport const Main = { args: { a: 1 };\n'
    });
    const run = forgebook(config, ["stories", "--json"]);
    // a CI step still fails on it
    expect(run.exitCode).toBe(1);
    const document: unknown = JSON.parse(run.stdout);
    expect(document).toMatchObject({ components: [{ title: "Good" }] });
    expect(document).toMatchObject({
      problems: [expect.stringMatching(/bad\.stories\.tsx:2:\d+ does not parse: /)]
    });
  }, 60_000);

  it("gives an agent the same problem through forgebook mcp", () => {
    const config = join(root, "Unparsed", "forgebook.config.ts");
    const message = (id: number, method: string, params: unknown): string =>
      JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", config, "--url", NO_SERVER], {
      input: [
        message(0, "initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1" }
        }),
        message(1, "tools/call", { name: "list_stories", arguments: {} })
      ].join("\n"),
      encoding: "utf8",
      timeout: SERVER_TIMEOUT
    });
    expect(run.stdout).toMatch(/bad\.stories\.tsx:2:\d+ does not parse/);
    expect(run.stdout).toContain("Good");
  }, 60_000);
});

describe("forgebook build", () => {
  it("ends on a story file that does not parse with its place, without a stack", () => {
    // a real framework, for a build's pages: the fixture app's packages under a catalogue of its own
    const project = join(root, "unparsed-build");
    mkdirSync(join(project, "src"), { recursive: true });
    symlinkSync(
      join(import.meta.dirname, "..", "..", "..", "fixtures", "app", "node_modules"),
      join(project, "node_modules"),
      "junction"
    );
    writeFileSync(join(project, "package.json"), '{ "type": "module" }\n');
    const config = join(project, "forgebook.config.ts");
    writeFileSync(
      config,
      [
        'import { react } from "@forgebook/react/vite";',
        'import { defineConfig } from "forgebook";',
        'export default defineConfig({ framework: react(), title: "Unparsed", stories: ["src/*.stories.tsx"] });',
        ""
      ].join("\n")
    );
    writeFileSync(
      join(project, "src", "bad.stories.tsx"),
      'export default { title: "Bad" };\nexport const Main = { args: { a: 1 };\n'
    );
    const build = (...flags: readonly string[]): ScriptProcessRun =>
      runScriptProcess(ENTRY, ["build", "--config", config, "--out", join(root, "unparsed-site"), ...flags]);
    const run = build();
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toMatch(/bad\.stories\.tsx:2:\d+ does not parse: /);
    expect(run.stderr).not.toMatch(/\bat .+:\d+:\d+/);
    const verbose = build("--verbose");
    expect(verbose.exitCode).toBe(1);
    expect(verbose.stdout).toMatch(/\bat .+:\d+:\d+/);
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
      // the stub's component documents no prop
      requiredProps: [],
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
      {
        id: 2,
        result: {
          isError: false,
          structuredContent: { requiredProps: [], args: { size: "md", label: "Save" } }
        }
      }
    ]);
  }, 60_000);

  it("carries a story pattern that matches nothing in list_stories' problems, for an agent about to write a story", () => {
    const empty = catalogue(root, "empty-mcp", {});
    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {} }
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_stories", arguments: {} } }
    ];
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", empty, "--url", NO_SERVER], {
      input: messages.map((message) => JSON.stringify(message)).join("\n"),
      encoding: "utf8"
    });
    expect(run.status).toBe(0);
    const answers: unknown[] = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(answers[1]).toMatchObject({
      id: 2,
      result: {
        structuredContent: {
          problems: [expect.stringContaining('No story file matches "src/*.stories.tsx"')]
        }
      }
    });
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

  it("imports a default export without braces, and one exported both ways by its name", () => {
    const project = join(root, "default-export");
    mkdirSync(join(project, "src"), { recursive: true });
    writeFileSync(join(project, "package.json"), "{}\n");
    // the framework's docs are found from the component's package
    symlinkSync(join(KIT_DIR, "node_modules"), join(project, "node_modules"), "junction");
    writeFileSync(
      join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { jsx: "preserve", strict: true, skipLibCheck: true, module: "esnext" },
        include: ["src"]
      })
    );
    writeFileSync(
      join(project, "src", "App.tsx"),
      "function App(props: { title: string }) {\n  return props.title;\n}\nexport default App;\n"
    );
    writeFileSync(
      join(project, "src", "Both.tsx"),
      "export const Both = (props: { title: string }) => props.title;\nexport default Both;\n"
    );
    writeFileSync(
      join(project, "src", "Card.tsx"),
      "export default function Card(props: { title: string }) {\n  return props.title;\n}\n"
    );
    const newStories = (file: string, ...flags: readonly string[]): ScriptProcessRun =>
      runScriptProcess(ENTRY, [
        "new",
        join(project, "src", file),
        "--framework",
        "react",
        "--print",
        ...flags
      ]);
    const app = newStories("App.tsx");
    expect(app.stdout).toContain('import App from "./App";');
    expect(newStories("Both.tsx").stdout).toContain('import { Both } from "./Both";');
    expect(newStories("Both.tsx", "--export", "default").stdout).toContain('import Both from "./Both";');
    expect(newStories("Card.tsx").stdout).toContain('import Card from "./Card";');
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

    // a change whose only story file does not parse touches no story that can be read, and still fails
    git("checkout", "--", "src/helper.ts");
    writeFileSync(join(project, "src", "broken.stories.tsx"), "export const = ;\n");
    const verify = runScriptProcess(ENTRY, ["verify", "--config", config, "--url", NO_SERVER, "--json"]);
    expect(verify.exitCode).toBe(1);
    expect(verify.stderr).toMatch(/broken\.stories\.tsx:1:\d+ does not parse/);
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

describe("forgebook with no tokens file", { timeout: SERVER_TIMEOUT }, () => {
  /** A catalogue in a repository, its sheet declaring a system and one commit made. */
  const appProject = (name: string, sheet: string, written?: string): string => {
    const config = catalogue(root, name, { "A.stories.tsx": "export default { title: 'A/B' };\n" });
    const project = join(root, name);
    if (written !== undefined) writeFileSync(config, written);
    writeFileSync(join(project, ".gitignore"), "node_modules/\n.vite/\n");
    writeFileSync(join(project, "src", "a.css"), sheet);
    writeFileSync(
      join(project, "src", "Button.tsx"),
      'export const Button = ({ size, tone }) => <button className="a" />;\n'
    );
    writeFileSync(
      join(project, "src", "OldCard.tsx"),
      "/** @deprecated Too plain. @replacedBy Card */\nexport const OldCard = () => <div />;\n"
    );
    const git = (...args: readonly string[]): void => {
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
        cwd: project
      });
    };
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
    return config;
  };
  const System = [
    ":root { --ink: #111111; --paper: #ffffff; --brand: #ff0033; --line: #dddddd; --muted: #777777; --space-2: 8px; }",
    ".dark { --ink: #eeeeee; --paper: #000000; }",
    ""
  ].join("\n");

  it("checks a change against what the application declares, and says what it read", () => {
    const config = appProject("app-system", System);
    writeFileSync(
      join(root, "app-system", "src", "New.tsx"),
      'export const New = () => <p style={{ color: "#ff0033" }} />;\n'
    );
    const run = forgebook(config, ["check-code", "--json"]);
    expect(run.exitCode).not.toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      skipped: [],
      checked: [
        "raw-color",
        "raw-size",
        "suppression",
        "deleted-test",
        "deprecated-component",
        "duplicate-component"
      ],
      tokenSources: [{ kind: "css-variables", file: "src/a.css", tokens: 6 }],
      tokenClashes: 0,
      problems: [{ rule: "raw-color", file: "src/New.tsx", fix: "--brand" }]
    });
    expect(forgebook(config, ["check-code"]).stdout).toContain("Read from: src/a.css (css-variables, 6)");
  });

  it("answers the token questions from the same reading", () => {
    const config = appProject("app-tokens", System);
    expect(JSON.parse(forgebook(config, ["tokens", "--category", "color", "--json"]).stdout)).toMatchObject({
      isConfigured: true,
      total: 5,
      sources: [{ kind: "css-variables", file: "src/a.css", tokens: 6 }],
      notes: []
    });
    const nearest = JSON.parse(forgebook(config, ["tokens", "--nearest", "#ff0034", "--json"]).stdout);
    expect(nearest.matches[0]).toMatchObject({ name: "--brand", isClose: true });
    // a custom property's dashes read as an option on a command line, so its name holds without them
    const ink = JSON.parse(forgebook(config, ["tokens", "ink", "--json"]).stdout);
    expect(ink.token).toMatchObject({
      name: "--ink",
      modes: { dark: "#eeeeee" },
      origin: { kind: "css-variables", file: "src/a.css", line: 1 }
    });
  });

  it("does not stop on what it cannot read: it says so and goes on", () => {
    const config = appProject("app-notes", `@import "@acme/gone/x.css";\n${System}`);
    const run = forgebook(config, ["check-code", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout).tokenNotes[0]).toContain("@acme/gone/x.css");
    expect(forgebook(config, ["tokens", "--json"]).exitCode).toBe(0);
  });

  it("does not take a brand colour and little else for a palette", () => {
    const config = appProject("app-small", ":root { --brand: #ff0033; }\n");
    writeFileSync(
      join(root, "app-small", "src", "New.tsx"),
      'export const New = () => <p style={{ color: "#123456" }} />;\n'
    );
    const run = forgebook(config, ["check-code", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      checked: ["suppression", "deleted-test", "deprecated-component", "duplicate-component"],
      skipped: ["colours and sizes not checked: too few tokens of that kind in the application (1)"],
      problems: []
    });
  });

  it("compares only its own folder's files: another package of the repository has its own system", () => {
    const config = appProject("app-monorepo-outer", System);
    const project = join(root, "app-monorepo-outer");
    mkdirSync(join(project, "packages", "ui", "src"), { recursive: true });
    const inner = join(project, "packages", "ui", "forgebook.config.ts");
    writeFileSync(inner, readFileSync(config, "utf8"));
    writeFileSync(join(project, "packages", "ui", "src", "a.css"), System);
    writeFileSync(
      join(project, "packages", "ui", "src", "Own.tsx"),
      'export const A = <p style={{ color: "#ff0033" }} />;\n'
    );
    writeFileSync(
      join(project, "src", "Other.tsx"),
      'export const A = <p style={{ color: "#ff0033" }} />;\n'
    );
    const answer = JSON.parse(forgebook(inner, ["check-code", "--json"]).stdout);
    expect(answer.problems.map((each: { file: string }) => each.file)).toEqual(["packages/ui/src/Own.tsx"]);
    expect(answer.notCompared).toContain("src/Other.tsx");
  });

  it("names an import of what is deprecated and a new component that copies one, with no tags needed for the second", () => {
    const config = appProject("app-reuse", ":root { --a: 1px; }\n");
    const project = join(root, "app-reuse");
    writeFileSync(
      join(project, "src", "New.tsx"),
      'import { OldCard } from "./OldCard";\nexport const PrimaryButton = ({ size, tone }) => <button className="b" />;\n'
    );
    const run = forgebook(config, ["check-code", "--json"]);
    expect(run.exitCode).not.toBe(0);
    const { problems } = JSON.parse(run.stdout);
    expect(problems).toContainEqual(
      expect.objectContaining({ rule: "deprecated-component", value: "OldCard", fix: "Card" })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({ rule: "duplicate-component", value: "PrimaryButton", fix: "Button" })
    );
  });

  it("reads nothing when the configuration says there is no system", () => {
    const off = `export default ${JSON.stringify({
      framework: STUB_FRAMEWORK,
      title: "off",
      stories: ["src/*.stories.tsx"],
      tokens: []
    })};\n`;
    const config = appProject("app-off", System, off);
    expect(JSON.parse(forgebook(config, ["check-code", "--json"]).stdout)).toMatchObject({
      skipped: ["colours and sizes not checked: no tokens file"],
      tokenSources: []
    });
    expect(JSON.parse(forgebook(config, ["tokens", "--json"]).stdout)).toMatchObject({ isConfigured: false });
  });

  it("does not read the application when a tokens file is named: that is the system", () => {
    const named = `export default ${JSON.stringify({
      framework: STUB_FRAMEWORK,
      title: "named",
      stories: ["src/*.stories.tsx"],
      tokens: ["tokens.json"]
    })};\n`;
    const config = appProject("app-named", System, named);
    writeFileSync(
      join(root, "app-named", "tokens.json"),
      readFileSync(join(import.meta.dirname, "fixtures", "tokens.json"))
    );
    const { tokens, sources } = JSON.parse(forgebook(config, ["tokens", "--json"]).stdout);
    expect(tokens.some((each: { name: string }) => each.name === "--ink")).toBe(false);
    expect(sources[0]).toMatchObject({ kind: "tokens-file", file: "tokens.json" });
  });
});

describe("forgebook graph", () => {
  /** A project with a small system and rules on it. */
  const ruledProject = (): string => {
    const dir = mkdtempSync(join(root, "graph-"));
    writeFileSync(join(dir, "a.css"), ":root { --ink: #111111; }\n");
    writeFileSync(
      join(dir, "Radio.tsx"),
      '/**\n * @intent choose-one: a few options\n * @parent Form\n */\nexport const Radio = () => <input style={{ color: "var(--ink)" }} />;\n'
    );
    writeFileSync(
      join(dir, "Select.tsx"),
      "/** @intent choose-one: many options */\nexport const Select = () => <select />;\n"
    );
    writeFileSync(join(dir, "Form.tsx"), "export const Form = () => <form><Radio /></form>;\n");
    return dir;
  };

  it("gives what exists and how to choose, those with something to say first, with no configuration", () => {
    const run = runScriptProcess(ENTRY, ["graph", ruledProject(), "--json"]);
    expect(run.exitCode).toBe(0);
    const document = JSON.parse(run.stdout);
    expect(document).toMatchObject({
      schema: 1,
      total: 3,
      tokens: { color: 1 },
      intents: {
        "choose-one": [
          { component: "Radio", when: "a few options" },
          { component: "Select", when: "many options" }
        ]
      }
    });
    expect(document.components[2]).toMatchObject({ name: "Form", renders: ["Radio"] });
  });

  it("gives one intent's choices, and one component with what is around it", () => {
    const dir = ruledProject();
    const intent = JSON.parse(
      runScriptProcess(ENTRY, ["graph", dir, "--intent", "choose-one", "--json"]).stdout
    );
    expect(intent.components.map((each: { name: string }) => each.name).toSorted()).toEqual([
      "Radio",
      "Select"
    ]);
    const detail = JSON.parse(
      runScriptProcess(ENTRY, ["graph", dir, "--component", "Radio", "--json"]).stdout
    ).detail;
    expect(detail).toMatchObject({ renderedBy: ["Form"], tokens: ["--ink"], usedBy: 1 });
    expect(runScriptProcess(ENTRY, ["graph", dir]).stdout).toContain("3 components, tokens: 1 color.");
  });

  it("takes any name for an intent, and rules beside a file by either name", () => {
    const dir = ruledProject();
    writeFileSync(join(dir, "Tag.tsx"), "/** @intent constructor: odd */\nexport const Tag = () => <b />;\n");
    writeFileSync(join(dir, "pick-list.tsx"), "export const PickList = () => <ul />;\n");
    writeFileSync(join(dir, "PickList.rules.json"), '{ "PickList": { "intent": "pick-many: long lists" } }');
    const document = JSON.parse(runScriptProcess(ENTRY, ["graph", dir, "--json"]).stdout);
    expect(document.intents.constructor).toEqual([{ id: "constructor", when: "odd", component: "Tag" }]);
    expect(document.intents["pick-many"]).toEqual([
      { id: "pick-many", when: "long lists", component: "PickList" }
    ]);
    expect(runScriptProcess(ENTRY, ["graph", dir, "--intent", "constructor", "--json"]).exitCode).toBe(0);
  });

  it("answers an agent with no shell through the catalogue", () => {
    const config = catalogue(root, "graph-mcp", {
      "A.stories.tsx": "export default { title: 'A/B' };\n",
      "Thing.tsx": "export const Thing = () => <a />;\n"
    });
    const document = JSON.parse(
      spawnSync(process.execPath, [ENTRY, "mcp", "--config", config, "--url", NO_SERVER], {
        encoding: "utf8",
        input: [
          JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "component_graph", arguments: {} }
          }),
          ""
        ].join("\n")
      })
        .stdout.split("\n")
        .filter((line) => line.includes('"id":2'))[0] ?? "{}"
    );
    expect(document.result.content[0].text).toContain('"name":"Thing"');
  });
});

describe("forgebook audit", () => {
  /** A project with no catalogue. */
  const plainProject = (): string => {
    const dir = mkdtempSync(join(root, "audit-"));
    writeFileSync(
      join(dir, "a.css"),
      ":root { --ink: #111111; }\na { color: #111111; }\nb { color: #ff0033; }\nc { color: #ff0033; }\nd { color: #ff0033; }\n"
    );
    writeFileSync(
      join(dir, "Button.tsx"),
      'export const Button = ({ size, tone }) => <button className="a" />;\n'
    );
    writeFileSync(join(dir, "Btn.tsx"), 'export const Btn = ({ size, tone }) => <button className="b" />;\n');
    return dir;
  };

  it("reports with no configuration, gives an agent its next steps, and exits 0", () => {
    const run = runScriptProcess(ENTRY, ["audit", plainProject(), "--json"]);
    expect(run.exitCode).toBe(0);
    const document = JSON.parse(run.stdout);
    expect(document).toMatchObject({
      schema: 1,
      system: { tokens: 1, own: 1, sources: [{ kind: "css-variables", file: "a.css", tokens: 1 }] },
      colors: { distinct: 2, hardCoded: 4 },
      components: { count: 2, lookAlikes: [{ confidence: "high" }] }
    });
    expect(document.actions).toContainEqual(
      expect.objectContaining({
        kind: "use-token",
        args: ["audit", expect.any(String), "--value", "#111111", "--json"]
      })
    );
    expect(document.actions).toContainEqual(expect.objectContaining({ kind: "name-value", count: 3 }));
    expect(document.actions).toContainEqual(expect.objectContaining({ kind: "merge-components", count: 2 }));
  });

  it("says it to a person, and lists the lines of one value", () => {
    const dir = plainProject();
    const text = runScriptProcess(ENTRY, ["audit", dir]).stdout;
    expect(text).toContain("Greys: 1 different, 1 used 90 % of the time.");
    expect(text).toContain("Components: 2, 1 groups that look like one.");
    const sites = JSON.parse(runScriptProcess(ENTRY, ["audit", dir, "--value", "#FF0033", "--json"]).stdout);
    expect(sites.sites.map((each: { line: number }) => each.line)).toEqual([3, 4, 5]);
  });

  it("reads nothing a link leads to outside the project, and runs nothing git is told to", () => {
    const outside = mkdtempSync(join(root, "audit-outside-"));
    writeFileSync(join(outside, "secret.css"), "a { color: #abc123; } /* API_TOKEN */\n");
    const dir = mkdtempSync(join(root, "audit-links-"));
    symlinkSync(join(outside, "secret.css"), join(dir, "leak.css"));
    writeFileSync(join(dir, "own.css"), "a { color: #123abc; }\n");
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["config", "core.fsmonitor", `touch ${join(dir, "ran")}`], { cwd: dir });
    const document = JSON.parse(runScriptProcess(ENTRY, ["audit", dir, "--json"]).stdout);
    expect(JSON.stringify(document)).not.toContain("abc123");
    expect(document.colors.distinct).toBe(1);
    expect(existsSync(join(dir, "ran"))).toBe(false);
  });

  it("refuses a value that is neither a colour nor a size, rather than say it is not there", () => {
    expect(runScriptProcess(ENTRY, ["audit", ".", "--value", "red"]).exitCode).not.toBe(0);
  });

  it("keeps a report one line per line, whatever a file's name holds", () => {
    expect(printable("a\u001b[2Jb\nc")).toBe("a?[2Jb\nc");
  });

  it("says when there is nothing to read, and refuses a bad limit", () => {
    const empty = mkdtempSync(join(root, "audit-empty-"));
    expect(runScriptProcess(ENTRY, ["audit", empty]).stdout).toContain(
      "No style sheet or component file here"
    );
    expect(runScriptProcess(ENTRY, ["audit", empty, "--limit", "0"]).exitCode).not.toBe(0);
  });
});

describe("a built catalogue for agents", { timeout: SERVER_TIMEOUT }, () => {
  /** The fixture's catalogue, which has a real framework to build with. */
  const Fixture = join(import.meta.dirname, "..", "..", "..", "fixtures", "app", "forgebook.config.ts");

  it("answers from its folder, with no server and no repository, and only reads", () => {
    const out = join(root, "built-site");
    const built = runScriptProcess(ENTRY, ["build", "--config", Fixture, "--out", out, "--agent-index"]);
    expect(built.exitCode).toBe(0);
    const message = (id: number, method: string, params: unknown): string =>
      JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const input = [
      message(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" }
      }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      message(2, "tools/list", {}),
      message(3, "tools/call", { name: "find_component", arguments: { query: "button" } })
    ].join("\n");
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--from", out], {
      cwd: tmpdir(),
      input: `${input}\n`,
      encoding: "utf8"
    });
    expect(run.status).toBe(0);
    const [, list, found] = run.stdout.trim().split("\n");
    expect(list).toContain("find_component");
    expect(list).not.toContain("check_story");
    expect(list).not.toContain("new_stories");
    expect(found).toContain("components/Button");
  });

  it("writes nothing for agents unless asked, and takes an old index away", () => {
    const out = join(root, "built-site");
    expect(runScriptProcess(ENTRY, ["build", "--config", Fixture, "--out", out]).exitCode).toBe(0);
    expect(existsSync(join(out, "forgebook-agent.json"))).toBe(false);
  });

  it("says what to do when the folder holds no index", () => {
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--from", join(root, "built-site")], {
      input: "",
      encoding: "utf8"
    });
    expect(run.status).not.toBe(0);
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

describe("forgebook agents, for a framework", () => {
  it("writes the framework the project lists, and only its words", () => {
    const project = join(root, "on-vue");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "package.json"), '{ "devDependencies": { "@forgebook/vue": "1.0.0" } }\n');
    const run = spawnSync(process.execPath, [ENTRY, "agents", "--skill"], { cwd: project, encoding: "utf8" });
    expect(run.status).toBe(0);
    const text = readFileSync(join(project, "AGENTS.md"), "utf8");
    expect(text).toContain('"@forgebook/vue"');
    expect(text).not.toContain("@forgebook/angular");
    expect(Buffer.byteLength(text)).toBeLessThan(3200);
    const skill = readFileSync(join(project, ".agents", "skills", "forgebook", "SKILL.md"), "utf8");
    expect(skill).toContain('"@forgebook/vue"');
  });

  it("takes the framework it is told, and refuses one it does not know", () => {
    const told = runScriptProcess(ENTRY, ["agents", "--print", "--framework", "svelte"]);
    expect(told.exitCode).toBe(0);
    expect(told.stdout).toContain('"@forgebook/svelte"');
    expect(runScriptProcess(ENTRY, ["agents", "--print", "--framework", "cobol"]).exitCode).toBe(2);
  });
});

describe("forgebook guide", () => {
  it("lists the topics, and prints one, in text and in JSON", () => {
    const list = runScriptProcess(ENTRY, ["guide", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('"topic": "docs-pages"');
    expect(runScriptProcess(ENTRY, ["guide"]).stdout).toContain("docs-pages");
    const topic = runScriptProcess(ENTRY, ["guide", "vue"]);
    expect(topic.exitCode).toBe(0);
    expect(topic.stdout).toContain("Badge.vue");
    expect(runScriptProcess(ENTRY, ["guide", "vue", "--json"]).stdout).toContain('"topic": "vue"');
  });

  it("fails on a topic it does not have", () => {
    expect(runScriptProcess(ENTRY, ["guide", "nope"]).exitCode).not.toBe(0);
  });
});

describe("the README's tools", { timeout: SERVER_TIMEOUT }, () => {
  it("says how many tools a client gets, and names each, as tools/list answers", () => {
    const fixture = join(import.meta.dirname, "..", "..", "..", "fixtures", "app", "forgebook.config.ts");
    const message = (id: number, method: string, params: unknown): string =>
      JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const input = [
      message(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" }
      }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      message(2, "tools/list", {})
    ].join("\n");
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", fixture, "--url", NO_SERVER], {
      input: `${input}\n`,
      encoding: "utf8"
    });
    expect(run.status).toBe(0);
    const names = [...(run.stdout.trim().split("\n")[1] ?? "").matchAll(/"name":"([a-z_]+)"/g)].map(
      (match) => match[1] ?? ""
    );
    expect(names).not.toContain("story_preview");
    const readme = readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8");
    expect(/It offers (\d+) tools/.exec(readme)?.[1]).toBe(String(names.length));
    for (const name of names) expect(readme).toContain(`\`${name}\``);
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
