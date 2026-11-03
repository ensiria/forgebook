/**
 * Storybook's preview hooks, as a story file written for Storybook uses them: a decorator that follows one arg with
 * another (`useArgs` in an effect), and a render that changes an arg when it is clicked.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs, useEffect, useRef } from "storybook/preview-api";

/** The args the story draws. */
type Args = {
  readonly kind: string;
  readonly name: string;
  readonly count: number;
};

/** The name each kind starts with. */
const NAMES: Readonly<Record<string, string>> = { user: "monalisa", bot: "dependabot" };

const meta = {
  title: "Storybook/Preview hooks",
  args: { kind: "user", name: "monalisa", count: 0 },
  argTypes: {
    kind: { control: "select", options: ["user", "bot"] },
    name: { control: "text" },
    count: { control: "number" }
  },
  decorators: [
    (Story, context) => {
      const [args, updateArgs] = useArgs<Args>();
      const kind = useRef(args.kind);
      useEffect(() => {
        if (args.kind === kind.current) return;
        kind.current = args.kind;
        updateArgs({ name: NAMES[args.kind] ?? "" });
      }, [args.kind, updateArgs]);
      return <Story {...context} />;
    }
  ],
  render: (args) => {
    const [, updateArgs] = useArgs<Args>();
    return (
      <div>
        <output data-testid="args">{JSON.stringify(args)}</output>
        <button type="button" onClick={(): void => updateArgs({ count: args.count + 1 })}>
          Add
        </button>
      </div>
    );
  }
} satisfies Meta<Args>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The decorator and the render on the story's own args. */
export const Synced: Story = {};
