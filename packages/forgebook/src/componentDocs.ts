/**
 * What the catalogue knows about a story file's component, read from its types and TSDoc: the props panel's data,
 * shared by the plugin that extracts it (Node) and the shell that shows it (the page).
 *
 * @remarks
 * Every prop has a kind, decided from its type, which is the panel's group and control: a union of
 * literals is a choice, `string` text, `number` a number, `boolean` a toggle, a function named `on<Something>` an
 * event; anything else cannot be set from the panel. The data crosses from the plugin to the page as JSON, so the
 * shell checks it on arrival (`isComponentDocs`).
 *
 * @module
 */

import type { ValueShape } from "./valueShape.ts";

/** How a prop is set from the panel, and the group it is listed in. */
export type PropKind = "choice" | "text" | "number" | "toggle" | "event" | "other";

/** One parameter of an event's signature. */
export type SignatureParameter = {
  /** The parameter's name. */
  readonly name: string;
  /** Its type, as the source writes it. */
  readonly type: string;
};

/** An event's signature: what the callback receives and returns. */
export type EventSignature = {
  /** The parameters, in order. */
  readonly parameters: readonly SignatureParameter[];
  /** The return type, as the source writes it. */
  readonly returns: string;
};

/** One parameter of a hook's or a function's signature. */
export type FunctionParameterDocs = {
  /** The parameter's name; a destructured one's pattern as written (`{ start }`). */
  readonly name: string;
  /** Its type, as the source writes it. */
  readonly type: string;
  /** Its `@param` text; empty when it has none. */
  readonly description: string;
  /** Whether it may be left out (a `?` or a default). */
  readonly isOptional: boolean;
  /** Whether it takes the rest of the arguments (`...values`). */
  readonly isRest: boolean;
};

/** A hook's or a function's signature: what a story about logic documents first. */
export type FunctionSignatureDocs = {
  /** Its type parameters as written (`TValue`, `TUnit extends string`); empty when it has none. */
  readonly typeParameters: readonly string[];
  /** The parameters, in order. */
  readonly parameters: readonly FunctionParameterDocs[];
  /** The return type, as the source writes it. */
  readonly returns: string;
  /** Its `@returns` text; empty when it has none. */
  readonly returnsDescription: string;
};

/**
 * One member of a prop's object type (a `texts` prop's `FileFinderTexts`), listed under the prop in the API
 * reference.
 */
export type MemberDocs = {
  /** The member's name. */
  readonly name: string;
  /** Its type as the source writes it, without `undefined` and `null`. */
  readonly type: string;
  /** The first paragraph of its TSDoc; empty when it has none. */
  readonly description: string;
  /** Its `@defaultValue`, when the TSDoc gives one. */
  readonly defaultValue?: string;
  /** Whether the member must be given. */
  readonly isRequired: boolean;
};

/**
 * Why a prop's type is not the one its source writes, or says nothing: a generic's type parameter and what it is shown
 * as, a name the checker cannot find, an `any`.
 */
export type PropTypeNote =
  | {
      /** A type parameter of the props type, replaced in the prop's type. */
      readonly reason: "generic";
      /** Its name (`TItem`). */
      readonly parameter: string;
      /** What it is shown as: its constraint, its default when it has no constraint, `unknown` when it has neither. */
      readonly shownAs: "constraint" | "default" | "unknown";
      /** That type, as the source writes it. */
      readonly type: string;
    }
  | {
      /** A name in the prop's type that the checker cannot find (a missing import), so the type means `any`. */
      readonly reason: "unresolved";
      /** The name, as written. */
      readonly name: string;
    }
  | {
      /** The prop's type is `any`: nothing can be said of its values. */
      readonly reason: "any";
    };

/**
 * When a prop can be passed: the values of the discriminant that select the variants of the props that declare it
 * (`href` only when `kind` is `"link"`).
 */
export type PropCondition = {
  /** The discriminant: a prop every variant declares with a literal type. */
  readonly prop: string;
  /** Its values in the variants that declare the prop, in the order the variants come. */
  readonly values: readonly (string | number | boolean)[];
  /**
   * Whether the prop also applies with the discriminant left out, since a variant that declares it takes it so
   * (`mode?: "single"`). Left out when `false`.
   */
  readonly orOmitted?: boolean;
};

/** Why a component lists no props although it takes some. */
export type PropsNote =
  | {
      /** Its props are typed `any` (or not typed): there is nothing to read. */
      readonly reason: "untyped";
    }
  | {
      /** Its type cannot be called or constructed with props, so it gives none to read. */
      readonly reason: "no-signature";
    }
  | {
      /** Every prop it takes is declared outside its package (an element's attributes), which the docs leave out. */
      readonly reason: "outside-package";
      /** How many props were left out. */
      readonly count: number;
    };

