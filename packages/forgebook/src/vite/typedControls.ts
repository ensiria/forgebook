/**
 * The custom controls a catalogue gives props by their type or their name (a control's `matches`), written into a
 * component's docs as the plugin serves them: the panel, the address's check and the agents then read the control from
 * the prop, as if every story had named it. Pure.
 *
 * @remarks
 * Done on the server, where the docs are made, so the shell's first load carries no matching: a prop's `customControl`
 * is read as a story's `argTypes` control is. Only props the component has get one, so no story ever gains a prop. A
 * story whose `argTypes` name a control for the prop keeps its own (`argTypes.ts`). Among the controls that match a prop,
 * a match by name wins over a match by type alone, then the first in the catalogue's order.
 *
 * @module
 */
import type { PropDocs } from "../componentDocs.ts";
import type { StoryComponentResult } from "./adapter.ts";
import type { ResolvedArgControls } from "./argControlsConfig.ts";
import type { ArgControlMatch } from "./config.ts";

/**
 * How well a match fits a prop: 2 when it names the prop, 1 when it names only its type, 0 when it does not fit.
 *
 * @param match - the match.
 * @param prop - the prop.
 */
const fitOf = (match: ArgControlMatch, prop: Pick<PropDocs, "name" | "type" | "typeNames">): number => {
  const names = prop.typeNames ?? [prop.type];
  if (match.typeName !== undefined && !names.includes(match.typeName)) return 0;
  if (match.propName !== undefined) return match.propName === prop.name ? 2 : 0;
  return 1;
};

/**
 * The control a catalogue gives a prop by its type or its name, when one does.
 *
 * @param prop - the prop, as its docs read it.
 * @param controls - the catalogue's custom controls, in their precedence.
 * @returns the control's name; none when no match fits, or for an event.
 */
export const matchedControlOf = (
  prop: Pick<PropDocs, "name" | "kind" | "type" | "typeNames">,
  controls: ResolvedArgControls
): string | undefined => {
  if (prop.kind === "event") return undefined;
  let best: { readonly name: string; readonly fit: number } | undefined;
  for (const [name, control] of Object.entries(controls)) {
    const fit = Math.max(0, ...control.matches.map((match) => fitOf(match, prop)));
    // the first of equal fits keeps its place: the catalogue's controls come before its presets'
    if (fit > (best?.fit ?? 0)) best = { name, fit };
  }
  return best?.name;
};

/**
 * A prop with the control a catalogue gives it: the control decides what its value is, so the type's shape, text,
 * choices and tokens no longer draw nor check it, and it is no longer a choice a matrix can take, as for a control a
 * story names.
 *
 * @param prop - the prop.
 * @param controls - the catalogue's custom controls.
 */
const withMatchedControl = (prop: PropDocs, controls: ResolvedArgControls): PropDocs => {
  const customControl = matchedControlOf(prop, controls);
  if (customControl === undefined) return prop;
  const { shape: _shape, canTakeText: _canTakeText, choices: _choices, token: _token, ...rest } = prop;
  return { ...rest, kind: "other", customControl };
};

/**
 * A story file's component docs with the controls the catalogue gives its props; as it is when no control matches.
 *
 * @param result - what the framework read of the story file.
 * @param controls - the catalogue's custom controls.
 */
export const withTypedControls = (
  result: StoryComponentResult,
  controls: ResolvedArgControls
): StoryComponentResult => {
  // a story file whose meta names no component has no props to match
  if (typeof result === "string" || !("file" in result)) return result;
  if (!Object.values(controls).some((control) => control.matches.length > 0)) return result;
  const { docs } = result;
  return {
    ...result,
    docs: { ...docs, props: docs.props.map((prop) => withMatchedControl(prop, controls)) }
  };
};
