/**
 * The instructions `forgebook agents` gives a project's coding agents: Forgebook's section of the project's
 * `AGENTS.md`, and the same text as an Agent Skill, in the folder the standard names and in Claude Code's.
 *
 * @remarks
 * The section sits between two markers, so running the command again replaces its own text and leaves the rest of the
 * file as the project wrote it. `AGENTS.md` is the file Codex reads and Claude Code reads when the project has no
 * `CLAUDE.md` (one that has can import it with `@AGENTS.md`). Pure: texts in, text out.
 *
 * @module
 */

/** The line before Forgebook's section. */
export const AGENTS_START =
  "<!-- forgebook:start: written by `forgebook agents`, replaced when it runs again -->";

/** The line after it. */
export const AGENTS_END = "<!-- forgebook:end -->";

/**
 * A file's text with Forgebook's section in it: put in place of the one already there, else added at the end.
 *
 * @param existing - the file's text, or none when there is no file yet.
 * @param section - the instructions.
 */
export const withAgentsSection = (existing: string | undefined, section: string): string => {
  const block = `${AGENTS_START}\n${section.trim()}\n${AGENTS_END}\n`;
  if (existing === undefined || existing.trim() === "") return block;
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END, start);
  if (start !== -1 && end !== -1) {
    const after = existing.slice(end + AGENTS_END.length).replace(/^\n/, "");
    return `${existing.slice(0, start)}${block}${after}`;
  }
  return `${existing.replace(/\n*$/, "")}\n\n${block}`;
};

/**
 * Where the skill is written, from the project's root: `.agents/skills` is the Agent Skills standard's folder, which
 * Codex and others read; Claude Code reads its own. A skill's folder is named after it, as the standard requires.
 */
export const SKILL_FOLDERS = [".agents/skills/forgebook", ".claude/skills/forgebook"] as const;

/**
 * The instructions as an Agent Skill: its name and when to use it, then the text.
 *
 * @param section - the instructions.
 */
export const agentsSkill = (section: string): string =>
  [
    "---",
    "name: forgebook",
    "description: Write, check and look at this project's component stories with Forgebook (CSF 3). Use when adding or changing a component, or its stories.",
    "---",
    "",
    section.trim(),
    ""
  ].join("\n");
