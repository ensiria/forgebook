/**
 * The catalogue's settings, as the shell's components read them: its switches and its lists (`catalogue.ts`),
 * computed once from the configuration, so the toolbar, the stage, the compare view and the pages agree.
 *
 * @module
 */
import { createContext, useContext } from "react";

import { type CatalogueSettings, catalogueSettings } from "../catalogue";
import { DEFAULT_SWITCHES } from "../switches";

/** The catalogue's settings; the defaults until the shell provides its own. */
export const CatalogueContext = createContext<CatalogueSettings>(catalogueSettings("", DEFAULT_SWITCHES));

/** The catalogue's settings. */
export const useCatalogue = (): CatalogueSettings => useContext(CatalogueContext);
