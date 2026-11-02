/**
 * Aksel's Storybook preview, as Forgebook reads one.
 *
 * @remarks
 * The preview is written with `definePreview`, whose result keeps what it was given in `input`: its decorators,
 * parameters and globals, which a preview of plain annotations exports at its top. Its last decorator is
 * `withThemeByClassName` of Storybook's themes addon, which runs on Storybook's preview hooks and throws anywhere else:
 * it is replaced by what it does with the default theme, the class `light` on the root element.
 *
 * @module
 */
import type { ReactNode } from "react";

import preview from "../.storybook/preview";

/** The decorators Aksel writes itself: the font, and its provider or the web component around the story. */
const AKSEL_DECORATORS = 2;

/** The themes addon's decorator, with the theme it starts on. */
const lightTheme = (story: () => ReactNode): ReactNode => {
  document.documentElement.classList.add("light");
  return story();
};

/** Aksel's decorators, its theme set as the addon sets it. */
export const decorators = [...(preview.input.decorators ?? []).slice(0, AKSEL_DECORATORS), lightTheme];

/** What else the preview was given. */
export const { parameters, globalTypes, initialGlobals } = preview.input;
