/**
 * The provider Spectrum's Storybook addon puts around every story, without its addon's channel, which only Storybook
 * has at run time.
 *
 * @module
 */
import { defaultTheme, Provider } from "@adobe/react-spectrum";

/** Every story inside Spectrum's provider and its default theme. */
export const decorators = [(story) => <Provider theme={defaultTheme}>{story()}</Provider>];
