/**
 * The shell's own appearance: light, dark, the system's or the story's, a reader's choice kept in their browser, the catalogue's
 * default before they pick one; written on the page's root, where the palettes of `shell.scss` read it.
 *
 * @remarks
 * Only the reader's own choice is stored: a reader who never picked follows the catalogue's default even after the
 * catalogue changes it. The frames are not touched: a story's look is the view's switches'.
 *
 * @module
 */
import { useEffect } from "react";

import { APPEARANCES, type Appearance } from "../catalogue.ts";
import type { ViewSwitch } from "../switches.ts";
import { isComparing, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { offeredAppearances, shellIsDark } from "./shellScheme.ts";
import { useStored } from "./useStored.ts";
import { useSystemDark } from "./useSystemDark.ts";

/** The root's attribute the palettes read: `light` or `dark`, the system's resolved. */
export const APPEARANCE_ATTRIBUTE = "data-forgebook-appearance";

/** The appearance a stored text holds; none when the reader never picked one. */
const storedAppearance = (stored: string | null): Appearance | undefined =>
  APPEARANCES.find((appearance) => appearance === stored);

/** The shell's appearance and its setter. */
export type AppearanceState = {
  /** The appearance shown: the reader's, or the catalogue's default. */
  readonly appearance: Appearance;
  /** Picks an appearance, kept for the next visit. */
  readonly setAppearance: (appearance: Appearance) => void;
  /** The appearances this catalogue offers. */
  readonly offered: readonly Appearance[];
};

/**
 * The shell's appearance, applied to the page's root.
 *
 * @param view - the view, whose colour scheme the shell can follow.
 * @param switches - the catalogue's switches.
 * @returns the appearance shown and its setter.
 */
export const useAppearance = (view: ViewState, switches: readonly ViewSwitch[]): AppearanceState => {
  const catalogue = useCatalogue();
  const [chosen, setChosen] = useStored("appearance", storedAppearance, (value) => value ?? "");
  const appearance = chosen ?? catalogue.appearance;
  const isSystemDark = useSystemDark();
  const isDark = shellIsDark({
    appearance,
    values: view.switches,
    switches,
    isSystemDark,
    isComparing: isComparing(view)
  });
  useEffect(() => {
    document.documentElement.setAttribute(APPEARANCE_ATTRIBUTE, isDark ? "dark" : "light");
  }, [isDark]);
  return { appearance, setAppearance: setChosen, offered: offeredAppearances(switches) };
};
