/**
 * Loaders and beforeEach: what a story needs before it is drawn, and the cleanup that undoes it.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

const meta = {
  title: "Storybook/Loaders",
  loaders: [async () => ({ user: { name: "Ada" } })],
  beforeEach: () => {
    document.documentElement.dataset["fixtureMock"] = "on";
    return () => {
      delete document.documentElement.dataset["fixtureMock"];
    };
  },
  render: (_args, { loaded }) => {
    const user = loaded["user"] as { readonly name: string };
    return (
      <p data-testid="loaded">{`Hello ${user.name}, mock ${document.documentElement.dataset["fixtureMock"] ?? "off"}`}</p>
    );
  }
} satisfies Meta;

export default meta;

/** Drawn from what its loader returned, after its set-up. */
export const Loaded: StoryObj<typeof meta> = {
  loaders: [async () => ({ greeting: "Hi" })],
  play: async ({ loaded }) => {
    await expect(loaded["greeting"]).toBe("Hi");
  }
};
