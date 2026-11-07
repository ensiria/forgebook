/**
 * Tests for where an application draws a single-file component, read from its templates.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractCallSites } from "../src/vite/extractDocs.ts";

/** A small application: a badge, a page that draws it by a relative import and one through an alias. */
const project = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-sfc-call-sites-"));
  mkdirSync(join(dir, "src", "components"), { recursive: true });
  mkdirSync(join(dir, "src", "pages"), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{ "name": "app", "private": true }\n');
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } }, include: ["src"] })
  );
  writeFileSync(
    join(dir, "src", "components", "StatusBadge.vue"),
    '<script setup lang="ts">\ndefineProps<{ label: string; maxLength?: number; tone?: string }>();\n</script>\n<template><b>{{ label }}</b></template>\n'
  );
  writeFileSync(
    join(dir, "src", "pages", "Inbox.vue"),
    [
      '<script setup lang="ts">',
      'import StatusBadge from "../components/StatusBadge.vue";',
      "const unread = 3;",
      "</script>",
      "<template>",
      '  <StatusBadge label="Unread" :max-length="12" :tone="unread > 1 ? \'alert\' : \'info\'" />',
      '  <status-badge label="Read">Read text</status-badge>',
      "</template>",
      ""
    ].join("\n")
  );
  writeFileSync(
    join(dir, "src", "pages", "Archive.vue"),
    '<script setup lang="ts">\nimport StatusBadge from "@/components/StatusBadge.vue";\n</script>\n<template><StatusBadge label="Archived" /></template>\n'
  );
  return dir;
};

describe("extractCallSites", () => {
  it("finds the elements of the files that import it, relative or through paths, with literal props and slot text", () => {
    const dir = project();
    const sites = extractCallSites(join(dir, "src", "components", "StatusBadge.vue"), "default");
    if (typeof sites === "string") throw new Error(sites);
    const byFile = sites.map((site) => [site.file.split("/").pop(), site.args]);
    expect(byFile).toEqual(
      expect.arrayContaining([
        ["Archive.vue", { label: '"Archived"' }],
        ["Inbox.vue", { label: '"Unread"', maxLength: "12" }],
        ["Inbox.vue", { label: '"Read"', "#default": '"Read text"' }]
      ])
    );
    expect(sites).toHaveLength(3);
  });
});
