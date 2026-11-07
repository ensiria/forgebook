/**
 * `forgebook verify` on a real browser: a seeded set of changes on a small React catalogue of its own, with its own
 * repository, as an agent runs the command. None of what is wrong may pass, and the clean change must.
 *
 * @remarks
 * Its repository lives under `test-results`, inside the fixture so the project's packages resolve. Each seed starts from
 * the same commit. No test opens the suite's dev server: the command serves the catalogue itself.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Seeds",
  stories: ["src/*.stories.tsx"],
  tokens: ["tokens.json"]
});
`;

const TOKENS = '{ "color": { "ink": { "$type": "color", "$value": "#1c1b1b" } } }\n';

const BUTTON = `export const Button = () => <button type="button">Save</button>;\n`;

const STORIES = `import { Button } from "./Button";

export default { title: "Actions/Button", component: Button };

export const Plain = {};
`;

/** What makes the seeds' catalogue a library: a package with an entry that exports its button. */
const PUBLISHED = {
  "package.json": JSON.stringify({ name: "seed-kit", exports: "./src/index.ts" }),
  "src/index.ts": `export { Button } from "./Button";\n`
};

/** A seed: a change, and what `verify` must say of it. */
type Seed = {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly verdict: string;
  readonly isGreen: boolean;
  readonly check?: (document: VerifyAnswer) => void;
};

/** The parts of `verify`'s answer these tests read. */
type VerifyAnswer = {
  readonly verdict: string;
  readonly summary: string;
  readonly ran: number;
  readonly failures: readonly {
    readonly problems: readonly { readonly kind: string; readonly rule?: string }[];
  }[];
  readonly code: { readonly problems: readonly { readonly rule: string; readonly fix?: string }[] };
  readonly uiFiles: readonly { readonly coverage: string; readonly fix?: string }[];
  readonly outdated?: readonly { readonly file: string; readonly fix: string }[];
  readonly unseen: readonly {
    readonly component: string;
    readonly reasons: readonly { readonly missing: string; readonly fix: string }[];
  }[];
};

const TAG = "export const Tag = ({ label }: { label: string }) => <span>{label}</span>;\n";

