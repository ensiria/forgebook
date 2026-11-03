export default {
  title: "Untyped",
  render: (args) => `<p>${args.text}</p>`,
  argTypes: { text: { control: "text" } }
};

export const Default = { args: { text: "A" } };
