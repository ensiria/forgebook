/**
 * A story in plain JavaScript, typed by nothing: the panel shows the args its `argTypes` describe.
 *
 * @module
 */
export default {
  title: "Cards/Tile",
  render: (args) => `<div class="tile" data-testid="tile" data-size="${args.size}">${args.text}</div>`,
  argTypes: {
    text: { control: "text", description: "What the tile says." },
    size: { control: "radio", options: ["small", "large"] }
  },
  args: { text: "A tile", size: "small" }
};

/** A tile. */
export const Default = {};
