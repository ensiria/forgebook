/**
 * The rewrite that shows interaction states without the pointer or the keyboard: every user-action pseudo-class also
 * matches inside an element that forces it.
 *
 * @remarks
 * `:hover` becomes `:is(:hover, [data-forgebook-force~="hover"], [data-forgebook-force~="hover"] *)`, and so on for
 * `:active`, `:focus`, `:focus-visible` and `:focus-within`, at every depth (inside `:is()`, `:not()`, `:has()`). The
 * real state still works, the specificity stays the same (an attribute weighs what a pseudo-class does), and the
 * library's CSS carries nothing for the catalogue: the rewrite runs only in the catalogue's build, as a Lightning CSS
 * visitor (D-60). A story forces a state with `parameters.forceState` (on its root) or `data-forgebook-force` on a
 * part.
 *
 * @module
 */

import type { ForcedState } from "@forgebook/story-format/csf";
import type { CustomAtRules, Selector, SelectorComponent, Visitor } from "lightningcss";

/** The attribute that forces states on an element and everything inside it. */
export const FORCE_ATTRIBUTE = "data-forgebook-force";

/** The pseudo-classes the rewrite reaches. */
const FORCEABLE: readonly ForcedState[] = ["hover", "active", "focus", "focus-visible", "focus-within"];

/** Whether a pseudo-class kind is one the catalogue forces. */
const isForceable = (kind: string): kind is ForcedState => FORCEABLE.some((state) => state === kind);

/** `[data-forgebook-force~="<state>"]`. */
const forcingAttribute = (state: ForcedState): SelectorComponent => ({
  type: "attribute",
  name: FORCE_ATTRIBUTE,
  operation: { operator: "includes", value: state }
});

/** `:is(:<state>, [force~=state], [force~=state] *)`: the state, real or forced. */
const realOrForced = (state: ForcedState): SelectorComponent => ({
  type: "pseudo-class",
  kind: "is",
  selectors: [
    [{ type: "pseudo-class", kind: state }],
    [forcingAttribute(state)],
    [forcingAttribute(state), { type: "combinator", value: "descendant" }, { type: "universal" }]
  ]
});

/** A pseudo-class that holds other selectors, rewritten inside. */
const withNested = (component: SelectorComponent): SelectorComponent => {
  if (component.type !== "pseudo-class") return component;
  if (
    component.kind === "is" ||
    component.kind === "where" ||
    component.kind === "not" ||
    component.kind === "has"
  ) {
    return { ...component, selectors: component.selectors.map(forcedSelector) };
  }
  return component;
};

/**
 * One selector with every forceable pseudo-class matching its forced form too.
 *
 * @param selector - a selector, as Lightning CSS parses it.
 * @returns the rewritten selector; the same components when it holds no forceable state.
 */
export const forcedSelector = (selector: Selector): Selector =>
  selector.map((component) =>
    component.type === "pseudo-class" && isForceable(component.kind)
      ? realOrForced(component.kind)
      : withNested(component)
  );

/** The Lightning CSS visitor that applies the rewrite to every style sheet the catalogue builds. */
export const FORCED_STATES_VISITOR: Visitor<CustomAtRules> = { Selector: forcedSelector };
