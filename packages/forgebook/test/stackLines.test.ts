/**
 * Tests for a story error's stack mapped to the lines of the files as written, on code Vite's own transform wrote.
 *
 * @module
 */
import { transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import { MAX_STACK_LENGTH, mappedStack, type ServedModule } from "../src/vite/stackLines.ts";

/** The project's folder. */
const ROOT = "/project";

/** The story file, as written: its throw on line 7, column 32. */
const FILE = `${ROOT}/src/Throws.stories.tsx`;

/** The story file's text: types and JSX that the transform takes out or rewrites, so its lines move. */
const SOURCE = [
  'import type { ReactNode } from "react";',
  "",
  "type Props = { readonly label: string };",
  "const Label = ({ label }: Props): ReactNode => <span>{label}</span>;",
  "",
  "export const Boom = (): ReactNode => {",
  '  if (Label.length >= 0) throw new Error("boom");',
  '  return <Label label="never" />;',
  "};",
  ""
].join("\n");

/** The address the frame loaded the story file from. */
const URL_OF_FILE = "http://localhost:6007/@fs/project/src/Throws.stories.tsx?t=1";

/** The story file as the dev server serves it, transformed by Vite's own transform, and its map. */
const served = async (): Promise<{ readonly code: string; readonly module: ServedModule }> => {
  const result = await transformWithOxc(SOURCE, FILE, {
    lang: "tsx",
    sourcemap: true,
    jsx: { runtime: "classic" }
  });
  const { map } = result;
  if (map?.mappings === undefined) throw new Error("The transform wrote no map");
  return {
    code: result.code,
    module: {
      file: FILE,
      map: {
        version: map.version ?? 3,
        sources: map.sources ?? [],
        names: map.names ?? [],
        mappings: map.mappings
      }
    }
  };
};

/**
 * The browser's place of the throw in the served code, from 1.
 *
 * @param code - the served code.
 */
const thrownAt = (code: string): { readonly line: number; readonly column: number } => {
  const lines = code.split("\n");
  const index = lines.findIndex((line) => line.includes("throw new Error"));
  return { line: index + 1, column: (lines[index] ?? "").indexOf("new Error") + 1 };
};

describe("mappedStack", () => {
  it("writes each place of a served module in the lines of its file, and names the first as the place", async () => {
    const { code, module } = await served();
    const at = thrownAt(code);
    // the transform moved the line, or this test proves nothing
    expect(at.line).not.toBe(7);
    const stack = [
      "Error: boom",
      `    at Boom (${URL_OF_FILE}:${at.line}:${at.column})`,
      "    at renderWithHooks (http://localhost:6007/node_modules/.vite/deps/react-dom.js?v=1:120:20)"
    ].join("\n");
    const lookup = async (url: string): Promise<ServedModule | undefined> =>
      url === URL_OF_FILE ? module : undefined;
    const result = await mappedStack(stack, lookup, ROOT);
    expect(result.place).toBe("src/Throws.stories.tsx:7:32");
    expect(result.stack).toBe(
      [
        "Error: boom",
        `    at Boom (${URL_OF_FILE}:7:32)`,
        "    at renderWithHooks (http://localhost:6007/node_modules/.vite/deps/react-dom.js?v=1:120:20)"
      ].join("\n")
    );
  });

  it("reads Firefox's and Safari's form", async () => {
    const { code, module } = await served();
    const at = thrownAt(code);
    const result = await mappedStack(
      `Boom@${URL_OF_FILE}:${at.line}:${at.column}\n`,
      async () => module,
      ROOT
    );
    expect(result.stack).toBe(`Boom@${URL_OF_FILE}:7:32\n`);
  });

  it("leaves a place whose map leads to another file, as a prebundled dependency's does", async () => {
    const { code, module } = await served();
    const at = thrownAt(code);
    const elsewhere: ServedModule = { ...module, file: `${ROOT}/node_modules/.vite/deps/other.js` };
    const stack = `    at Boom (${URL_OF_FILE}:${at.line}:${at.column})`;
    expect(await mappedStack(stack, async () => elsewhere, ROOT)).toEqual({ stack });
  });

  it("leaves a stack with nothing served, and one too long to read", async () => {
    const stack = "Error: boom\n    at Boom (http://localhost:6007/src/Gone.tsx:3:1)";
    expect(await mappedStack(stack, async () => undefined, ROOT)).toEqual({ stack });
    const long = `Error: boom\n${"    at x (http://localhost:6007/a.js:1:1)\n".repeat(MAX_STACK_LENGTH / 10)}`;
    let asked = 0;
    const counted = async (): Promise<undefined> => {
      asked += 1;
      return undefined;
    };
    expect(await mappedStack(long, counted, ROOT)).toEqual({ stack: long });
    expect(asked).toBe(0);
  });
});