/** One prop of a component. */
export type PropDocs = {
  /** The prop's name. */
  readonly name: string;
  /** How it is set, and its group. */
  readonly kind: PropKind;
  /**
   * Its type as the source writes it (`ReactNode`, `Ref<HTMLElement>`), without `undefined`, `null` and the `never` of
   * a branch that forbids it; a choice's values in the order the source writes them. The checker's own text orders a
   * union by the types it happened to meet first, so it changed between reads of a program kept in memory.
   */
  readonly type: string;
  /** The first paragraph of its TSDoc; empty when it has none. */
  readonly description: string;
  /** Its `@defaultValue`, when the TSDoc gives one. */
  readonly defaultValue?: string;
  /** Whether the prop must be passed. */
  readonly isRequired: boolean;
  /** For a choice, its values in the order of the type. */
  readonly choices?: readonly (string | number)[];
  /** For an event, its signature. */
  readonly signature?: EventSignature;
  /**
   * For a prop of kind `other` (a node, a union), whether a plain text can be passed: the panel then offers a text
   * field for it. Left out when `false`.
   */
  readonly canTakeText?: boolean;
  /**
   * The group its TSDoc puts it in (`@group Selection`): the API reference and the Props tab list it under that
   * heading. Left out when it names none.
   */
  readonly group?: string;
  /**
   * The members of its type, when that type is an object the package declares and documents (`texts?: FileFinderTexts`),
   * in the order the source declares them: the API reference lists them under the prop, folded. Left out otherwise.
   */
  readonly members?: readonly MemberDocs[];
  /**
   * For a prop of kind `other`, what its value looks like when plain JSON can hold it (`readonly string[]`, `{ a; b? }`,
   * `"sm" | number`): the panel draws fields from it and a link's value is checked against it. Left out otherwise.
   */
  readonly shape?: ValueShape;
  /**
   * The design tokens its TSDoc asks for (`@token color`): a token's type or a part of its name. Left out when it asks
   * for none.
   */
  readonly token?: string;
  /**
   * For a prop only some variants of a union of props declare, when it can be passed: the discriminant's values that
   * select them. Such a prop is never required. Left out for a prop every variant declares, and when the union has no
   * discriminant.
   */
  readonly onlyWhen?: PropCondition;
  /** Why its type is not the one its source writes, or says nothing, in source order. Left out when there is none. */
  readonly notes?: readonly PropTypeNote[];
};

/** A part the component is used with, named in the meta's `subcomponents`: listed under it on its page. */
export type SubcomponentDocs = {
  /** The name the meta gives it: its key in `subcomponents`. */
  readonly name: string;
  /** The first paragraph of its TSDoc. */
  readonly description: string;
  /** Its props declared in the package, in the same order as the component's. */
  readonly props: readonly PropDocs[];
};

/**
 * When to use a component and when not, as its TSDoc says: the rule a person knows and an agent has no way to guess.
 * Tags: `@useWhen`, `@avoidWhen`, `@alternatives`, `@deprecated`, `@replacedBy`.
 */
export type UsageGuidance = {
  /** The situations it is for, one per `@useWhen`. */
  readonly useWhen?: readonly string[];
  /** The situations it is not for, one per `@avoidWhen`. */
  readonly avoidWhen?: readonly string[];
  /** Components to consider instead, from `@alternatives`, comma-separated. */
  readonly alternatives?: readonly string[];
  /** Why not to use it any more, from `@deprecated`. */
  readonly deprecated?: string;
  /** What to use instead, from `@replacedBy`. */
  readonly replacedBy?: string;
};

/** A story file's component. */
export type ComponentDocs = {
  /** The component's name. */
  readonly name: string;
  /** The first paragraph of its TSDoc. */
  readonly description: string;
  /**
   * The first paragraph of its file's `@module` comment: what it is and does, the component page's lead. Empty when
   * the file has none.
   */
  readonly summary: string;
  /**
   * Its props declared in the package (the HTML attributes it passes on are left out), in declaration order: those of
   * the component's own folder first, then the ones it takes from elsewhere, each by file and position.
   */
  readonly props: readonly PropDocs[];
  /** Its parts: the keys of its `classNames`, `styles` and `refs` maps. */
  readonly parts: readonly string[];
  /** The parts the meta names in `subcomponents`, in the order it writes them; empty when it names none. */
  readonly subcomponents: readonly SubcomponentDocs[];
  /** When to use it and when not, from its TSDoc; left out when it says nothing. */
  readonly guidance?: UsageGuidance;
  /**
   * Its call signature, when it has one: the parameters and the return value a story about logic shows first (the
   * meta's `component` is then the hook or the function).
   */
  readonly signature?: FunctionSignatureDocs;
  /**
   * The CSS selector a template writes the component with, for a framework whose components are matched by one rather
   * than named (an Angular component's `fb-badge`, a directive's `button[fbButton]`): the code writer writes the story's
   * markup from it. Left out when the component is written by its name.
   */
  readonly selector?: string;
  /** Why it lists no props although it takes some; left out when its props are read, or it takes none. */
  readonly propsNote?: PropsNote;
};

