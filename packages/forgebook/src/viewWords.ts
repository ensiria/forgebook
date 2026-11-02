/**
 * A view written the short way, as words (`dark it 360`), turned into the address's form (`theme=dark&lang=it&width=360`),
 * for `forgebook check`, `forgebook shot` and their MCP tools.
 *
 * @remarks
 * A word is a value of exactly one of the catalogue's switches, a number (the story's width), a device model's id
 * (`iphone-16`: the story in that device's frame) or `portrait` and `landscape` (how it is held). The words are
 * separated by spaces or `+` (a comma would split the option into several views). A view that already holds `=` is the
 * address's form and is kept as it is. A word no switch has, or one two switches share, is refused with what to write
 * instead. Pure.
 *
 * @module
 */
import { isDeviceId, isDeviceOrientation } from "./deviceView.ts";
import type { ViewSwitch } from "./switches.ts";

/**
 * Why a view's words cannot hold together, or none: how a device is held means nothing without a device, and a
 * device sets the width itself.
 *
 * @param parts - the view's parameters, as words made them.
 */
const deviceWordsProblem = (parts: readonly string[]): { readonly error: string } | undefined => {
  const hasDevice = parts.some((part) => part.startsWith("device="));
  if (!hasDevice && parts.some((part) => part.startsWith("orientation=")))
    return {
      error: "portrait and landscape need a device: write a model's id beside them (iphone-16 landscape)"
    };
  if (hasDevice && parts.some((part) => part.startsWith("width=")))
    return { error: "a device sets the width itself: write the model's id or a width, not both" };
  return undefined;
};

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
    // a switch's own value wins: a device's words are Forgebook's, a catalogue's switch may use one
    if (owner === undefined && isDeviceId(word)) {
      parts.push(`device=${word}`);
      continue;
    }
    if (owner === undefined && isDeviceOrientation(word)) {
      parts.push(`orientation=${word}`);
      continue;
    }
    if (owner === undefined) return { error: `No switch has the value "${word}", and no device is named so` };
    if (owners.length > 1)
      return {
        error: `"${word}" is a value of ${owners.map((each) => each.id).join(" and ")}: write ${owner.id}=${word}`
      };
    parts.push(`${owner.id}=${word}`);
  }
  return deviceWordsProblem(parts) ?? { query: parts.join("&") };
};
