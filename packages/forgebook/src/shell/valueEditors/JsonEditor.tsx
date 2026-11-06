/**
 * A value typed as JSON: the way out for what cannot be drawn as fields, and for pasting a whole value. What does not
 * parse, or is not what the prop takes, stays in the field with the reason beside it and never reaches the story.
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useId, useState } from "react";

import { type ArgValue, isArgValue } from "../../messages.ts";
import { isValueOfShape } from "../../shapeValues.ts";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { FieldProps } from "./fieldTypes.ts";

/** A value as the field writes it. */
const jsonText = (value: ArgValue | undefined): string =>
  value === undefined ? "" : JSON.stringify(value, null, 2);

/** What a text says: the value it writes, or why it is not one. */
const readJson = (
  text: string,
  { shape, namedValues }: Pick<FieldProps, "shape" | "namedValues">
): { readonly value: ArgValue | undefined } | { readonly problem: string } => {
  if (text.trim() === "") return { value: undefined };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { problem: EDITOR_STRINGS.jsonInvalid(error instanceof Error ? error.message : String(error)) };
  }
  if (!isArgValue(parsed)) return { problem: EDITOR_STRINGS.jsonRefused };
  return isValueOfShape(shape, parsed, namedValues)
    ? { value: parsed }
    : { problem: EDITOR_STRINGS.jsonMisfit };
};

/**
 * A value's JSON field.
 *
 * @param props - the field's props.
 */
export const JsonEditor = ({
  shape,
  value,
  label,
  describedBy,
  namedValues,
  onChange
}: FieldProps): ReactNode => {
  const problemId = useId();
  const written = jsonText(value);
  const [draft, setDraft] = useState({ text: written, before: written, after: written });
  // a value changed from outside (Reset, the worst case) replaces what was typed; the field's own stays as typed, and so
  // does what its parent did not take (an item of a list cannot be left without a value)
  const text = draft.before === written || draft.after === written ? draft.text : written;
  const read = readJson(text, { shape, namedValues });
  const problem = "problem" in read ? read.problem : undefined;
  return (
    <div className="forgebook-value-json">
      <textarea
        className="forgebook-value-json__text"
        aria-label={label}
        aria-describedby={problem === undefined ? describedBy : problemId}
        aria-invalid={problem !== undefined}
        spellCheck={false}
        rows={Math.min(12, Math.max(3, text.split("\n").length))}
        value={text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
          const next = event.target.value;
          const nextRead = readJson(next, { shape, namedValues });
          const after = "value" in nextRead ? jsonText(nextRead.value) : written;
          setDraft({ text: next, before: written, after });
          if ("value" in nextRead) onChange(nextRead.value);
        }}
      />
      {problem === undefined ? null : (
        <p id={problemId} className="forgebook-value-note" data-tone="problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
};
