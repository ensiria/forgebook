/**
 * Which palette the shell draws in: the reader's choice, the system's, or the story's colour scheme.
 *
 * @remarks
 * Following the story is for a library whose catalogue should feel like one page with it: a dark story in a dark shell.
 * While comparing, several themes share the stage and none is the story's, so the shell stays neutral on the system's.
 * Pure, so the rule is tested apart from the page.
 *
 * @module
 */
import { APPEARANCES, type Appearance } from "../catalogue.ts";
import { switchValueOf, switchWithRole, type ViewSwitch } from "../switches.ts";

/** What decides the shell's palette. */
export type SchemeQuestion = {
  /** The appearance picked. */
  readonly appearance: Appearance;
  /** The view's switches, by id. */
  readonly values: Readonly<Record<string, string>>;
  /** The catalogue's switches. */
  readonly switches: readonly ViewSwitch[];
  /** Whether the system is dark. */
  readonly isSystemDark: boolean;
  /** Whether the stage compares a story across values. */
  readonly isComparing: boolean;
};

/**
 * Whether the shell draws in its dark palette.
 *
 * @param question - what decides it.
 */
export const shellIsDark = ({
  appearance,
  values,
  switches,
  isSystemDark,
  isComparing
}: SchemeQuestion): boolean => {
  if (appearance === "light" || appearance === "dark") return appearance === "dark";
  const scheme = switchWithRole(switches, "colorScheme");
  if (appearance === "system" || isComparing || scheme === undefined) return isSystemDark;
  const shown = switchValueOf(scheme, values[scheme.id] ?? scheme.default)?.scheme;
  return shown === undefined || shown === "system" ? isSystemDark : shown === "dark";
};

/**
 * The appearances a reader is offered: following the story only where a story has a colour scheme to follow.
 *
 * @param switches - the catalogue's switches.
 */
export const offeredAppearances = (switches: readonly ViewSwitch[]): readonly Appearance[] =>
  APPEARANCES.filter((each) => each !== "story" || switchWithRole(switches, "colorScheme") !== undefined);
