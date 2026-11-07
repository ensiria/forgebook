/**
 * Tests that a Next.js catalogue's `forgebook new` reads where the application draws a component, as React's does.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractCallSites } from "../src/vite/extractDocs.ts";

describe("extractCallSites", () => {
  it("finds the literal props an app router page gives a component", () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-next-call-sites-"));
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { jsx: "preserve", strict: true, moduleResolution: "bundler", module: "esnext" },
        include: ["app"]
      })
    );
    writeFileSync(
      join(dir, "app", "Badge.tsx"),
      "export const Badge = (props: { label: string }) => <b>{props.label}</b>;\n"
    );
    writeFileSync(
      join(dir, "app", "page.tsx"),
      'import { Badge } from "./Badge";\nexport default function Page() {\n  return <Badge label="New" />;\n}\n'
    );
    const sites = extractCallSites(join(dir, "app", "Badge.tsx"), "Badge");
    if (typeof sites === "string") throw new Error(sites);
    expect(sites.map((site) => site.args)).toEqual([{ label: '"New"' }]);
  }, 60_000);
});
