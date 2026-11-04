/**
 * The fixture component's stories.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";
import type { StoryContext } from "@forgebook/story-format/csf";
import { storyText } from "@forgebook/story-format/texts";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { Select, type SelectProps } from "./Select";
import { SelectGroup } from "./SelectGroup";

export default {
  title: "Inputs/Selection/Select",
  component: Select,
  subcomponents: { SelectGroup },
  // listed among the forms too, and linked to the page: the sidebar's alias entry and the header's related links
  alsoIn: ["Forms/Fields"],
  related: ["Foundations/Page"],
  args: { options: ["weekly", "monthly"], value: "weekly" },
  // its texts listed before its behaviour, though its props name Behaviour first
  parameters: { propGroups: ["Texts"] }
} satisfies Meta<typeof Select>;

/** The default select. */
export const Overview: Story<typeof Select> = {};

/** The small size: a story drawn from its args, over the meta's. */
export const Small: Story<typeof Select> = {
  args: { size: "sm" },
  parameters: {
    group: "states",
    design: { figma: "https://www.figma.com/design/FixtureFile123/Kit?node-id=56-78" }
  }
};

/**
 * The select in a row of its own: a story with a render, which the Code tab shows as written, and the component
 * page's demo.
 */
export const InRow: Story<typeof Select> = {
  render: (args: Partial<SelectProps>, { text }: StoryContext<Partial<SelectProps>>): ReactNode => (
    <div>
      <span>{text("select.inRow.caption")}</span>
      <Select options={["weekly", "monthly"]} {...args} />
      <span>{text("select.inRow.count", { count: 2 })}</span>
    </div>
  ),
  parameters: { group: "in-context", main: true }
};

/** A hint named by its text key: the story shows it in the chosen language, the panel shows it with its key. */
export const Hinted: Story<typeof Select> = {
  args: { hint: storyText("select.hint") },
  parameters: { group: "states" }
};

/** A list mounted beside the story's root, as a popover's portal is: the measuring tools reach it too. */
export const WithPopup: Story<typeof Select> = {
  render: (args: Partial<SelectProps>): ReactNode => (
    <>
      <Select options={["weekly", "monthly"]} {...args} />
      {typeof document === "undefined"
        ? null
        : createPortal(<ul data-testid="popup">{"Weekly"}</ul>, document.body)}
    </>
  ),
  parameters: { group: "behaviour" }
};

/** A story that throws while it renders: the frame shows the error, never an empty frame. */
export const Throws: Story<typeof Select> = {
  render: () => {
    throw new Error("The fixture story threw");
  },
  parameters: { group: "worst-case", controls: false }
};

/** A play function in two named steps: the Interactions tab lists them. */
export const Played: Story<typeof Select> = {
  play: async ({ canvasElement, step }: StoryContext<Partial<SelectProps>>): Promise<void> => {
    await step("find the select", () => {
      if (canvasElement.querySelector("select") === null) throw new Error("No select");
    });
    await step("read its value", () => undefined);
  },
  parameters: { group: "behaviour" }
};

/**
 * A list fixed under the select, as an overlay's portal places it, and a note pinned to the window's foot: the list
 * reaches past a frame as tall as the story, the note follows the window.
 */
const OverlayScene = (args: Partial<SelectProps>): ReactNode => (
  <>
    <Select options={["weekly", "monthly"]} {...args} />
    {typeof document === "undefined"
      ? null
      : createPortal(
          <>
            <ul
              data-testid="overlay"
              style={{ position: "fixed", top: 48, left: 24, height: 200, margin: 0 }}
            >
              {"Weekly"}
            </ul>
            <p data-testid="pinned" style={{ position: "fixed", bottom: 0, left: 24, margin: 0 }}>
              {"Saved"}
            </p>
          </>,
          document.body
        )}
  </>
);

/** A list left open past a frame as tall as the story: the story checks flag it. */
export const OverlayPast: Story<typeof Select> = {
  render: (args: Partial<SelectProps>): ReactNode => <OverlayScene {...args} />,
  parameters: { group: "behaviour" }
};

/** The same list, with the room its scene needs declared: the frame has it from the start. */
export const OverlayInRoom: Story<typeof Select> = {
  render: (args: Partial<SelectProps>): ReactNode => <OverlayScene {...args} />,
  parameters: { group: "behaviour", height: 280 }
};
