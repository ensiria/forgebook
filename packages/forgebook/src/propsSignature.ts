/**
 * The props a story file was written for, as a short signature `forgebook new` writes in the file and `changed` reads back:
 * when the component's props no longer give the same signature, the file's args may pass a prop that is gone or miss one
 * that is now required, and nothing else would say so (a framework ignores an unknown prop, and a new optional one is
 * simply never shown).
 *
 * @remarks
 * Pure, and the same on every system: the props' names, whether each is required, and their types as the docs extractor
 * writes them, sorted by name, hashed with FNV-1a. A change of description or default leaves it alone, since the file's
 * args do not depend on them. The type is the extractor's text: a change inside a named type a prop uses is not seen, and
 * a version of the extractor that writes a type differently changes the signature, which `verify` then asks to confirm.
 *
 * @module
 */
import type { PropDocs } from "./componentDocs.ts";

/** The comment's word, followed by `: ` and the signature. */
export const PROPS_MARKER = "forgebook-props";

/** The marker line as `forgebook new` writes it, one per file, read back by its first words. */
const MARKER_LINE = new RegExp(`^// ${PROPS_MARKER}: ([0-9a-f]{8})\\b`, "m");

/**
 * The FNV-1a hash of a text, as eight hexadecimal digits.
 *
 * @param text - the text.
 */
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * The signature of a component's props.
 *
 * @param props - the props, as the docs extractor reads them.
 * @returns eight hexadecimal digits.
 */
export const propsSignature = (props: readonly PropDocs[]): string =>
  fnv1a(
    props
      .map((prop) => `${prop.name}${prop.isRequired ? "" : "?"}:${prop.type}`)
      .sort()
      .join("\n")
  );

/**
 * The line `forgebook new` writes in a story file.
 *
 * @param signature - the props' signature.
 */
export const propsMarkerLine = (signature: string): string =>
  `// ${PROPS_MARKER}: ${signature} (the props these stories were written for; verify says when they change)`;

/**
 * The signature a story file says it was written for.
 *
 * @param text - the story file's text.
 * @returns the signature; none when the file has no marker line.
 */
export const writtenSignature = (text: string): string | undefined => MARKER_LINE.exec(text)?.[1];
