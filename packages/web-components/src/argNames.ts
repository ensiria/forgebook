/**
 * What an arg of a Web Components story sets on its element, read from its name the way Lit's templates write a binding:
 * `label` an attribute, `.items` a property, `@change` an event, `#icon` a slot (`#default` the unnamed one). A plain
 * name with a capital (`primaryColor`) is a property too, since no attribute has one.
 *
 * @remarks
 * An element takes a value in three ways that HTML tells apart and a plain object of args does not: an attribute, which
 * is text and can be written in HTML; a property, which takes any value; and the light DOM it lays out in its slots. An
 * event is listened to, not set. The prefix says which, so the renderer, the code writer and the docs agree without
 * reading the element's class: the docs name a property with no attribute `.name` and an attribute by its own name
 * (`max-length`, not `maxLength`), so a story's args are what its HTML says.
 *
 * Free of Lit and of the DOM, since the shell's code writer reads it too and the shell loads neither. Pure.
 *
 * @module
 */

/** The name of the args that fill the unnamed slot: `#default`. */
export const DEFAULT_SLOT = "default";

/** What an arg sets, and on which name. */
export type ArgTarget = {
  /**
   * How the element takes it: an attribute (a plain name), a property (`.name`), an event listened to (`@name`) or the
   * content of a slot (`#name`); `refused` for a name no arg may set (`REFUSED_PROPERTIES`, an `on…` attribute).
   */
  readonly kind: "attribute" | "property" | "event" | "slot" | "refused";
  /** The attribute's, property's, event's or slot's own name, without its prefix; `default` for the unnamed slot. */
  readonly name: string;
};

/**
 * The properties no arg sets, as a plain name or as `.name`: they write HTML or reach an object's prototype. Args also
 * come from a catalogue's address (a shared link with `?args=`), so a link must not be able to run a script in the
 * catalogue's page; an element's own API never needs them.
 */
const REFUSED_PROPERTIES: ReadonlySet<string> = new Set([
  "innerHTML",
  "outerHTML",
  "srcdoc",
  "__proto__",
  "constructor",
  "prototype"
]);

/**
 * An attribute that may hold an event handler's code (`onclick`, `onfocus`), which no arg sets, for the reason the
 * properties above are refused: a listener is an `@name` arg. HTML's handlers are `on` and letters, so a hyphenated name
 * (`one-line`) is an attribute like any other.
 */
const HANDLER_ATTRIBUTE = /^on[a-z]+$/i;

/**
 * What an arg sets.
 *
 * @param arg - the arg's name, as a story's args write it.
 */
export const argTarget = (arg: string): ArgTarget => {
  const name = arg.slice(1);
  if (REFUSED_PROPERTIES.has(arg) || HANDLER_ATTRIBUTE.test(arg)) return { kind: "refused", name: arg };
  if (arg.startsWith(".") && REFUSED_PROPERTIES.has(name)) return { kind: "refused", name };
  if (arg.startsWith(".") && name !== "") return { kind: "property", name };
  if (arg.startsWith("@") && name !== "") return { kind: "event", name };
  if (arg.startsWith("#") && name !== "") return { kind: "slot", name };
  // HTML lowercases an attribute's name, so a capital says a field (`primaryColor`), which Storybook sets as a property
  if (/[A-Z]/.test(arg)) return { kind: "property", name: arg };
  return { kind: "attribute", name: arg };
};

/**
 * The arg that sets a property with no attribute.
 *
 * @param property - the property's name.
 */
export const propertyArg = (property: string): string => `.${property}`;

/**
 * The arg that listens to an event: a recorded event in the catalogue.
 *
 * @param event - the event's name, as the element dispatches it.
 */
export const eventArg = (event: string): string => `@${event}`;

/**
 * The arg that fills a slot.
 *
 * @param slot - the slot's name; empty for the unnamed slot.
 */
export const slotArg = (slot: string): string => `#${slot === "" ? DEFAULT_SLOT : slot}`;

/** A custom element's name as HTML defines it, kept to ASCII: lowercase, starting with a letter, with a hyphen. */
const ELEMENT_NAME = /^[a-z][a-z0-9._]*(?:-[a-z0-9._]*)+$/;

/**
 * Whether a text is a custom element's name: what a meta's `component` may be, as Storybook's Web Components stories
 * write it (`component: "my-button"`).
 *
 * @param name - the text.
 */
export const isElementName = (name: string): boolean => ELEMENT_NAME.test(name);

/**
 * An attribute's name as the renderer and the code writer write one: letters, digits, `-`, `_`, `.` and `:`, starting
 * with a letter, `_` or `:` (`aria-label`, `data-id`, `xml:lang`). HTML allows more, but such a name is joined into
 * markup, so nothing that could end it passes.
 */
const ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_.:]*$/;

/**
 * Whether a text can be written as an attribute's name.
 *
 * @param name - the text.
 */
export const isAttributeName = (name: string): boolean =>
  ATTRIBUTE_NAME.test(name) && !HANDLER_ATTRIBUTE.test(name);
