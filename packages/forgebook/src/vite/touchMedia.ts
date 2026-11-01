/**
 * The rewrite that lets a story's CSS answer as a phone's while the catalogue simulates touch: the rules under the
 * pointer's media features (`hover`, `any-hover`, `pointer`, `any-pointer`) follow `data-forgebook-touch` on the root.
 *
 * @remarks
 * The computer answers `hover: hover` and `pointer: fine`, and a page cannot change that. So each media rule that asks
 * about the pointer is kept for the computer, its rules scoped to a root without the attribute, and copied once more
 * as a phone would read it (`hover: none`, `pointer: coarse`, the rest of its query kept), its rules scoped to a root
 * with the attribute. The scope is written in `:where()`, so no rule's specificity changes; a selector that starts at
 * the root (`:root`, `html`) takes the condition on the root itself. On a real phone the attribute is never set, so
 * its own media answer as before. The real mouse's `:hover` stops matching while touch is simulated: a finger does
 * not hover (`NOT_UNDER_TOUCH`). Runs only in the catalogue's build, as a Lightning CSS visitor.
 *
 * @module
 */
import type {
  MediaQuery,
  QueryFeatureFor_MediaFeatureId,
  Rule,
  Selector,
  SelectorComponent
} from "lightningcss";

/** The root's attribute the catalogue sets while it simulates touch (`touchSwitch` of `switches.ts`). */
export const TOUCH_ATTRIBUTE = "data-forgebook-touch";

/** A media condition as Lightning CSS parses it. */
type Condition = NonNullable<MediaQuery["condition"]>;

/** The pointer's media features, and what a phone answers to each. */
const PHONE_ANSWERS: Readonly<Record<string, { readonly value: string; readonly isPresent: boolean }>> = {
  hover: { value: "none", isPresent: false },
  "any-hover": { value: "none", isPresent: false },
  pointer: { value: "coarse", isPresent: true },
  "any-pointer": { value: "coarse", isPresent: true }
};

/** A condition read as a phone would: always, never, or still a condition (the other features). */
type PhoneReading = boolean | Condition;

/**
 * A feature as a phone answers it; another feature stays a condition.
 *
 * @param feature - the feature.
 */
const phoneFeature = (feature: QueryFeatureFor_MediaFeatureId): PhoneReading | undefined => {
  if (feature.type === "range" || feature.type === "interval") return undefined;
  const answer = PHONE_ANSWERS[feature.name];
  if (answer === undefined) return undefined;
  if (feature.type === "boolean") return answer.isPresent;
  return feature.value.type === "ident" && feature.value.value === answer.value;
};

/**
 * A condition read as a phone would.
 *
 * @param condition - the condition.
 */
const phoneCondition = (condition: Condition): PhoneReading => {
  if (condition.type === "feature") return phoneFeature(condition.value) ?? condition;
  if (condition.type === "not") {
    const inner = phoneCondition(condition.value);
    return typeof inner === "boolean" ? !inner : { type: "not", value: inner };
  }
  if (condition.type !== "operation") return condition;
  const isAnd = condition.operator === "and";
  const parts: Condition[] = [];
  for (const each of condition.conditions.map(phoneCondition)) {
    // in an "and", false decides and true drops out; in an "or", the other way round
    if (each === !isAnd) return !isAnd;
    if (typeof each !== "boolean") parts.push(each);
  }
  if (parts.length === 0) return isAnd;
  return parts.length === 1 && parts[0] !== undefined ? parts[0] : { ...condition, conditions: parts };
};

/**
 * Whether a condition asks about the pointer anywhere.
 *
 * @param condition - the condition.
 */
const asksPointer = (condition: Condition): boolean => {
  if (condition.type === "feature")
    return (
      condition.value.type !== "range" &&
      condition.value.type !== "interval" &&
      condition.value.name in PHONE_ANSWERS
    );
  if (condition.type === "not") return asksPointer(condition.value);
  return condition.type === "operation" && condition.conditions.some(asksPointer);
};

/**
 * The queries a phone reads in a list: each query its pointer features answered; one a phone never matches dropped.
 *
 * @param queries - the media rule's queries.
 * @returns the queries; none when a phone matches none of them.
 */
