/**
 * Tests for `forgebook init` with no option, as a person or an agent runs it: a process in a new project's folder, one
 * project per framework, the loop to a listed story on React and Vue.
 *
 * @module
 */
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { STORYBOOK_DIR } from "./fixturePaths.ts";
import { NEW_PROJECTS, type ProjectFiles } from "./fixtures/newProjects.ts";

/** The command's entry. */
const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");

/** The repository's fixtures, whose installed packages the loop's projects borrow. */
const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures");

/** How long a test may take that starts a server of its own, on a slow runner, in milliseconds. */
const SERVER_TIMEOUT = 120_000;

const root = mkdtempSync(join(tmpdir(), "forgebook-new-project-"));
let projects = 0;

afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A new project's folder holding the files. */
const projectWith = (files: ProjectFiles): string => {
  projects += 1;
  const dir = join(root, `project-${projects}`);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
};

/** Runs the command in a folder. */
const forgebook = (
  dir: string,
  args: readonly string[],
  // biome-ignore lint/style/noProcessEnv: the child takes this process's environment
  env: NodeJS.ProcessEnv = process.env
): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [ENTRY, ...args], { cwd: dir, encoding: "utf8", env });

/** Runs `init --json`, and reads its document. */
const initJson = (
  dir: string,
  ...extra: readonly string[]
): { readonly status: number | null; readonly document: Record<string, unknown> } => {
  const run = forgebook(dir, ["init", "--json", ...extra]);
  return { status: run.status, document: JSON.parse(run.stdout) };
};

/** A document's next steps' kinds. */
const stepKinds = (document: Record<string, unknown>): readonly unknown[] =>
  Array.isArray(document["nextSteps"]) ? document["nextSteps"].map((step) => step.kind) : [];

