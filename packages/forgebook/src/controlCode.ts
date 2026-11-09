/**
 * What a custom control is told of its arg, and the code its values are written as in a story's code: the expression a
 * control's `toCode` gives (`IconStar` for the name `"IconStar"`), for the Code tab and `forgebook story`. Pure.
 *
 * @module
 */
import type { ArgControlModule, ControlArgType } from "./argControl.ts";
import type { PanelProp } from "./argTypes.ts";
import { isArgValue, isUnsetArg, type PanelArgs } from "./messages.ts";

/**
 * What a control is told of its arg.
 *
 * @param prop - the prop, with the story's `argTypes` laid over it.
 */
export const controlArgTypeOf = (prop: PanelProp): ControlArgType => ({
  name: prop.name,
  label: prop.label ?? prop.name,
  description: prop.description,
  ...(prop.choices === undefined ? {} : { options: prop.choices }),
  ...(prop.min === undefined ? {} : { min: prop.min }),
  ...(prop.max === undefined ? {} : { max: prop.max }),
  ...(prop.step === undefined ? {} : { step: prop.step }),
  // the frame's word, read here since only a control needs it: what is no plain data never reaches a control
  ...(prop.settings === undefined || !isArgValue(prop.settings) ? {} : { settings: prop.settings })
});

/** A control's `toCode`, by control: what writes its values as code. */
export type ControlCoders = Readonly<Record<string, ArgControlModule["toCode"]>>;

/**
 * The code each arg of a custom control is written as, by arg: the expression its control's `toCode` gives for its
 * value. An arg without a value, with the panel's "no value", whose control writes no code, or whose `toCode` throws
 * or gives nothing, is written from its value as before.
 *
 * @param props - the props the panel sets, with the story's `argTypes` laid over them.
 * @param args - the values the code is written from.
 * @param coders - each control's `toCode`, by control.
 */
export const controlCodeOf = (
  props: readonly PanelProp[],
  args: PanelArgs,
  coders: ControlCoders
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    props.flatMap((prop): [string, string][] => {
      const control = prop.customControl;
      const value = Object.hasOwn(args, prop.name) ? args[prop.name] : undefined;
      const toCode = control !== undefined && Object.hasOwn(coders, control) ? coders[control] : undefined;
      if (toCode === undefined || value === undefined || isUnsetArg(value)) return [];
      try {
        const code = toCode(value, controlArgTypeOf(prop));
        return typeof code === "string" && code !== "" ? [[prop.name, code]] : [];
      } catch {
        // the control's code is its own: a failure writes the value as JSON, as a control without `toCode`
        return [];
      }
    })
  );
