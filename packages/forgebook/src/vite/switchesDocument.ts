/**
 * What `forgebook switches` and `list_switches` answer: the switches a catalogue offers, so an agent can name a value in
 * a view (`--view look=night`) and see what it brings with it without opening the shell.
 *
 * @module
 */
import { type SwitchValue, switchControl, type ViewSwitch } from "../switches.ts";
import type { AgentSwitchValue, SwitchesDocument } from "./agent.types.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A file's path as the document gives it. */
const fromDir = (dir: string, file: string): string => VITE_PATHS.relative(dir, file);

/**
 * A value as the document gives it, its files by their path from the configuration's folder.
 *
 * @param each - the switch.
 * @param value - the value.
 * @param dir - the configuration's folder.
 */
const documentValue = (each: ViewSwitch, value: SwitchValue, dir: string): AgentSwitchValue => {
  const { preview, implies, sheet } = value;
  return {
    value: value.value,
    label: value.label,
    view: `${each.id}=${value.value}`,
    ...(implies === undefined ? {} : { implies }),
    ...(sheet === undefined ? {} : { sheet: fromDir(dir, sheet) }),
    ...(preview === undefined
      ? {}
      : { preview: "image" in preview ? { image: fromDir(dir, preview.image) } : preview })
  };
};

/**
 * The document of a catalogue's switches.
 *
 * @param switches - the catalogue's switches, the ready-made ones among them, their files absolute.
 * @param dir - the configuration's folder.
 */
export const switchesDocument = (switches: readonly ViewSwitch[], dir: string): SwitchesDocument => ({
  schema: 1,
  switches: switches.map((each) => ({
    id: each.id,
    label: each.label,
    default: each.default,
    control: switchControl(each),
    ...(each.role === undefined ? {} : { role: each.role }),
    values: each.values.map((value) => documentValue(each, value, dir))
  }))
});
