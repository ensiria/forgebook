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
};

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

/** Whether a value is one prop's docs. */
const isPropDocs = (value: unknown): value is PropDocs =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  PROP_KINDS.some((kind) => kind === value["kind"]) &&
  typeof value["type"] === "string" &&
  typeof value["description"] === "string" &&
  typeof value["isRequired"] === "boolean" &&
  (value["canTakeText"] === undefined || typeof value["canTakeText"] === "boolean");

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
  (value["signature"] === undefined || isFunctionSignatureDocs(value["signature"]));
