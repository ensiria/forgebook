/**
 * A `file` control: small files kept as `data:` addresses, since the value must be JSON a link can hold. A file too large
 * for an address, or of a type a browser would run as a page, is refused with the reason, as the check on a link would
 * refuse it (`addressArgs.ts`).
 *
 * @module
 */
import { type ChangeEvent, type ReactNode, useState } from "react";

import { type ArgValue, isChoiceList } from "../../messages.ts";
import { isFileText, MOST_FILE_TEXT } from "../../shapeValues.ts";
import { Icon } from "../icons.tsx";
import { EDITOR_STRINGS } from "./editorStrings.ts";

/** A file as a `data:` address. */
const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = (): void => reject(new Error(file.name));
    reader.readAsDataURL(file);
  });

/** A length in bytes, for a person. */
const sizeText = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

/** What a kept file is, from its address. */
const fileLine = (text: string): string => {
  const comma = text.indexOf(",");
  const type = text.slice(5, comma).split(";")[0] ?? "";
  // what base64 holds: three bytes for each four characters
  return EDITOR_STRINGS.fileLine(type, sizeText(Math.floor(((text.length - comma - 1) * 3) / 4)));
};

/** The file control's props. */
export type FileEditorProps = {
  /** The field's name. */
  readonly label: string;
  /** The element that describes it. */
  readonly describedBy: string;
  /** The files it takes, as `<input accept>` writes it. */
  readonly accept: string | undefined;
  /** The kept files. */
  readonly value: ArgValue | undefined;
  /** Called with the kept files; none when none is left. */
  readonly onChange: (value: readonly string[] | undefined) => void;
};

/**
 * The file control.
 *
 * @param props - the field's name, what it takes, and the kept files.
 */
export const FileEditor = ({ label, describedBy, accept, value, onChange }: FileEditorProps): ReactNode => {
  const files = isChoiceList(value) ? value.filter((each) => typeof each === "string") : [];
  const [problems, setProblems] = useState<readonly string[]>([]);
  const add = async (chosen: readonly File[]): Promise<void> => {
    const kept: string[] = [];
    const refused: string[] = [];
    for (const file of chosen) {
      try {
        const text = await readFile(file);
        if (text.length > MOST_FILE_TEXT)
          refused.push(EDITOR_STRINGS.fileTooLarge(file.name, sizeText((MOST_FILE_TEXT * 3) / 4)));
        else if (isFileText(text)) kept.push(text);
        else refused.push(EDITOR_STRINGS.fileRefused(file.name));
      } catch {
        refused.push(EDITOR_STRINGS.fileFailed(file.name));
      }
    }
    setProblems(refused);
    if (kept.length > 0) onChange([...files, ...kept]);
  };
  return (
    <div className="forgebook-value-list">
      <input
        type="file"
        multiple
        aria-label={EDITOR_STRINGS.fileChoose(label)}
        aria-describedby={describedBy}
        {...(accept === undefined ? {} : { accept })}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          void add([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      {files.map((file, index) => (
        <div key={file} className="forgebook-value-list__item">
          <span className="forgebook-value-list__field forgebook-value-note">{fileLine(file)}</span>
          <div className="forgebook-value-list__buttons">
            <button
              type="button"
              className="forgebook-prop__action"
              aria-label={EDITOR_STRINGS.fileRemove(EDITOR_STRINGS.itemName(label, index + 1))}
              onClick={(): void => {
                const left = files.filter((_, position) => position !== index);
                onChange(left.length === 0 ? undefined : left);
              }}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      ))}
      {problems.map((problem) => (
        <p key={problem} className="forgebook-value-note" data-tone="problem" role="alert">
          {problem}
        </p>
      ))}
    </div>
  );
};
