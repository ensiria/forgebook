/**
 * `forgebook new --repair` on a real browser: a component that throws unless it is drawn inside its provider gets its
 * first stories, is drawn, and is drawn again inside the provider its error names, as an agent runs the command.
 *
 * @remarks
 * The catalogue lives under `test-results`, inside the fixture so the project's packages resolve. No test opens the
 * suite's dev server: the command serves the catalogue itself.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: react(), title: "Repair", stories: ["src/*.stories.tsx"] });
`;

const MENU = `import { createContext, type ReactNode, useContext } from "react";

const MenuContext = createContext<string | undefined>(undefined);

/** Gives its items their menu. */
export const MenuProvider = ({ children }: { children?: ReactNode }) => (
  <MenuContext.Provider value="menu">{children}</MenuContext.Provider>
);

/** One item of a menu. */
export const MenuItem = ({ label }: { label: string }) => {
  const menu = useContext(MenuContext);
  if (menu === undefined) throw new Error("useMenu must be used within a MenuProvider.");
  return <button type="button">{label}</button>;
};
`;

/** The parts of the answer this test reads. */
type NewAnswer = {
  readonly file: string;
  readonly repair?: {
    readonly wrappers: readonly string[];
    readonly notFound: readonly string[];
    readonly stories?: number;
    readonly failing?: number;
  };
};

test.describe("forgebook new --repair on a real browser", () => {
  let dir = "";

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "new-repair-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "forgebook.config.ts"), CONFIG);
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
    writeFileSync(join(dir, "src", "Menu.tsx"), MENU);
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("draws the new stories inside the provider their error names", () => {
    test.setTimeout(180_000);
    const run = spawnSync(
      process.execPath,
      [ENTRY, "new", "src/Menu.tsx", "--export", "MenuItem", "--repair", "--json"],
      { cwd: dir, encoding: "utf8", timeout: 170_000 }
    );
    expect(run.status, run.stderr).toBe(0);
    const answer: NewAnswer = JSON.parse(run.stdout);
    expect(answer.repair?.wrappers).toEqual(["MenuProvider"]);
    expect(answer.repair?.failing).toBe(0);
    expect(answer.repair?.stories).toBeGreaterThan(0);
    const text = readFileSync(join(dir, "src", "MenuItem.stories.tsx"), "utf8");
    expect(text).toContain('import { MenuProvider } from "./Menu";');
    expect(text).toContain("decorators: [(Story) => <MenuProvider><Story /></MenuProvider>]");
  });
});
