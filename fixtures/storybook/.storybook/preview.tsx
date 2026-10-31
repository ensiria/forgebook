/**
 * The Storybook fixture's preview, as a project that moves to Forgebook has it: a toolbar global of its own, read from
 * this source by `forgebook init --from storybook` in the importer's tests.
 *
 * @module
 */
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  globalTypes: {
    density: {
      name: "Density",
      toolbar: {
        title: "Density",
        items: [
          { value: "comfortable", title: "Comfortable" },
          { value: "compact", title: "Compact" }
        ]
      }
    },
    backgrounds: { name: "Backgrounds" }
  },
  initialGlobals: { density: "compact" },
  decorators: [
    (Story, context) => (
      <div data-density={String(context.globals["density"])}>
        <Story />
      </div>
    )
  ]
};

export default preview;
