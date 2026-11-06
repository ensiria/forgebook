/**
 * The texts of the panel's editors that load on use (`PropEditor.tsx`): nested fields, a searchable list, the tokens, the
 * files. They load with the editors, so a catalogue of plain props carries none of them.
 *
 * @remarks
 * Each keeps the plain name it would have in `STRINGS`, so a catalogue replaces it the same way (`lateStrings`).
 *
 * @module
 */
import { lateStrings } from "../strings.ts";

/** The editors' texts, as shown: Forgebook's, with the catalogue's replacements. */
export const EDITOR_STRINGS = lateStrings({
  addItem: (label: string): string => `Add to ${label}`,
  addField: (label: string): string => `Add ${label}`,
  itemName: (label: string, position: number): string => `${label} ${position}`,
  moveUp: (label: string): string => `Move ${label} up`,
  moveDown: (label: string): string => `Move ${label} down`,
  removeItem: (label: string): string => `Remove ${label}`,
  itemMoved: (label: string, position: number, count: number): string =>
    `${label}: now ${position} of ${count}`,
  itemRemoved: (label: string, count: number): string => `${label} removed, ${count} left`,
  emptyList: "No items",
  cannotSet: "It needs what only the source's named values can give, and they name none",
  clearField: (label: string): string => `${label}: no value`,
  fieldName: (label: string): string => `${label}: name`,
  fieldValue: (label: string, name: string): string => `${label} ${name}`,
  nameTaken: "Another field has this name",
  nameRefused: "This name cannot be set from the panel or a link",
  nameEmpty: "A field needs a name",
  newField: "key",
  memberKind: (label: string): string => `${label}: type`,
  memberKinds: {
    text: "Text",
    number: "Number",
    date: "Date",
    boolean: "On or off",
    choice: "Choice",
    list: "List",
    tuple: "List",
    object: "Object",
    record: "Object",
    union: "Choice",
    named: "Named",
    json: "JSON",
    like: "Object"
  },
  editAsJson: "JSON",
  editAsJsonHint: (label: string): string => `Edit ${label} as JSON`,
  jsonInvalid: (reason: string): string => `Not valid JSON: ${reason}`,
  jsonRefused: "It holds a name a value cannot hold (__proto__, constructor, prototype), or nests too deep",
  jsonMisfit: "Valid JSON, but not what this prop takes, or it holds what a link may not give",
  misfitNote: "The story's value does not match this prop's type: it is shown as JSON",
  tooLargeNote: "Too much to show as fields: it is shown as JSON",
  searchEmpty: "Nothing matches",
  searchMore: (count: number): string => `And ${count} more: type to narrow them down`,
  searchClear: "No value",
  searchOptions: (label: string): string => `${label}: options`,
  tokensLoading: "Loading the tokens…",
  tokensFailed: (message: string): string => `The tokens could not be read: ${message}`,
  tokensNone: (asked: string): string => `This catalogue has no ${asked} tokens: type a value`,
  fileChoose: (label: string): string => `${label}: choose files`,
  fileRemove: (name: string): string => `Remove ${name}`,
  fileLine: (type: string, size: string): string => `${type}, ${size}`,
  fileTooLarge: (name: string, most: string): string =>
    `${name} is too large for a link, which holds the file: at most ${most}`,
  fileRefused: (name: string): string => `${name} is of a type a link cannot hold: it could run as a page`,
  fileFailed: (name: string): string => `${name} could not be read`
});
