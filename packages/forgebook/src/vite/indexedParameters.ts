/**
 * The parameters only the story index reads, never the frame: `touch`, `logic`, `device` and `requiredFirst`, which
 * the shell needs before a story loads (to start it touched, to mark it, to draw its device around it, to order the
 * props of its Props tab and of its component's page).
 *
 * @remarks
 * Written by code, such a parameter would be lost, since the frame does not read it: it is a problem, as one written
 * wrongly is. A device's model is checked against the models Forgebook draws, so a misspelt one is said where it is
 * written, not shown as another phone. Pure.
 *
 * @module
 */
import type { RequiredFirst, StoryDeviceSetting } from "@forgebook/story-format/csf";
import type { StoryIndexEntry } from "@forgebook/story-format/source";
import type { ESTree } from "vite";

import { deviceSettingProblem, isDeviceOrientation } from "../deviceView.ts";
import { REQUIRED_FIRST_LAYOUTS } from "../propGroups.ts";
import { type Fields, keyName, parameter, unwrapped } from "./indexFields.ts";

/** What the index keeps of these parameters: each only when written. */
export type IndexedParameters = Pick<StoryIndexEntry, "isTouch" | "isLogic" | "device" | "requiredFirst">;

/** Why `parameters.device` cannot be read as it is written. */
const DEVICE_PROBLEM =
  '`parameters.device` must be written as a plain object (`{ frame: true, model: "iphone-16" }`)';

/**
 * A boolean parameter: `true` or `false` written plainly, `undefined` when none, or a problem otherwise.
 *
 * @param value - the parameter's value.
 * @param name - its name, for the problem.
 */
const booleanOf = (value: ESTree.Expression | undefined, name: string): boolean | undefined | Error => {
  if (value === undefined) return undefined;
  if (value.type === "Literal" && typeof value.value === "boolean") return value.value;
  return new Error(`\`${name}\` must be written as a plain \`true\` or \`false\``);
};

/**
 * A plain string field of a device setting: `undefined` when none, the string, or a problem.
 *
 * @param value - the field's value.
 * @param name - its name, for the problem.
 */
const stringOf = (value: ESTree.Expression | undefined, name: string): string | undefined | Error => {
  if (value === undefined) return undefined;
  if (value.type === "Literal" && typeof value.value === "string") return value.value;
  return new Error(`\`parameters.device.${name}\` must be written as a plain string`);
};

/**
 * The fields `parameters.device` writes, by name, or a problem when it is written by code or names a field the
 * setting has not.
 *
 * @param value - the parameter's value.
 */
const deviceFields = (value: ESTree.Expression): Map<string, ESTree.Expression> | Error => {
  if (value.type !== "ObjectExpression") return new Error(DEVICE_PROBLEM);
  const fields = new Map<string, ESTree.Expression>();
  for (const property of value.properties) {
    const name = property.type === "Property" && !property.computed ? keyName(property.key) : undefined;
    if (property.type !== "Property" || name === undefined) return new Error(DEVICE_PROBLEM);
    if (!["frame", "model", "orientation", "touch", "edgeToEdge"].includes(name))
      return new Error(
        `\`parameters.device\` has no field \`${name}\`: it takes frame, model, orientation, touch and edgeToEdge`
      );
    fields.set(name, unwrapped(property.value));
  }
  return fields;
};

/**
 * `parameters.device`: `undefined` when none, the setting with the fields it writes, or a problem when it is written
 * by code, names a field the setting has not, or a model or an orientation that is none.
 *
 * @param value - the parameter's value.
 */
const deviceOf = (value: ESTree.Expression | undefined): StoryDeviceSetting | undefined | Error => {
  if (value === undefined) return undefined;
  const fields = deviceFields(value);
  if (fields instanceof Error) return fields;
  const frame = booleanOf(fields.get("frame"), "parameters.device.frame");
  if (frame instanceof Error) return frame;
  const touch = booleanOf(fields.get("touch"), "parameters.device.touch");
  if (touch instanceof Error) return touch;
  const edgeToEdge = booleanOf(fields.get("edgeToEdge"), "parameters.device.edgeToEdge");
  if (edgeToEdge instanceof Error) return edgeToEdge;
  const model = stringOf(fields.get("model"), "model");
  if (model instanceof Error) return model;
  const orientation = stringOf(fields.get("orientation"), "orientation");
  if (orientation instanceof Error) return orientation;
  if (orientation !== undefined && !isDeviceOrientation(orientation))
    return new Error(
      `\`parameters.device\`: "${orientation}" is no orientation; write portrait or landscape`
    );
  const setting: StoryDeviceSetting = {
    ...(frame === undefined ? {} : { frame }),
    ...(model === undefined ? {} : { model }),
    ...(orientation === undefined ? {} : { orientation }),
    ...(touch === undefined ? {} : { touch }),
    ...(edgeToEdge === undefined ? {} : { edgeToEdge })
  };
  const problem = deviceSettingProblem(setting);
  return problem === undefined ? setting : new Error(`\`parameters.device\`: ${problem}`);
};

/**
 * `parameters.requiredFirst`: `undefined` when none, `"in-groups"`, `"section"` or `false` written plainly, or a
 * problem otherwise.
 *
 * @param value - the parameter's value.
 */
const requiredFirstOf = (value: ESTree.Expression | undefined): RequiredFirst | undefined | Error => {
  if (value === undefined) return undefined;
  const written = value.type === "Literal" ? value.value : undefined;
  const layout = REQUIRED_FIRST_LAYOUTS.find((each) => each === written);
  if (layout !== undefined) return layout;
  return new Error(
    '`parameters.requiredFirst` must be written as a plain `"in-groups"`, `"section"` or `false`'
  );
};

/**
 * The parameters only the index reads, each only when written, or the first problem.
 *
 * @param fields - the story's or the meta's fields.
 */
export const indexedParameters = (fields: Fields): IndexedParameters | Error => {
  const touch = booleanOf(parameter(fields, "touch"), "parameters.touch");
  if (touch instanceof Error) return touch;
  const logic = booleanOf(parameter(fields, "logic"), "parameters.logic");
  if (logic instanceof Error) return logic;
  const device = deviceOf(parameter(fields, "device"));
  if (device instanceof Error) return device;
  const requiredFirst = requiredFirstOf(parameter(fields, "requiredFirst"));
  if (requiredFirst instanceof Error) return requiredFirst;
  return {
    ...(touch === undefined ? {} : { isTouch: touch }),
    ...(logic === undefined ? {} : { isLogic: logic }),
    ...(device === undefined ? {} : { device }),
    ...(requiredFirst === undefined ? {} : { requiredFirst })
  };
};