const phoneQueries = (queries: readonly MediaQuery[]): MediaQuery[] =>
  queries.flatMap((query): MediaQuery[] => {
    if (query.condition === null || query.condition === undefined) return [query];
    const reading = phoneCondition(query.condition);
    if (typeof reading !== "boolean") return [{ ...query, condition: reading }];
    if (query.qualifier !== "not") return reading ? [{ ...query, qualifier: null, condition: null }] : [];
    // `not T and C`: with C true it is `not T` (never, for every type), with C false it holds for every type
    if (!reading) return [{ ...query, qualifier: null, mediaType: "all", condition: null }];
    return query.mediaType === "all" ? [] : [{ ...query, condition: null }];
  });

/**
 * The rules a rule holds, for the rules that hold others (`@media`, `@supports`, `@container`, `@layer`,
 * `@starting-style`); none for any other.
 *
 * @param rule - the rule.
 */
const groupedRules = (rule: Rule): readonly Rule[] | undefined => {
  switch (rule.type) {
    case "media":
    case "supports":
    case "container":
    case "layer-block":
    case "starting-style":
      return rule.value.rules;
    default:
      return undefined;
  }
};

/**
 * A rule that holds others, with other rules in it.
 *
 * @param rule - the rule (one `groupedRules` reads).
 * @param rules - its new rules.
 */
const withGroupedRules = (rule: Rule, rules: Rule[]): Rule => {
  // one case each: the spread keeps each rule's own type
  switch (rule.type) {
    case "media":
      return { ...rule, value: { ...rule.value, rules } };
    case "supports":
      return { ...rule, value: { ...rule.value, rules } };
    case "container":
      return { ...rule, value: { ...rule.value, rules } };
    case "layer-block":
      return { ...rule, value: { ...rule.value, rules } };
    case "starting-style":
      return { ...rule, value: { ...rule.value, rules } };
    default:
      return rule;
  }
};

/** `[data-forgebook-touch]`. */
const TOUCH: SelectorComponent = { type: "attribute", name: TOUCH_ATTRIBUTE };

/**
 * The root's condition: with the attribute, or without it.
 *
 * @param isTouch - whether touch is simulated.
 */
const rootCondition = (isTouch: boolean): SelectorComponent =>
  isTouch ? TOUCH : { type: "pseudo-class", kind: "not", selectors: [[TOUCH]] };

/**
 * `:where(<components>)`.
 *
 * @param components - one compound selector.
 */
const whereOf = (components: Selector): SelectorComponent => ({
  type: "pseudo-class",
  kind: "where",
  selectors: [components]
});

/**
 * Whether a selector's component is a scope this rewrite wrote: a `:where()` that names the touch attribute, with no
 * combinator in it (the `:hover` guard, `NOT_UNDER_TOUCH`, has one). Read from its structure: Lightning CSS writes a
 * selector it visits again with fields of its own.
 *
 * @param component - the component.
 */
const isScopeComponent = (component: SelectorComponent): boolean => {
  if (component.type !== "pseudo-class" || component.kind !== "where") return false;
  const text = JSON.stringify(component);
  return text.includes(TOUCH_ATTRIBUTE) && !text.includes('"combinator"');
};

/**
 * Whether a selector starts at a shadow root's host (`:host`, `:host(.on)`).
 *
 * @param selector - the selector.
 */
const isShadowHost = (selector: Selector): boolean =>
  selector[0]?.type === "pseudo-class" && selector[0].kind === "host";

/**
 * A selector scoped to a root with touch simulated or without: the condition on the root itself when the selector
 * starts there, a descendant of such a root otherwise, in `:where()` either way.
 *
 * @param selector - the selector.
 * @param isTouch - whether touch is simulated.
 */
const scopedSelector = (selector: Selector, isTouch: boolean): Selector => {
  const firstCombinator = selector.findIndex((component) => component.type === "combinator");
  const head = firstCombinator === -1 ? selector : selector.slice(0, firstCombinator);
  // scoped already: a pointer media rule inside another
  if (head.some(isScopeComponent)) return selector;
  const atRoot = head.findIndex(
    (component) =>
      (component.type === "pseudo-class" && component.kind === "root") ||
      (component.type === "type" && component.name === "html")
  );
  // right after the root's own component, before a pseudo-element that may follow it
  if (atRoot !== -1)
    return [
      ...selector.slice(0, atRoot + 1),
      whereOf([rootCondition(isTouch)]),
      ...selector.slice(atRoot + 1)
    ];
  return [
    whereOf([{ type: "pseudo-class", kind: "root" }, rootCondition(isTouch)]),
    { type: "combinator", value: "descendant" },
    ...selector
  ];
};

