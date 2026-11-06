/**
 * Tests for Forgebook's section of a project's `AGENTS.md`: written into a new file, added after the project's own
 * text, replaced in place when it runs again; and the same text as a Claude Code skill.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { agentsSection, guideTopic } from "../bin/forgebook/agentGuide.ts";
import {
  AGENTS_END,
  AGENTS_START,
  agentsSkill,
  SKILL_FOLDERS,
  withAgentsSection
} from "../bin/forgebook/agentsText.ts";
import { DEVICE_IDS } from "../src/deviceView.ts";

describe("withAgentsSection", () => {
  it("writes the section alone into a file that does not exist yet", () => {
    expect(withAgentsSection(undefined, "## Stories\n")).toBe(`${AGENTS_START}\n## Stories\n${AGENTS_END}\n`);
  });

  it("adds it after the project's own text, which stays as it was", () => {
    expect(withAgentsSection("# Ours\n\nKeep this.\n", "## Stories")).toBe(
      `# Ours\n\nKeep this.\n\n${AGENTS_START}\n## Stories\n${AGENTS_END}\n`
    );
  });

  it("replaces its own section in place, the text around it untouched", () => {
    const once = withAgentsSection("# Ours\n", "## Old");
    const again = withAgentsSection(`${once}\n## After\n`, "## New");
    expect(again).toBe(`# Ours\n\n${AGENTS_START}\n## New\n${AGENTS_END}\n\n## After\n`);
    expect(again.split(AGENTS_START)).toHaveLength(2);
  });
});

describe("agentsSkill", () => {
  it("gives the text a skill's name and when to use it", () => {
    const skill = agentsSkill("## Stories\n");
    expect(skill.startsWith("---\nname: forgebook\ndescription: ")).toBe(true);
    expect(skill.endsWith("---\n\n## Stories\n")).toBe(true);
  });

  it("meets the Agent Skills standard, on the real text", () => {
    const skill = agentsSkill(agentsSection(["react"]));
    const [, frontmatter = ""] = /^---\n(.*?)\n---\n/s.exec(skill) ?? [];
    const fields = new Map(
      frontmatter.split("\n").map((line) => {
        const colon = line.indexOf(": ");
        return [line.slice(0, colon), line.slice(colon + 2)] as const;
      })
    );
    const name = fields.get("name") ?? "";
    const description = fields.get("description") ?? "";
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(name.length).toBeLessThanOrEqual(64);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(skill.split("\n").length).toBeLessThan(500);
    for (const folder of SKILL_FOLDERS) expect(folder.split("/").at(-1)).toBe(name);
  });
});

describe("SKILL_FOLDERS", () => {
  it("writes where every agent of the standard looks, and where Claude Code does", () => {
    expect(SKILL_FOLDERS).toEqual([".agents/skills/forgebook", ".claude/skills/forgebook"]);
  });
});

describe("the agents' guide on devices", () => {
  it("names every device model, so an agent can write any of them", () => {
    const guide = guideTopic("devices")?.text;
    for (const id of DEVICE_IDS) expect(guide).toContain(`\`${id}\``);
  });
});
