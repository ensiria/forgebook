/**
 * The code writer a React catalogue's shell writes a story's code with: the JSX every framework written in JSX shares
 * (`forgebook/jsx-code`), under the names the generated pages and earlier versions import.
 *
 * @module
 */
import { jsxCode } from "forgebook/jsx-code";
import type { StoryCodeWriter } from "forgebook/renderer";

/**
 * A component's JSX with these args.
 *
 * @param component - the component's name (`IconTile`).
 * @param args - the values, in the order they are written.
 */
export const storyJsx: StoryCodeWriter = jsxCode;

/** The code writer a React catalogue's shell writes a story's code with: the name the generated pages import. */
export const codeOf: StoryCodeWriter = jsxCode;
