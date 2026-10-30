/**
 * The framework's code writer, as the shell's components read it: given once by the app (`mountShell`), so the shell
 * writes a story drawn from its args in the framework's syntax without knowing the framework.
 *
 * @module
 */
import { createContext, useContext } from "react";

import type { StoryCodeWriter } from "../frame/renderer.ts";

/** Writes nothing until the app gives the framework's writer. */
const NO_WRITER: StoryCodeWriter = (): string => "";

/** The framework's code writer. */
export const CodeWriterContext = createContext<StoryCodeWriter>(NO_WRITER);

/** The framework's code writer, as the app gave it. */
export const useCodeWriter = (): StoryCodeWriter => useContext(CodeWriterContext);
