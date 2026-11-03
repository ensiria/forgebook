/**
 * A story function in a file of its own, which another story file re-exports, as Fluent UI writes its stories: kept out
 * of the catalogue's pattern, since a file without a meta is no story file of its own.
 *
 * @module
 */
import type { ReactNode } from "react";

import { NoteField } from "../src/NoteField";

/** The field, with a label written in this file. */
export const Behind = (): ReactNode => <NoteField label="Written behind a re-export" />;
