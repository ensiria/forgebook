/**
 * Tests for where an application draws a React component, read from its program for the values of its first stories.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractCallSites } from "../src/vite/extractDocs.ts";

/** How long building the program may take on a busy runner, in milliseconds. */
const PROGRAM_TIMEOUT = 60_000;

/** A small application: a badge, two pages that draw it, a story and a test that must not count. */
const project = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-call-sites-"));
  mkdirSync(join(dir, "src", "pages"), { recursive: true });
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", strict: true, module: "esnext", moduleResolution: "bundler" },
      include: ["src"]
    })
  );
  writeFileSync(
    join(dir, "src", "Badge.tsx"),
    'export const Badge = (props: { label: string; tone?: "info" | "alert"; count?: number; tags?: string[]; isNew?: boolean }) => <b>{props.label}</b>;\n'
  );
  writeFileSync(
    join(dir, "src", "pages", "Inbox.tsx"),
    [
      'import { Badge } from "../Badge";',
      "export const Inbox = ({ unread }: { unread: number }) => (",
      "  <div>",
      '    <Badge label="Unread" tone="alert" count={unread} tags={["mail", "new"]} isNew />',
      '    <Badge label={"Archived"} count={-1} />',
      "  </div>",
      ");",
      ""
    ].join("\n")
  );
  writeFileSync(
    join(dir, "src", "Tag.tsx"),
    "const TagImpl = (props: { text: string }) => <i>{props.text}</i>;\nexport { TagImpl as Tag };\n"
  );
  writeFileSync(
    join(dir, "src", "pages", "List.tsx"),
    'import { Tag } from "../Tag";\nexport const List = () => <Tag text="Fish &amp; chips" />;\n'
  );
  writeFileSync(
    join(dir, "src", "Badge.stories.tsx"),
    'import { Badge } from "./Badge";\nexport const X = () => <Badge label="story" />;\n'
  );
  writeFileSync(
    join(dir, "src", "Badge.test.tsx"),
    'import { Badge } from "./Badge";\nexport const Y = () => <Badge label="test" />;\n'
  );
  return dir;
};

describe("extractCallSites", () => {
  it(
    "finds each place the application draws the component, with its literal props, and not in stories or tests",
    () => {
      const dir = project();
      const sites = extractCallSites(join(dir, "src", "Badge.tsx"), "Badge");
      if (typeof sites === "string") throw new Error(sites);
      expect(sites.map((site) => site.args)).toEqual([
        { label: '"Unread"', tone: '"alert"', tags: '["mail", "new"]', isNew: "true" },
        { label: '"Archived"', count: "-1" }
      ]);
      expect(sites[0]?.file.endsWith("Inbox.tsx")).toBe(true);
    },
    PROGRAM_TIMEOUT
  );

  it(
    "finds a component exported under another name by either name, and reads character references",
    () => {
      const dir = project();
      for (const name of ["Tag", "TagImpl"]) {
        const sites = extractCallSites(join(dir, "src", "Tag.tsx"), name);
        if (typeof sites === "string") throw new Error(sites);
        expect(sites.map((site) => site.args)).toEqual([{ text: '"Fish & chips"' }]);
      }
    },
    PROGRAM_TIMEOUT
  );

  it(
    "says why when the export is not there",
    () => {
      const dir = project();
      expect(extractCallSites(join(dir, "src", "Badge.tsx"), "Missing")).toContain("exports no Missing");
    },
    PROGRAM_TIMEOUT
  );
});
