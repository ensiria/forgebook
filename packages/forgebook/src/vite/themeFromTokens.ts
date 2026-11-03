/**
 * A shell's theme from a library's design tokens: a few lines of mapping instead of a palette written twice.
 *
 * @remarks
 * Read once, when the configuration is, since the theme is written into the page at build. A role takes the token's value
 * in each appearance, the themes named `light` and `dark` first: a token with no such theme holds in both, as DTCG means,
 * and the contrast checks say when that does not work. What cannot be used is reported, never a build's failure: the
 * shell keeps its own colour for that role.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";

import type { ShellPalette, ShellTheme } from "../shellTheme.types.ts";
import { type DesignToken, readTokens, type TokensInput } from "./designTokens.ts";

/** A tokens file, as the configuration resolves it. */
type TokensFileRef = {
  /** Its absolute path. */
  readonly path: string;
  /** The theme it belongs to; none for the base. */
  readonly mode: string | undefined;
};

/** The roles and their token names. */
type TokenMapping = Partial<ShellPalette>;

/** A theme read from tokens, with what could not be used. */
export type TokenTheme = {
  /** The colours. */
  readonly theme: ShellTheme;
  /** What will not work, for a warning. */
  readonly problems: readonly string[];
};

/** A token's colour in an appearance; none when only other themes define it. */
const colorIn = (token: DesignToken, appearance: "light" | "dark"): string | undefined =>
  token.modes[appearance] ?? (token.isThemeOnly === true ? undefined : token.value);

/**
 * The theme a mapping gives.
 *
 * @param mapping - the token's name for each role.
 * @param tokens - the tokens.
 * @returns the colours of each appearance, and what could not be used.
 */
export const tokenTheme = (mapping: TokenMapping, tokens: readonly DesignToken[]): TokenTheme => {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const problems: string[] = [];
  for (const [role, name] of Object.entries(mapping)) {
    const token = tokens.find((each) => each.name === name);
    if (token === undefined) {
      problems.push(`shell.theme.fromTokens: ${role} names "${name}", which is not a token`);
    } else if (token.type !== "color") {
      problems.push(`shell.theme.fromTokens: ${role} names "${name}", a ${token.type}, not a color`);
    } else {
      const inLight = colorIn(token, "light");
      const inDark = colorIn(token, "dark");
      if (inLight !== undefined) light[role] = inLight;
      if (inDark !== undefined) dark[role] = inDark;
    }
  }
  return { theme: { light, dark }, problems };
};

/**
 * Reads a catalogue's tokens files and the theme a mapping gives; no mapping reads nothing.
 *
 * @param mapping - the token's name for each role.
 * @param files - the tokens files.
 * @param dir - the configuration's folder, which problems name files from.
 */
export const tokenThemeOf = (
  mapping: TokenMapping,
  files: readonly TokensFileRef[],
  dir: string
): TokenTheme => {
  if (Object.keys(mapping).length === 0) return { theme: {}, problems: [] };
  if (files.length === 0) {
    return { theme: {}, problems: ["shell.theme.fromTokens: the configuration names no tokens file"] };
  }
  const unread: string[] = [];
  const inputs = files.flatMap(({ path, mode }): TokensInput[] => {
    try {
      return [{ label: relative(dir, path), mode, file: JSON.parse(readFileSync(path, "utf8")) }];
    } catch (error) {
      unread.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });
  const { tokens, problems } = readTokens(inputs);
  const { theme, problems: mapped } = tokenTheme(mapping, tokens);
  return { theme, problems: [...unread, ...problems, ...mapped] };
};
