/**
 * The fixture catalogue's languages: Italian, whose story texts the fixture kit has, and a pseudo-language; the kit
 * has no library provider, so each draws the story as it is.
 *
 * @module
 */
import type { StoryLanguage } from "@forgebook/react";
import type { ReactNode } from "react";

/** Draws a story as it is. */
const asItIs = (story: ReactNode): ReactNode => story;

/** The languages, for the shell and the frame. */
export const LANGUAGES: readonly StoryLanguage[] = [
  { id: "it", label: "Italiano", wrap: asItIs },
  { id: "pseudo", label: "Pseudo", isPseudo: true, wrap: asItIs }
];