/**
 * Rules scoped to a root with touch simulated or without, inside the rules that group them (`@supports`, `@layer`,
 * `@container`, another `@media`); a nested rule keeps its own selectors, relative to its scoped parent.
 *
 * @param rules - the rules.
 * @param isTouch - whether touch is simulated.
 */
const scopedRules = (rules: readonly Rule[], isTouch: boolean): Rule[] =>
  rules.flatMap((rule): Rule[] => {
    if (rule.type === "style") {
      // a shadow root's own selector (`:host`) has no root to scope it by: kept for the computer, under its real media,
      // and left out of the phone's copy, where nothing would hold it to touch
      const selectors = rule.value.selectors
        .filter((each) => !(isTouch && isShadowHost(each)))
        .map((each) => (isShadowHost(each) ? each : scopedSelector(each, isTouch)));
      return selectors.length === 0 ? [] : [{ ...rule, value: { ...rule.value, selectors } }];
    }
    // declarations written straight inside a nested media rule (`.a { @media (hover: none) { color: red } }`) belong to
    // the parent: they become a rule of the parent itself (`&`), scoped like any other
    if (rule.type === "nested-declarations") {
      return [
        {
          type: "style",
          value: {
            selectors: [scopedSelector([{ type: "nesting" }], isTouch)],
            declarations: rule.value.declarations,
            rules: [],
            loc: rule.value.loc
          }
        }
      ];
    }
    const inner = groupedRules(rule);
    return [inner === undefined ? rule : withGroupedRules(rule, scopedRules(inner, isTouch))];
  });

/**
 * Whether rules hold an `@scope` rule anywhere: Lightning CSS cannot write one back after a visitor returns it, so a
 * media rule that holds one is left as it is.
 *
 * @param rules - the rules.
 */
const holdsScope = (rules: readonly Rule[]): boolean =>
  rules.some((rule) => rule.type === "scope" || holdsScope(groupedRules(rule) ?? []));

/**
 * A value of Lightning CSS's tree without its `null` fields, as the visitor must hand it back.
 *
 * @remarks
 * Lightning CSS gives an empty optional value as `null` (a `var()`'s `from` and `fallback`, an `env()`'s indices) but
 * reads a returned rule back only with the field left out: a rule that holds one fails the whole build. Fields only:
 * a `null` inside a list is a value. Written as an overload, the only way to say the tree keeps its type without a
 * cast: the fields its types call nullable are left out instead.
 *
 * @param value - the value.
 */
function withoutNulls<Value>(value: Value): Value;
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => field !== null)
      .map(([key, field]) => [key, withoutNulls(field)])
  );
}

/**
 * A media rule as the computer and as a simulated phone read it: the rule for the computer, its rules scoped to a
 * root without the attribute, then, when a phone can match it, its copy with the pointer answered as a phone's, its
 * rules scoped to a root with the attribute. A media rule that asks nothing of the pointer is left as it is.
 *
 * @param rule - a media rule.
 */
export const touchMediaRules = (rule: Extract<Rule, { type: "media" }>): Rule[] | undefined => {
  const queries = rule.value.query.mediaQueries;
  if (
    !queries.some(
      (query) => query.condition !== null && query.condition !== undefined && asksPointer(query.condition)
    )
  )
    return undefined;
  if (holdsScope(rule.value.rules)) return undefined;
  const computer: Rule = { ...rule, value: { ...rule.value, rules: scopedRules(rule.value.rules, false) } };
  const phone = phoneQueries(queries);
  if (phone.length === 0) return withoutNulls([computer]);
  return withoutNulls([
    computer,
    {
      ...rule,
      value: { ...rule.value, query: { mediaQueries: phone }, rules: scopedRules(rule.value.rules, true) }
    }
  ]);
};

/**
 * `:where(:not(:root[data-forgebook-touch] *))`: an element outside a root that simulates touch. Written beside the
 * real `:hover` (`forcedStates.ts`), so the mouse's hover stops matching while touch is simulated: a finger does not
 * hover.
 */
export const NOT_UNDER_TOUCH: SelectorComponent = {
  type: "pseudo-class",
  kind: "where",
  selectors: [
    [
      {
        type: "pseudo-class",
        kind: "not",
        selectors: [
          [
            { type: "pseudo-class", kind: "root" },
            TOUCH,
            { type: "combinator", value: "descendant" },
            { type: "universal" }
          ]
        ]
      }
    ]
  ]
};
