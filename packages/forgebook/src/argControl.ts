/**
 * A custom control's contract: a module a catalogue registers by name (`argControls` in `forgebook.config`) and a story
 * uses as `argTypes: { x: { control: "name" } }`.
 *
 * @remarks
 * `mount` rather than a component, so a team writes one in whatever its stories are written in: the shell knows nothing of
 * how it draws. The value is always JSON with a declared schema, so a link keeps working and an agent can set it with no
 * UI. The module runs in the shell's page, with a plugin's trust.
 *
 * @module
 */
import type { JsonValue } from "./plugin.ts";

/** The types a value may be, as JSON Schema names them. */
export type SchemaType = "string" | "number" | "integer" | "boolean" | "null" | "object" | "array";

/**
 * What a custom control's value looks like: a part of JSON Schema. A keyword outside this type is refused rather than
 * ignored: a schema that says less than it seems to would let a link through.
 */
export type ValueSchema = {
  /** What it is, for a reader. */
  readonly title?: string;
  /** What it is for, for a reader. */
  readonly description?: string;
  /** What it holds at first, for a reader. */
  readonly default?: unknown;
  /** Its type, or the types it may be. */
  readonly type?: SchemaType | readonly SchemaType[];
  /** The values it may be. */
  readonly enum?: readonly unknown[];
  /** The one value it may be. */
  readonly const?: unknown;
  /** A number's lowest value. */
  readonly minimum?: number;
  /** A number's highest value. */
  readonly maximum?: number;
  /** A text's fewest characters. */
  readonly minLength?: number;
  /** A text's most characters. */
  readonly maxLength?: number;
  /** What a text matches: a regular expression with the `u` flag, without a repeat of a repeat, which could hang the page. */
  readonly pattern?: string;
  /** A list's items. */
  readonly items?: ValueSchema;
  /** A list's fewest items. */
  readonly minItems?: number;
  /** A list's most items. */
  readonly maxItems?: number;
  /** An object's fields. */
  readonly properties?: Readonly<Record<string, ValueSchema>>;
  /** The fields an object must give. */
  readonly required?: readonly string[];
  /** Any other field: `false` refuses them, a schema checks them; any by default. */
  readonly additionalProperties?: boolean | ValueSchema;
  /** Schemas of which it must fit at least one. */
  readonly anyOf?: readonly ValueSchema[];
};

/** What a control is told of its arg, from the story's `argTypes` entry. */
export type ControlArgType = {
  /** The arg's name. */
  readonly name: string;
  /** The name the panel shows. */
  readonly label: string;
  /** What the arg does; empty when nothing says. */
  readonly description: string;
  /** The entry's `options`: texts and numbers. */
  readonly options?: readonly (string | number)[];
  /** The control's `min`. */
  readonly min?: number;
  /** The control's `max`. */
  readonly max?: number;
  /** The control's `step`. */
  readonly step?: number;
  /** The control's `settings`: anything of its own, as JSON. */
  readonly settings?: JsonValue;
};

/** What `mount` receives. */
export type ArgControlProps = {
  /** The value to show; none when the prop has none. */
  readonly value: JsonValue | undefined;
  /**
   * Gives the panel a new value, checked against `schema`; none leaves the prop without one. The control keeps what it
   * draws: it is mounted again only when the value changes from outside (Reset, a link).
   */
  readonly onChange: (value: JsonValue | undefined) => void;
  /** What the story says of the arg. */
  readonly argType: ControlArgType;
};

/** A custom control's module. */
export type ArgControlModule = {
  /**
   * Draws the control in an element the shell keeps for it.
   *
   * @param element - where it draws.
   * @param props - its value, how to change it, and what the story says of the arg.
   * @returns what takes it away.
   */
  readonly mount: (element: HTMLElement, props: ArgControlProps) => () => void;
  /** What its value looks like: a link's value and each `onChange` are checked against it. */
  readonly schema: ValueSchema;
};
