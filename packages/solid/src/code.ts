/**
 * The code writer a Solid catalogue's shell writes a story's code with: the JSX every framework written in JSX shares
 * (`forgebook/jsx-code`), under the name the generated pages import.
 *
 * @module
 */
import { jsxCode } from "forgebook/jsx-code";
import type { StoryCodeWriter } from "forgebook/renderer";

/** The code writer a Solid catalogue's shell writes a story's code with. */
export const codeOf: StoryCodeWriter = jsxCode;
