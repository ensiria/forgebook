/**
 * The types of the play tools a project gets by installing Testing Library: imported once, as
 * `import "@forgebook/story-format/testing-library"`, it adds `canvas` and `userEvent` to every play function's
 * context.
 *
 * @remarks
 * Forgebook depends on no testing library; when the project installs `@testing-library/dom` and
 * `@testing-library/user-event`, the catalogue's frame hands every play `canvas` (Testing Library's queries bound to the
 * story's canvas, as Storybook's) and `userEvent`. Without them, importing this module fails to type-check, as the
 * frame would have nothing to hand.
 *
 * @module
 */
import type { BoundFunctions, queries } from "@testing-library/dom";
import type { UserEvent } from "@testing-library/user-event";

declare module "./csf" {
  /** The play tools Testing Library gives. */
  interface StoryPlayTools {
    /** Testing Library's queries, bound to the story's canvas (`canvas.getByRole("button")`). */
    readonly canvas: BoundFunctions<typeof queries>;
    /** Testing Library's user events (`await userEvent.click(button)`). */
    readonly userEvent: UserEvent;
  }
}
