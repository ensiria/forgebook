/**
 * The sentences the API reference writes under a prop, and under a component that lists none: when a variant's prop can
 * be passed, why a type is not the one its source writes, why no props are listed. Used by `ApiReference.tsx`.
 *
 * @remarks
 * The shell checks these fields loosely when the docs arrive, so a reason it does not know is left out here rather
 * than drawn wrong.
 *
 * @module
 */
import type { ComponentDocs, PropDocs } from "../componentDocs.ts";
import { codeSpan } from "./codeSpans.ts";
import { LATER_STRINGS } from "./laterStrings.ts";

/**
 * A prop's notes, in the order they are drawn: when it can be passed, then each note on its type.
 *
 * @param prop - the prop's condition and notes.
 */
export const propNoteTexts = (prop: Pick<PropDocs, "onlyWhen" | "notes">): string[] => {
  const { onlyWhen } = prop;
  const condition =
    onlyWhen === undefined
      ? []
      : [
          LATER_STRINGS.propOnlyWhen(
            codeSpan(onlyWhen.prop),
            onlyWhen.values.map((value) =>
              codeSpan(typeof value === "string" ? JSON.stringify(value) : String(value))
            ),
            onlyWhen.orOmitted === true
          )
        ];
  const types = (prop.notes ?? []).flatMap((note): string[] => {
    if (note.reason === "generic") {
      return [LATER_STRINGS.propGeneric(codeSpan(note.parameter), codeSpan(note.type), note.shownAs)];
    }
    if (note.reason === "unresolved") return [LATER_STRINGS.propUnresolved(codeSpan(note.name))];
    return note.reason === "any" ? [LATER_STRINGS.propAny] : [];
  });
  return [...condition, ...types];
};

/**
 * Why a component lists no props, or none when its props are read.
 *
 * @param docs - the component's docs.
 */
export const propsNoteText = (docs: Pick<ComponentDocs, "propsNote">): string | undefined => {
  const note = docs.propsNote;
  if (note?.reason === "untyped") return LATER_STRINGS.propsUntyped;
  if (note?.reason === "no-signature") return LATER_STRINGS.propsNoSignature;
  return note?.reason === "outside-package" ? LATER_STRINGS.propsOutsidePackage(note.count) : undefined;
};