const SEEDS: readonly Seed[] = [
  {
    name: "a raw value with tokens",
    files: {
      "src/Button.tsx": `export const Button = () => <button type="button" style={{ color: "#1c1b1b" }}>Save</button>;\n`
    },
    verdict: "failed",
    isGreen: false,
    check: (document) => {
      expect(document.code.problems[0]).toMatchObject({ rule: "raw-color", fix: "color.ink" });
    }
  },
  {
    name: "a broken state",
    files: {
      "src/Button.tsx": `export const Button = (): never => {\n  throw new Error("broken");\n};\n`
    },
    verdict: "failed",
    isGreen: false,
    check: (document) => {
      expect(document.failures.flatMap((each) => each.problems).map((each) => each.kind)).toContain("frame");
    }
  },
  {
    name: "a storyless new component",
    files: { "src/Badge.tsx": "export const Badge = () => <b>new</b>;\n" },
    verdict: "not-verified",
    isGreen: false,
    check: (document) => {
      expect(document.summary).toContain("1 changed UI file, 0 with stories: not verified");
      expect(document.uiFiles[0]).toMatchObject({ coverage: "none", fix: "npx forgebook new src/Badge.tsx" });
    }
  },
  {
    name: "a contrast failure, through a sheet the component imports",
    files: {
      "src/button.css":
        ":root {\n  --low: #f4f4f4;\n  --paper: #ffffff;\n}\nbutton { color: var(--low); background: var(--paper); }\n",
      "src/Button.tsx": `import "./button.css";\n\n${BUTTON}`
    },
    verdict: "failed",
    isGreen: false,
    check: (document) => {
      expect(document.failures.flatMap((each) => each.problems).map((each) => each.rule)).toContain(
        "color-contrast"
      );
    }
  },
  {
    name: "a prop added to a component whose stories forgebook new wrote",
    files: {
      "src/Tag.tsx":
        'export const Tag = ({ label, tone }: { label: string; tone: "info" | "alert" }) => <span className={tone}>{label}</span>;\n'
    },
    verdict: "failed",
    isGreen: false,
    check: (document) => {
      expect(document.outdated?.map((each) => each.file)).toEqual(["src/Tag.stories.tsx"]);
      expect(document.outdated?.[0]?.fix).toContain("set its forgebook-props line to");
    }
  },
  {
    name: "a markup change to a component whose stories forgebook new wrote, its props the same",
    files: {
      "src/Tag.tsx": "export const Tag = ({ label }: { label: string }) => <strong>{label}</strong>;\n"
    },
    verdict: "verified",
    isGreen: true,
    check: (document) => {
      expect(document.outdated).toBeUndefined();
    }
  },
  {
    name: "a published component whose TSDoc is missing",
    files: {
      ...PUBLISHED,
      "src/Button.tsx": `export const Button = () => <button type="button">Save it</button>;\n`
    },
    verdict: "not-verified",
    isGreen: false,
    check: (document) => {
      expect(document.summary).toContain("1 published component agents cannot see");
      expect(document.unseen[0]?.reasons.map((each) => each.missing)).toEqual(["tsdoc"]);
    }
  },
  {
    name: "a published component only another's stories draw, the case a duplicate comes from",
    files: {
      ...PUBLISHED,
      "src/index.ts": `export { Button } from "./Button";\nexport { Avatar } from "./Avatar";\n`,
      "src/Avatar.tsx": "/** Who is acting. */\nexport const Avatar = () => <i>A</i>;\n",
      "src/Button.tsx": `import { Avatar } from "./Avatar";\n\n/** Saves. */\nexport const Button = () => <button type="button"><Avatar />Save</button>;\n`
    },
    verdict: "not-verified",
    isGreen: false,
    check: (document) => {
      expect(document.unseen).toMatchObject([
        { component: "Avatar", reasons: [{ missing: "story", fix: "npx forgebook new src/Avatar.tsx" }] }
      ]);
    }
  },
  {
    name: "a published component an agent can read",
    files: {
      ...PUBLISHED,
      "src/Button.tsx": `/** Saves what the person wrote. */\nexport const Button = () => <button type="button">Save it</button>;\n`
    },
    verdict: "verified",
    isGreen: true
  },
  {
    name: "a non-UI change",
    files: { "README.md": "# Seeds\n", "src/unused.ts": "export const unused = 1;\n" },
    verdict: "nothing-to-verify",
    isGreen: true
  },
  {
    name: "a clean change",
    files: { "src/Button.tsx": `export const Button = () => <button type="button">Save it</button>;\n` },
    verdict: "verified",
    isGreen: true,
    check: (document) => {
      // the default switches' variants: light, dark, both at more contrast, the structure, a narrow frame
      expect(document.ran).toBeGreaterThan(1);
      expect(document.summary).toContain("verified in every variant");
    }
  }
];

test.describe("forgebook verify on a real browser", () => {
  test.describe.configure({ mode: "serial" });
  let dir = "";

  const git = (...args: readonly string[]): void => {
    const run = spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      { cwd: dir, encoding: "utf8" }
    );
    expect(run.status, run.stderr).toBe(0);
  };

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "verify-seeds-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "forgebook.config.ts"), CONFIG);
    writeFileSync(join(dir, "tokens.json"), TOKENS);
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n.vite/\n");
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true
        },
        include: ["src"]
      })
    );
    writeFileSync(join(dir, "src", "Button.tsx"), BUTTON);
    writeFileSync(join(dir, "src", "Button.stories.tsx"), STORIES);
    writeFileSync(join(dir, "src", "Tag.tsx"), TAG);
    // the stories forgebook new writes, carrying the signature of the props they were written for
    const written = spawnSync(process.execPath, [ENTRY, "new", "src/Tag.tsx"], {
      cwd: dir,
      encoding: "utf8"
    });
    expect(written.status, written.stderr).toBe(0);
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  for (const seed of SEEDS) {
    test(seed.name, () => {
      test.setTimeout(120_000);
      for (const [file, text] of Object.entries(seed.files)) writeFileSync(join(dir, file), text);
      const run = spawnSync(
        process.execPath,
        [ENTRY, "verify", "--since", "HEAD", "--json", "--url", "http://127.0.0.1:9"],
        { cwd: dir, encoding: "utf8", timeout: 110_000 }
      );
      git("checkout", "-q", ".");
      git("clean", "-fdq");
      const document: VerifyAnswer = JSON.parse(run.stdout);
      expect(document.verdict, document.summary).toBe(seed.verdict);
      // the exit code is what a pipeline and an agent read: green only where the seed is
      expect(run.status === 0, run.stderr).toBe(seed.isGreen);
      seed.check?.(document);
    });
  }
});
