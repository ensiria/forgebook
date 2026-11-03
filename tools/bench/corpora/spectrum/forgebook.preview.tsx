/**
 * What Spectrum's Storybook addons put around every story, without their channel, which only Storybook has at run time:
 * the provider with its default theme, and the scrolling addon's wrapper, which a story styles by its class.
 *
 * @module
 */
import { defaultTheme, Provider } from "@adobe/react-spectrum";

/** Every story inside Spectrum's provider and its default theme, in the scrolling addon's wrapper. */
export const decorators = [
  (story) => (
    <Provider theme={defaultTheme}>
      <div className="react-spectrum-story">{story()}</div>
    </Provider>
  )
];