/**
 * The name a story's code writes the component with: its selector when its framework matches components by one, its
 * name otherwise.
 *
 * @param docs - the component's docs.
 */
export const codeNameOf = (docs: ComponentDocs): string => docs.selector ?? docs.name;

/** What the plugin answers for a story file whose meta names no component (a foundations page). */
export type NoComponentDocs = {
  /** No component. */
  readonly name: null;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** The prop kinds, for the check. */
const PROP_KINDS: readonly PropKind[] = ["choice", "text", "number", "toggle", "event", "other"];

/** Whether a value is one member's docs. */
const isMemberDocs = (value: unknown): value is MemberDocs =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  typeof value["type"] === "string" &&
  typeof value["description"] === "string" &&
  typeof value["isRequired"] === "boolean" &&
  (value["defaultValue"] === undefined || typeof value["defaultValue"] === "string");

/** Whether a value is a note with a reason: what the reference reads first. */
const isNote = (value: unknown): boolean => isRecord(value) && typeof value["reason"] === "string";

/** Whether a value is one prop's docs. */
const isPropDocs = (value: unknown): value is PropDocs =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  PROP_KINDS.some((kind) => kind === value["kind"]) &&
  typeof value["type"] === "string" &&
  typeof value["description"] === "string" &&
  typeof value["isRequired"] === "boolean" &&
  (value["canTakeText"] === undefined || typeof value["canTakeText"] === "boolean") &&
  (value["group"] === undefined || typeof value["group"] === "string") &&
  (value["token"] === undefined || typeof value["token"] === "string") &&
  // the plugin's own answer: looked at closer by what reads it, which loads with the first prop that has one
  (value["shape"] === undefined ||
    (isRecord(value["shape"]) && typeof value["shape"]["kind"] === "string")) &&
  (value["members"] === undefined ||
    (Array.isArray(value["members"]) && value["members"].every(isMemberDocs))) &&
  // the plugin's own answers, read by the reference, which loads later and draws only the reasons it knows
  (value["onlyWhen"] === undefined ||
    (isRecord(value["onlyWhen"]) &&
      typeof value["onlyWhen"]["prop"] === "string" &&
      Array.isArray(value["onlyWhen"]["values"]))) &&
  (value["notes"] === undefined || (Array.isArray(value["notes"]) && value["notes"].every(isNote)));

/** Whether a value is a subcomponent's docs. */
const isSubcomponentDocs = (value: unknown): value is SubcomponentDocs =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  typeof value["description"] === "string" &&
  Array.isArray(value["props"]) &&
  value["props"].every(isPropDocs);

/** Whether a value is a signature's docs. */
const isFunctionSignatureDocs = (value: unknown): value is FunctionSignatureDocs =>
  isRecord(value) &&
  typeof value["returns"] === "string" &&
  typeof value["returnsDescription"] === "string" &&
  isStringList(value["typeParameters"]) &&
  Array.isArray(value["parameters"]) &&
  value["parameters"].every(
    (parameter: unknown) =>
      isRecord(parameter) &&
      typeof parameter["name"] === "string" &&
      typeof parameter["type"] === "string" &&
      typeof parameter["description"] === "string" &&
      typeof parameter["isOptional"] === "boolean" &&
      typeof parameter["isRest"] === "boolean"
  );

/**
 * Whether a value received from the plugin is a component's docs.
 *
 * @param value - the module's default export.
 */
export const isComponentDocs = (value: unknown): value is ComponentDocs =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  typeof value["description"] === "string" &&
  typeof value["summary"] === "string" &&
  Array.isArray(value["props"]) &&
  value["props"].every(isPropDocs) &&
  isStringList(value["parts"]) &&
  Array.isArray(value["subcomponents"]) &&
  value["subcomponents"].every(isSubcomponentDocs) &&
  (value["signature"] === undefined || isFunctionSignatureDocs(value["signature"])) &&
  (value["selector"] === undefined || typeof value["selector"] === "string") &&
  (value["propsNote"] === undefined || isNote(value["propsNote"]));