describe("forgebook init in a new project", () => {
  it.each([
    ["react", "react()", "src/**/*.stories.tsx", "forgebook.preview.tsx", "./src/index.css"],
    ["vue", "vue()", "src/**/*.stories.ts", "forgebook.preview.ts", "./src/index.css"],
    ["svelte", "svelte()", "src/**/*.stories.ts", "forgebook.preview.ts", "./src/index.css"],
    ["solid", "solid()", "src/**/*.stories.tsx", "forgebook.preview.tsx", "./src/index.css"],
    ["preact", "preact()", "src/**/*.stories.tsx", "forgebook.preview.tsx", "./src/index.css"],
    ["web-components", "webComponents()", "src/**/*.stories.ts", "forgebook.preview.ts", "./src/index.css"],
    ["angular", "angular()", "src/**/*.stories.ts", "forgebook.preview.ts", "./src/styles.css"],
    ["nextjs", "nextjs()", "app/**/*.stories.tsx", "forgebook.preview.tsx", "./app/globals.css"],
    ["sveltekit", "sveltekit()", "src/**/*.stories.ts", "forgebook.preview.ts", "./src/app.css"]
  ])(
    "writes %s's configuration and a preview with its global style sheet",
    (name, call, glob, preview, sheet) => {
      const dir = projectWith(NEW_PROJECTS[name] ?? {});
      const { status, document } = initJson(dir);
      expect(status).toBe(0);
      expect(document["route"]).toBe("new-project");
      expect(document["framework"]).toBe(name);
      expect(document["written"]).toEqual(["forgebook.config.ts", preview]);
      const config = readFileSync(join(dir, "forgebook.config.ts"), "utf8");
      expect(config).toContain(`framework: ${call},`);
      expect(config).toContain(`"${glob}"`);
      expect(readFileSync(join(dir, preview), "utf8")).toContain(`import "${sheet}";`);
    },
    30_000
  );

  it("reads Nuxt's style sheets through its adapter, so it writes no preview", () => {
    const dir = projectWith(NEW_PROJECTS["nuxt"] ?? {});
    const { document } = initJson(dir);
    expect(document["framework"]).toBe("nuxt");
    expect(document["written"]).toEqual(["forgebook.config.ts"]);
    expect(document["stories"]).toEqual(["app/**/*.stories.ts", "components/**/*.stories.ts"]);
    expect(stepKinds(document)).toContain("provider");
  }, 30_000);

  it("gives React Native's adapter what the project's packages ask for, and names what it does not read", () => {
    const dir = projectWith(NEW_PROJECTS["react-native-web"] ?? {});
    const { document } = initJson(dir);
    expect(document["framework"]).toBe("react-native-web");
    const config = readFileSync(join(dir, "forgebook.config.ts"), "utf8");
    expect(config).toContain('jsxImportSource: "nativewind"');
    expect(config).toContain('"react-native-worklets/plugin"');
    expect(JSON.stringify(document["install"])).toContain("@rolldown/plugin-babel");
    expect(stepKinds(document)).toContain("setup");
    expect(readFileSync(join(dir, "forgebook.preview.tsx"), "utf8")).toContain('import "./global.css";');
  }, 30_000);

  it("names what it cannot work out as next steps", () => {
    const dir = projectWith({
      ...NEW_PROJECTS["react"],
      "index.html":
        '<html><head><link rel="stylesheet" href="https://fonts.example/inter.css"></head><body><div id="root"></div><div id="modal-root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      "src/main.tsx":
        'import "./index.css";\nimport "~/theme.css";\ncreateRoot(document.getElementById("root")).render(<StrictMode><QueryProvider><App /></QueryProvider></StrictMode>);\n',
      "vite.config.ts":
        'import tailwindcss from "@tailwindcss/vite";\nimport react from "@vitejs/plugin-react";\nexport default { plugins: [react(), tailwindcss()], resolve: { alias: { "@": "/src" } } };\n',
      "tsconfig.json":
        '{\n  // a comment, as Vite\'s template has\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}\n',
      "postcss.config.js": "export default {};\n"
    });
    const { document } = initJson(dir);
    expect(stepKinds(document)).toEqual([
      "style-sheet",
      "provider",
      "portal",
      "head",
      "vite-plugin",
      "alias",
      "alias",
      "postcss"
    ]);
    const text = JSON.stringify(document["nextSteps"]);
    for (const name of [
      "~/theme.css",
      "QueryProvider",
      "#modal-root",
      "fonts.example",
      "@tailwindcss/vite",
      "@/*"
    ])
      expect(text).toContain(name);
    expect(text).not.toContain("StrictMode");
    expect(text).not.toContain("@vitejs/plugin-react");
  }, 30_000);

  it("says the exact install command of the project's package manager", () => {
    const pnpm = projectWith({ ...NEW_PROJECTS["vue"], "pnpm-lock.yaml": "" });
    const { document } = initJson(pnpm);
    expect(document["packageManager"]).toEqual({ name: "pnpm", detectedFrom: "pnpm-lock.yaml" });
    expect(document["install"]).toEqual({
      missing: ["forgebook", "@forgebook/vue"],
      command: "pnpm add --save-dev forgebook @forgebook/vue",
      status: "to-run"
    });
    expect(document["replaced"]).toEqual([]);
    expect(JSON.stringify(document["commands"])).toContain("pnpm exec forgebook new <component file>");
    expect(JSON.stringify(document["commands"])).toContain('"placeholder":"<component file>"');
    const person = forgebook(projectWith(NEW_PROJECTS["vue"] ?? {}), ["init"]);
    expect(person.status).toBe(0);
    expect(person.stdout).toContain("npm install --save-dev forgebook @forgebook/vue");
    expect(person.stdout).toContain("npx forgebook dev");
  }, 30_000);

  it.skipIf(process.platform === "win32")(
    "runs the install with --install, its lines kept off stdout, and fails when it fails",
    () => {
      const dir = projectWith(NEW_PROJECTS["vue"] ?? {});
      const bin = join(dir, "fake-bin");
      mkdirSync(bin);
      const fake = join(bin, "npm");
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the shell's own default, in a shell script
      writeFileSync(fake, '#!/bin/sh\necho "installing $*"\nexit ${FAKE_EXIT:-0}\n');
      chmodSync(fake, 0o755);
      // biome-ignore lint/style/noProcessEnv: the child takes this process's environment, its PATH finding the fake first
      const inherited = process.env;
      const env = { ...inherited, PATH: `${bin}${delimiter}${inherited["PATH"] ?? ""}` };
      const ran = forgebook(dir, ["init", "--json", "--install"], env);
      expect(ran.status).toBe(0);
      expect(ran.stderr).toContain("installing install --save-dev forgebook @forgebook/vue");
      expect(JSON.parse(ran.stdout).install.status).toBe("ran");
      expect(JSON.parse(ran.stdout).commands[0].command).toBe("npx forgebook new <component file>");
      const failed = forgebook(dir, ["init", "--json", "--install", "--force"], { ...env, FAKE_EXIT: "3" });
      expect(failed.status).toBe(1);
      const failure = JSON.parse(failed.stdout);
      expect(failure.install.status).toBe("failed");
      expect(failure.install.error).toContain("exited with code 3");
      expect(failure.replaced).toEqual(["forgebook.config.ts", "forgebook.preview.ts"]);
    },
    30_000
  );

  it("stops on an unknown framework with the supported list, having written nothing", () => {
    const dir = projectWith({
      "package.json": '{ "name": "tool", "dependencies": { "lodash": "^4.0.0" } }\n'
    });
    const person = forgebook(dir, ["init"]);
    expect(person.status).toBe(1);
    expect(person.stderr).toContain("names no framework Forgebook supports");
    expect(person.stderr).toContain("react, vue, svelte, solid, preact, web-components, angular, nextjs");
    const { status, document } = initJson(dir);
    expect(status).toBe(1);
    expect(document["refused"]).toBe("unknown-framework");
    expect(document["supported"]).toContain("react-native-web");
    expect(existsSync(join(dir, "forgebook.config.ts"))).toBe(false);
    const chosen = initJson(dir, "--framework", "html");
    expect(chosen.status).toBe(0);
    expect(readFileSync(join(dir, "forgebook.config.ts"), "utf8")).toContain("framework: html(),");
    expect(forgebook(dir, ["init", "--framework", "cobol"]).status).toBe(2);
  }, 30_000);

  it("stops where it cannot tell, and goes on once an adapter says", () => {
    const manifest = (extra: Readonly<Record<string, string>>): string =>
      JSON.stringify({ name: "both", dependencies: { react: "^19.0.0", lit: "^3.2.0", ...extra } });
    const dir = projectWith({ "package.json": manifest({}) });
    const asked = initJson(dir);
    expect(asked.status).toBe(1);
    expect(asked.document["refused"]).toBe("ambiguous-framework");
    expect(asked.document["concerned"]).toEqual(["react", "web-components"]);
    const told = projectWith({ "package.json": manifest({ "@forgebook/web-components": "^0.2.0" }) });
    expect(initJson(told).document["framework"]).toBe("web-components");
  }, 30_000);

  it("takes a project on an older React or Vite, whose own stay as they are", () => {
    const dir = projectWith({
      "package.json": JSON.stringify({ name: "older", dependencies: { react: "^18.3.0", vite: "^5.0.0" } })
    });
    const { status, document } = initJson(dir);
    expect(status).toBe(0);
    expect(JSON.stringify(document["install"])).toContain('"forgebook","@forgebook/react"');
  }, 30_000);

  it("stops on a version Forgebook cannot draw with, and on no package.json", () => {
    const dir = projectWith({
      "package.json": JSON.stringify({ name: "old", dependencies: { react: "^17.0.0" } })
    });
    const { status, document } = initJson(dir);
    expect(status).toBe(1);
    expect(document["refused"]).toBe("versions");
    expect(document["concerned"]).toEqual(["react"]);
    expect(existsSync(join(dir, "forgebook.config.ts"))).toBe(false);
    const empty = projectWith({ "note.txt": "" });
    expect(initJson(empty).document["refused"]).toBe("no-package");
    const broken = projectWith({ "package.json": "{" });
    expect(initJson(broken).document["refused"]).toBe("unreadable-package");
  }, 30_000);

  it("refuses to replace a configuration or a preview, and replaces both when asked", () => {
    const dir = projectWith({ ...NEW_PROJECTS["react"], "forgebook.preview.ts": "// a person's work\n" });
    const clash = initJson(dir);
    expect(clash.status).toBe(1);
    expect(clash.document["concerned"]).toEqual(["forgebook.preview.ts"]);
    expect(existsSync(join(dir, "forgebook.config.ts"))).toBe(false);
    const forced = initJson(dir, "--force");
    expect(forced.status).toBe(0);
    // the name the catalogue reads first is kept, so the new preview is the one read
    expect(forced.document["written"]).toEqual(["forgebook.config.ts", "forgebook.preview.ts"]);
    expect(forced.document["replaced"]).toEqual(["forgebook.preview.ts"]);
    expect(readFileSync(join(dir, "forgebook.preview.ts"), "utf8")).toContain("./src/index.css");
    const again = initJson(dir);
    expect(again.document["concerned"]).toEqual(["forgebook.config.ts"]);
  }, 30_000);

  it("names Storybook's route where it is there, and runs none of its code unasked", () => {
    const dir = projectWith({
      "package.json": '{ "name": "on-storybook", "type": "module" }\n',
      ".storybook/main.mjs":
        'import { writeFileSync } from "node:fs";\nwriteFileSync("ran.txt", "");\nexport default { framework: "@storybook/react-vite", stories: ["../src/*.stories.tsx"] };\n'
    });
    const person = forgebook(dir, ["init"]);
    expect(person.status).toBe(1);
    expect(person.stderr).toContain("--from storybook");
    const { document } = initJson(dir);
    expect(document["refused"]).toBe("storybook-found");
    expect(existsSync(join(dir, "ran.txt"))).toBe(false);
    expect(existsSync(join(dir, "forgebook.config.ts"))).toBe(false);
    expect(forgebook(dir, ["init", "--from", "storybook", "--framework", "react"]).status).toBe(2);
    const asked = projectWith({ "package.json": '{ "name": "asked", "type": "module" }\n' });
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(asked, ".storybook"), { recursive: true });
    expect(initJson(asked, "--from", "storybook").document["route"]).toBe("storybook");
    const fresh = projectWith({ ...NEW_PROJECTS["react"] });
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(fresh, ".storybook"), { recursive: true });
    expect(initJson(fresh, "--framework", "react").document["route"]).toBe("new-project");
  }, 60_000);

  it.skipIf(process.platform === "win32")(
    "never writes through a link, even with --force",
    () => {
      const dir = projectWith(NEW_PROJECTS["react"] ?? {});
      const outside = join(root, `outside-${projects}.txt`);
      symlinkSync(outside, join(dir, "forgebook.config.ts"));
      for (const extra of [[], ["--force"]]) {
        const { status, document } = initJson(dir, ...extra);
        expect(status).toBe(1);
        expect(document["refused"]).toBe("symlink");
      }
      expect(existsSync(outside)).toBe(false);
    },
    30_000
  );

  it("writes into a preview only what is a style sheet of the project or of a package it has", () => {
    const outside = join(root, `outside-${projects}`);
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "secret.css"), "");
    const dir = projectWith({
      ...NEW_PROJECTS["react"],
      "index.html": [
        "<html><head>",
        '<link rel="stylesheet" href="../outside/secret.css">',
        '<link rel="stylesheet" href="/payload.js">',
        '<link rel="stylesheet" href="css/app.css">',
        '<link rel="stylesheet" href="%BASE_URL%theme.css">',
        '<!-- <link rel="stylesheet" href="old/legacy.css"> -->',
        '</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'
      ].join("\n"),
      "payload.js": "",
      "css/app.css": "",
      "src/main.tsx": [
        "/*",
        'import "./commented.css";',
        "*/",
        'import "./index.css";',
        'import "https://evil.example/x.css";',
        'import "not-installed/x.css";',
        'import "evil/../../x.css";',
        ""
      ].join("\n")
    });
    initJson(dir);
    const imports = readFileSync(join(dir, "forgebook.preview.tsx"), "utf8").match(/^import .*$/gm);
    expect(imports).toEqual(['import "./css/app.css";', 'import "./src/index.css";']);
  }, 30_000);

  it("takes a project's text into a report as data: no control characters, bounded", () => {
    const dir = projectWith({
      ...NEW_PROJECTS["react"],
      "vite.config.ts": `import x from "evil\u001b[2Kplugin";\nimport y from "${"long-".repeat(400)}";\n`
    });
    const { document } = initJson(dir);
    const text = JSON.stringify(document["nextSteps"]);
    expect(text).not.toContain("\\u001b");
    expect(text.length).toBeLessThan(1500);
  }, 30_000);

  it.each([
    ["react", "app", "src/Badge.tsx", "src/Badge.stories.tsx"],
    ["vue", "vue", "src/Badge.vue", "src/Badge.stories.ts"]
  ])(
    "takes a new %s project to a listed story: init, new, stories --json",
    (name, installedIn, component, written) => {
      const dir = projectWith(NEW_PROJECTS[name] ?? {});
      symlinkSync(join(FIXTURES, installedIn, "node_modules"), join(dir, "node_modules"), "junction");
      const init = forgebook(dir, ["init"]);
      expect(init.status).toBe(0);
      const made = forgebook(dir, ["new", component]);
      expect(made.status).toBe(0);
      expect(existsSync(join(dir, written))).toBe(true);
      const listed = forgebook(dir, ["stories", "--json"]);
      expect(listed.status).toBe(0);
      const { components, problems } = JSON.parse(listed.stdout);
      expect(problems).toEqual([]);
      expect(components[0].id).toBe("stories:badge");
      expect(components[0].stories.length).toBeGreaterThan(0);
    },
    SERVER_TIMEOUT
  );
});
