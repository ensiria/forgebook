/**
 * The texts a catalogue's address may hand a story whose framework writes texts into markup: plain words only.
 *
 * @remarks
 * A link shares the props panel's values in its address (`?args=`), so whoever writes the link chooses them, and the
 * frame runs on the catalogue's own origin. React and Vue put a text into the page as text; a plain HTML story
 * writes it into an HTML string (`<button class="${tone}">${label}</button>` in a template literal), where `<`, a
 * quote or a `javascript:` address becomes markup or code. So for a framework that says its texts may become markup
 * (`FrameworkAdapter.addressTexts`), a value the address carries reaches the story only when its name and its texts
 * are plain: letters and digits of any script, spaces and a few marks that close no tag, attribute or address. The
 * panel's own edits are the person's and are not checked; a link, or a reload of an edit with markup, falls back to
 * the story's own value, as Storybook's address does. Pure.
 *
 * @module
 */
import { type ArgValue, isNamedArg, type PanelArgs } from "./messages.ts";

/**
 * How a framework's stories take the texts an address carries: `any` where a text stays text (React, Vue), `plain`
 * where a story may write it into markup (an HTML string).
 */
export type AddressTexts = "any" | "plain";

/** A plain text: letters, marks and digits of any script, spaces, and `_ . , ! ? # % + -`. */
const PLAIN_TEXT = /^[\p{L}\p{M}\p{N} _.,!?#%+-]*$/u;

/** A plain name: what a script and an attribute both write bare (`label`, `item-count`, `$size`). */
const PLAIN_NAME = /^[A-Za-z_$][\w$-]*$/;

/**
 * Whether a text can become nothing but text wherever an HTML string puts it: between tags, inside a quoted or bare
 * attribute, as an address.
 *
 * @param text - the text.
 */
export const isPlainText = (text: string): boolean => PLAIN_TEXT.test(text);

/**
 * Whether an address's value can reach a story whose texts may become markup: every text in it plain. A named value is
 * looked up among the source's own values, so its name is never written into the page.
 *
 * @param value - the value.
 */
const isPlainValue = (value: ArgValue): boolean => {
  if (typeof value === "string") return isPlainText(value);
  if (Array.isArray(value)) return value.every((item) => typeof item !== "string" || isPlainText(item));
  return value === null || isNamedArg(value) || typeof value !== "object";
};

/**
 * The address's values a story receives under a framework's rule: all of them, or only those whose texts are plain.
 *
 * @param args - the values the address names.
 * @param addressTexts - the framework's rule.
 */
export const addressArgsFor = (args: PanelArgs, addressTexts: AddressTexts): PanelArgs =>
  addressTexts === "any"
    ? args
    : Object.fromEntries(
        // a name is checked too: a story that spreads its args into attributes writes it into the markup
        Object.entries(args).filter(([name, value]) => PLAIN_NAME.test(name) && isPlainValue(value))
      );
