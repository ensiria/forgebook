/**
 * The custom controls of a catalogue, as the shell loads them: a module's check on arrival, and the check of a value before
 * it reaches the story. Loaded with the first story that names such a control, so a catalogue with none never asks for it.
 *
 * @remarks
 * A module is the catalogue's own code, run with a plugin's trust, and it can be wrong in every way: named by no one, gone,
 * throwing as it loads, exporting something else. Each ends in a sentence beside the field; none reaches the panel as an
 * exception.
 *
 * @module
 */
import type { ArgControlModule } from "../argControl.ts";
import type { ArgValue } from "../messages.ts";
import { holdsUnsafePart } from "../shapeValues.ts";
import { isValueSchema, schemaProblem } from "../valueSchema.ts";
import { lateStrings } from "./strings.ts";

/** The texts of the custom controls' host. */
export const CONTROL_STRINGS = lateStrings({
  controlUnknown: (name: string): string =>
    `No control is registered as "${name}": add it to argControls in forgebook.config`,
  controlFailed: (name: string, reason: string): string =>
    `The control "${name}" could not be loaded: ${reason}`,
  controlMalformed: (name: string): string =>
    `The control "${name}" must export mount, a function, and schema, of JSON Schema's keywords Forgebook reads`,
  controlThrew: (name: string, reason: string): string => `The control "${name}" failed: ${reason}`,
  controlValue: (name: string, reason: string): string =>
    `The control "${name}" was given a value it refuses: ${reason}`,
  controlUnsafe: "It holds what a link may not give"
});

/** A catalogue's custom controls: how to load each, by name. */
export type ArgControlLoaders = Readonly<Record<string, () => Promise<unknown>>>;

/** A control as loading it ended. */
export type LoadedControl =
  | { readonly status: "ready"; readonly module: ArgControlModule }
  | { readonly status: "failed"; readonly message: string };

/** Whether a value is a plain object with a function `mount`. */
const isControlModule = (value: unknown): value is ArgControlModule =>
  typeof value === "object" &&
  value !== null &&
  "mount" in value &&
  typeof value.mount === "function" &&
  "schema" in value &&
  isValueSchema(value.schema);

/** Each control's load, kept: every field and check of a page share one. */
const loads = new Map<() => Promise<unknown>, Promise<LoadedControl>>();

/** Loads one control's module, once, and reads what it exports. */
const readControl = async (name: string, load: () => Promise<unknown>): Promise<LoadedControl> => {
  try {
    const module = await load();
    return isControlModule(module)
      ? { status: "ready", module }
      : { status: "failed", message: CONTROL_STRINGS.controlMalformed(name) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "failed", message: CONTROL_STRINGS.controlFailed(name, reason) };
  }
};

/**
 * A control, loaded.
 *
 * @param name - its name.
 * @param loaders - the catalogue's custom controls.
 */
export const loadControl = (name: string, loaders: ArgControlLoaders): Promise<LoadedControl> => {
  const load = Object.hasOwn(loaders, name) ? loaders[name] : undefined;
  if (load === undefined)
    return Promise.resolve({ status: "failed", message: CONTROL_STRINGS.controlUnknown(name) });
  const started = loads.get(load) ?? readControl(name, load);
  loads.set(load, started);
  return started;
};

/**
 * What is wrong with a value for a control: its schema's word, or that it holds what would run if a component spread it on
 * an element, which no schema's author is asked to think of.
 *
 * @param module - the control's module.
 * @param value - the value.
 * @returns the sentence; none when it fits.
 */
export const controlValueProblem = (module: ArgControlModule, value: ArgValue): string | undefined =>
  schemaProblem(module.schema, value) ??
  (holdsUnsafePart(value, true) ? CONTROL_STRINGS.controlUnsafe : undefined);

/**
 * The checks of a story's custom controls, by name; a control that cannot load has none, which refuses its values.
 *
 * @param names - the controls the story names.
 * @param loaders - the catalogue's custom controls.
 */
export const customChecksOf = async (
  names: readonly string[],
  loaders: ArgControlLoaders
): Promise<Readonly<Record<string, (value: ArgValue) => string | undefined>>> => {
  const controls = await Promise.all(
    names.map(async (name) => [name, await loadControl(name, loaders)] as const)
  );
  return Object.fromEntries(
    controls.flatMap(([name, control]) =>
      control.status === "ready"
        ? [[name, (value: ArgValue): string | undefined => controlValueProblem(control.module, value)]]
        : []
    )
  );
};
