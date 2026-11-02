/**
 * Where a component's documentation file sits: read apart from the page, so asking whether a component has one loads
 * neither Markdown nor the highlighter.
 *
 * @module
 */
import { basename } from "node:path";

import { VITE_PATHS } from "./vitePaths.ts";

/**
 * The documentation file beside a story file: its component's name in kebab case, with `.md`, in Vite's form.
 *
 * @param storyFile - the story file's absolute path.
 */
export const pageFileOf = (storyFile: string): string => {
  const component = basename(storyFile).replace(/\.stories\.tsx?$/, "");
  const kebab = component.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return VITE_PATHS.join(VITE_PATHS.dirname(storyFile), `${kebab}.md`);
};
