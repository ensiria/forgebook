/**
 * What shows the sheets of a frame's switch values, loaded only by a catalogue that has any: the frame's code for them
 * (`valueSheets.ts`) is imported on first use.
 *
 * @module
 */
import type { ViewSwitch } from "../switches.ts";
import type { SheetsChoice } from "../viewState.ts";
import type { ValueSheets } from "./valueSheets.ts";

/** What shows the sheets of the values drawn, and answers once they have loaded whether it is still the last asked. */
export type ValueSheetsShower = (values: Readonly<Record<string, string>>) => Promise<boolean>;

/**
 * What shows the sheets of a frame's values; none for a catalogue with none, which so loads no code for them.
 *
 * @param valueSheets - each value's sheet, when the catalogue has any.
 * @param sheets - the frame's Styles setting.
 * @param switches - the catalogue's switches.
 * @param onFailed - told a sheet that did not load: the story is drawn without it.
 */
export const valueSheetsShower = async (
  valueSheets: ValueSheets | undefined,
  sheets: SheetsChoice,
  switches: readonly ViewSwitch[],
  onFailed: (message: string) => void
): Promise<ValueSheetsShower | undefined> => {
  if (valueSheets === undefined) return undefined;
  const { valueSheetUrls, valueSheetsIn } = await import("./valueSheets.ts");
  const show = valueSheetsIn(document, onFailed);
  return (values: Readonly<Record<string, string>>): Promise<boolean> =>
    show(valueSheetUrls(values, sheets, valueSheets, switches));
};
