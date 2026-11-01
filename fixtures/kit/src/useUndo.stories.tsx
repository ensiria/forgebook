/**
 * The undo hook's stories: stories about logic, a scene that uses the hook and a play that tries it.
 *
 * @module
 */
import type { LogicMeta, LogicStory } from "@forgebook/react";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { ReactNode } from "react";

import { useUndo } from "./useUndo";

export default {
  title: "Hooks/useUndo",
  component: useUndo,
  parameters: { logic: true }
} satisfies LogicMeta<typeof useUndo>;

/** A counter with its history: each step can be undone and redone. */
const Counter = (): ReactNode => {
  const count = useUndo(0);
  return (
    <div>
      <output aria-label="Count">{count.value}</output>
      <button type="button" onClick={(): void => count.set(count.value + 1)}>
        Add one
      </button>
      <button type="button" onClick={count.undo} disabled={!count.canUndo}>
        Undo
      </button>
      <button type="button" onClick={count.redo} disabled={!count.canRedo}>
        Redo
      </button>
    </div>
  );
};

/**
 * The button named so in a canvas.
 *
 * @param canvas - the story's canvas.
 * @param name - the button's text.
 */
const buttonOf = (canvas: HTMLElement, name: string): HTMLButtonElement => {
  const button = [...canvas.querySelectorAll("button")].find((each) => each.textContent === name);
  if (button === undefined) throw new Error(`No button "${name}"`);
  return button;
};

/** Two steps added, one undone, then redone: the count follows the history. */
export const History: LogicStory = {
  render: (): ReactNode => <Counter />,
  play: async ({ canvasElement, step }: StoryContext<Readonly<Record<string, never>>>): Promise<void> => {
    const countOf = (): string => canvasElement.querySelector("output")?.textContent ?? "";
    const settled = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));
    await step("add two", async () => {
      buttonOf(canvasElement, "Add one").click();
      await settled();
      buttonOf(canvasElement, "Add one").click();
      await settled();
      if (countOf() !== "2") throw new Error(`The count is ${countOf()}, not 2`);
    });
    await step("undo one", async () => {
      buttonOf(canvasElement, "Undo").click();
      await settled();
      if (countOf() !== "1") throw new Error(`The count is ${countOf()}, not 1`);
    });
    await step("redo it", async () => {
      buttonOf(canvasElement, "Redo").click();
      await settled();
      if (countOf() !== "2") throw new Error(`The count is ${countOf()}, not 2`);
    });
  }
};
