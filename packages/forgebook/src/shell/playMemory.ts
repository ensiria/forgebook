/**
 * Keeps a reader's play switch for their next visits, on what a browser keeps for a catalogue. Loaded with the parts that
 * show the switch; the shell reads the choice back with its settings (`catalogueContext.ts`).
 *
 * @module
 */
import type { CatalogueSettings, PlaySwitch } from "../catalogue.ts";
import { writeStored } from "./useStored.ts";

/**
 * Keeps a reader's choice.
 *
 * @param catalogue - the catalogue, whose id the choice is kept under.
 * @param play - the choice.
 */
export const rememberPlay = (catalogue: Pick<CatalogueSettings, "id">, play: PlaySwitch): void =>
  writeStored(`${catalogue.id}:play`, play);
