/**
 * The provider Fluent UI's Storybook addon puts around every story.
 *
 * @module
 */
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

/** Every story inside Fluent's provider and its light theme. */
export const decorators = [(story) => <FluentProvider theme={webLightTheme}>{story()}</FluentProvider>];
