/**
 * The catalogue's switches, as the shell's components read them: computed once from the configuration
 * (`catalogueSwitches`), so the toolbar, the stage, the compare view and the pages agree.
 *
 * @module
 */
import { createContext, useContext } from "react";

import { DEFAULT_SWITCHES, type ViewSwitch } from "../switches";

/** The catalogue's switches; the theme and the contrast until the shell provides its own. */
export const SwitchesContext = createContext<readonly ViewSwitch[]>(DEFAULT_SWITCHES);

/** The catalogue's switches. */
export const useSwitches = (): readonly ViewSwitch[] => useContext(SwitchesContext);
