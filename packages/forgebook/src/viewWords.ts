/**
 * A view written the short way, as words (`dark it 360`), turned into the address's form (`theme=dark&lang=it&width=360`),
 * for `forgebook check`, `forgebook shot` and their MCP tools.
 *
 * @remarks
 * A word is a value of exactly one of the catalogue's switches, or a number, the story's width. The words are
 * separated by spaces or `+` (a comma would split the option into several views). A view that already holds `=` is the
 * address's form and is kept as it is. A word no switch has, or one two switches share, is refused with what to write
 * instead. Pure.
 *
 * @module
 */
import type { ViewSwitch } from "./switches.ts";

/**
 * A view in the address's form.
 *
 * @param text - the view: the address's form, or words.
 * @param switches - the catalogue's switches.
 * @returns the address's form, or why a word cannot be read.
 */
export const viewQuery = (
  text: string,
  switches: readonly ViewSwitch[]
): { readonly query: string } | { readonly error: string } => {
  if (text.includes("=")) return { query: text };
  const parts: string[] = [];
  for (const word of text.split(/[\s+]+/).filter((each) => each !== "")) {
    if (/^\d+$/.test(word)) {
      parts.push(`width=${word}`);
      continue;
    }
    const owners = switches.filter((each) => each.values.some((value) => value.value === word));
    const [owner] = owners;
    if (owner === undefined) return { error: `No switch has the value "${word}"` };
    if (owners.length > 1)
      return {
        error: `"${word}" is a value of ${owners.map((each) => each.id).join(" and ")}: write ${owner.id}=${word}`
      };
    parts.push(`${owner.id}=${word}`);
  }
  return { query: parts.join("&") };
};
