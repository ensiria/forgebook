/**
 * A custom control's contract: a module a catalogue or a library's preset registers by name (`argControls`) and a story
 * uses as `argTypes: { x: { control: "name" } }`, or that takes the props of a type in every story (`matches`); and its
 * frame module, which turns the control's value into the story's.
 *
 * @remarks
 * `mount` rather than a component, so a team writes one in whatever its stories are written in: the shell knows nothing of
 * how it draws. The value is always JSON with a declared schema, so a link keeps working and an agent can set it with no
 * UI. The module runs in the shell's page, with a plugin's trust; the frame module in the stories' frames, as a preview.
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
  /**
   * The control's texts as the catalogue words them: its `strings` (a preset's, then the catalogue's own over them) whose
   * key starts with `argControls.<name>.`, by the rest of the key (`none` for `argControls.icon.none`). A control falls
   * back to its own words for a key it does not find. Always given by the panel; optional so a control's own tests need
   * not build it.
   */
  readonly strings?: Readonly<Record<string, string>>;
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
  /**
   * The code a value is written as in the story's code (the Code tab, `forgebook story`), when it is not the value as
   * JSON: the expression the attribute holds, `IconStar` for the icon the name `"IconStar"` gives the story (written
   * `icon={IconStar}`). None, or `undefined` for a value, writes the JSON value. Runs in the page and on the dev server,
   * so it reads nothing of either.
   *
   * @param value - the panel's value.
   * @param argType - what the story says of the arg.
   * @returns the expression, as code.
   */
  readonly toCode?: (value: JsonValue, argType: ControlArgType) => string | undefined;
};

/** What a frame module is told of the arg whose value it turns into the story's. */
export type FrameArgType = {
  /** The arg's name. */
  readonly name: string;
  /** The control's `settings` the story's `argTypes` write, as JSON; none when they write none. */
  readonly settings?: JsonValue;
};

/** A custom control's frame module: loaded in a story's frame when the panel first gives it a value of that control. */
export type ArgControlFrameModule = {
  /**
   * The value the story receives for the panel's: a name turned into the component it names, say. Links and agents keep
   * the JSON value; this runs only in the frame, after the shell checked the value against the control's schema. A link
   * chose it, so read it as any JSON: look a name up among your own entries (`Object.hasOwn`), never through a prototype.
   *
   * @param value - the panel's value, as JSON.
   * @param argType - the arg.
   * @returns what the story receives; `undefined` gives the story no value.
   */
  readonly toStoryValue: (value: JsonValue, argType: FrameArgType) => unknown;
  /**
   * The panel's value for a value the story gives itself (the icon its `args` name back into its name), so the control
   * shows what the story draws; none leaves the control without one, as for any value JSON cannot hold.
   *
   * @param value - the story's own value.
   * @param argType - the arg.
   * @returns the panel's value, which the control's schema must take; `undefined` when it has none.
   */
  readonly toPanelValue?: (value: unknown, argType: FrameArgType) => JsonValue | undefined;
};
