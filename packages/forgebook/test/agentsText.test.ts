/**
 * Tests for Forgebook's section of a project's `AGENTS.md`: written into a new file, added after the project's own
 * text, replaced in place when it runs again; and the same text as a Claude Code skill.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { AGENTS_END, AGENTS_START, agentsSkill, withAgentsSection } from "../bin/forgebook/agentsText.ts";

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
});
