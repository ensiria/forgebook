/**
 * Tests of `projectFilesAndScripts`: a project's files and scripts read under one bound.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { projectFilesAndScripts } from "../src/vite/projectFiles.ts";

/**
 * How long the test may take, in milliseconds: writing its five thousand files takes about 6 s on a Windows runner,
 * past the default 5 s, while the read itself is quick.
 */
const WRITE_TIMEOUT = 30_000;

describe("projectFilesAndScripts", () => {
  it(
    "reads the scripts with the room the files leave, and says what it left out",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "forgebook-project-files-"));
      mkdirSync(join(dir, "src"));
      for (let index = 0; index < 4998; index += 1) writeFileSync(join(dir, "src", `C${index}.tsx`), "x");
      for (let index = 0; index < 4; index += 1) writeFileSync(join(dir, "src", `s${index}.ts`), "y");
      writeFileSync(join(dir, "src", "types.d.ts"), "z");
      const notes: string[] = [];
      const { files, scripts } = projectFilesAndScripts(dir, notes);
      expect(files).toHaveLength(4998);
      expect(scripts).toHaveLength(2);
      expect(scripts.every(({ file }) => file.endsWith(".ts") && !file.endsWith(".d.ts"))).toBe(true);
      expect(notes).toEqual(["2 scripts past the first 5000 files not read"]);
    },
    WRITE_TIMEOUT
  );
});
