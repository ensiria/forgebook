/**
 * What `checkedAddressArgs` needs for a story's structured values, loaded with the first story that has one: what reads a
 * shape, the worst case of one, and the schemas of the custom controls it names. A catalogue of plain props never asks for
 * this; one with no custom control never loads theirs.
 *
 * @module
 */
import type { ArgChecks } from "../addressArgs.ts";
import { isFileList, isValueOfShape, worstOfShape } from "../shapeValues.ts";
import type { ArgControlLoaders } from "./customControls.ts";

/** What the stage holds of it. */
export type LoadedChecks = ArgChecks & {
  /** A shape's worst value. */
  readonly worstOfShape: typeof worstOfShape;
};

/**
 * The checks for a story.
 *
 * @param names - the custom controls it names.
 * @param loaders - the catalogue's custom controls.
 */
export const loadedChecks = async (
  names: readonly string[],
  loaders: ArgControlLoaders
): Promise<LoadedChecks> => {
  const checks = { isFileList, isValueOfShape, worstOfShape };
  if (names.length === 0) return checks;
  try {
    const { customChecksOf } = await import("./customControls.ts");
    return { ...checks, custom: await customChecksOf(names, loaders) };
  } catch {
    // a page left open across a new build: a control that cannot load refuses its values, as one that fails does
    return checks;
  }
};
