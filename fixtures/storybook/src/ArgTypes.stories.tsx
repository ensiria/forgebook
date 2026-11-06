/**
 * Arg types the Storybook way: controls of every kind, labels, a mapping and a hidden arg, over a story that has no
 * typed component, so the panel shows them alone.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

/** The args the story draws. */
type Args = {
  readonly tone: string;
  readonly size: string;
  readonly sides: readonly string[];
  readonly volume: number;
  readonly color: string;
  readonly at: number;
  readonly icon: string;
  readonly secret: string;
};

const meta = {
  title: "Storybook/Arg types",
  render: (args) => <output data-testid="args">{JSON.stringify(args)}</output>,
  args: {
    tone: "calm",
    size: "m",
    sides: ["top"],
    volume: 4,
    color: "#336699",
    at: Date.UTC(2026, 0, 2, 3, 4),
    icon: "none",
    secret: "hidden"
  },
  argTypes: {
    tone: { control: "select", options: ["calm", "loud", "angry"], description: "How the story sounds." },
    size: {
      control: { type: "inline-radio", labels: { s: "Small", m: "Medium", l: "Large" } },
      options: ["s", "m", "l"]
    },
    sides: { control: "check", options: ["top", "end", "bottom", "start"] },
    volume: { control: { type: "range", min: 0, max: 10, step: 2 } },
    color: { control: "color" },
    at: { control: "date", name: "When" },
    icon: { options: ["none", "star", "heart"], mapping: { none: "", star: "★", heart: "♥" } },
    secret: { table: { disable: true } }
  }
} satisfies Meta<Args>;

export default meta;

/** Every control of the panel, drawn from the story's arg types. */
export const Controls: StoryObj<typeof meta> = {};

/** Args the panel shows only while another arg, or a global, has a value: `if`, as Storybook writes it. */
export const Conditional: StoryObj<typeof meta> = {
  argTypes: {
    secret: { control: "text", table: { disable: false }, if: { arg: "tone", eq: "loud" } },
    icon: { if: { global: "theme", eq: "dark" } }
  }
};
