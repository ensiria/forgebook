/**
 * The shell's keys: `/` goes to the search, `[` and `]` open the previous and the next story in the sidebar's order.
 * A key typed into a field, or with a modifier, is the field's or the browser's.
 *
 * @remarks
 * The keys work while the shell has the focus; a frame keeps its own keys, so a story's keyboard behaviour is never
 * taken over. Pure, apart from reading the event's target.
 *
 * @module
 */

/** The inputs that take no text: a key pressed on one is the page's, not the field's. */
const NOT_TEXT_INPUTS = ["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"];

/**
 * Whether a key event happens while the user types: in a field that takes text, a select or editable content. A
 * toolbar's segment (a radio) or a toggle keeps the page's keys, so they work right after a press on one.
 *
 * @param target - the event's target.
 */
export const isTyping = (target: EventTarget | null): boolean =>
  typeof HTMLElement !== "undefined" &&
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    (target instanceof HTMLInputElement && !NOT_TEXT_INPUTS.includes(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement);

/** The move a key asks for in the list of stories. */
export type StoryStep = -1 | 1;

/**
 * The step a key asks for: `[` the previous story, `]` the next; none for any other key or one with a modifier.
 *
 * @param event - the key, its modifiers and its target.
 */
export const storyStep = (
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">
): StoryStep | undefined => {
  if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return undefined;
  if (event.key === "[") return -1;
  if (event.key === "]") return 1;
  return undefined;
};

/**
 * The id a step leads to: the neighbour of the current story, or the first (or last) story from a page that is not
 * a story's; none past either end.
 *
 * @param ids - every story's id, in the sidebar's order.
 * @param currentId - the shown story's id; none on a component's page.
 * @param step - the step.
 * @param firstOfPage - on a component's page, the id of its first story.
 */
export const steppedStory = (
  ids: readonly string[],
  currentId: string | undefined,
  step: StoryStep,
  firstOfPage: string | undefined
): string | undefined => {
  if (currentId === undefined) return firstOfPage;
  const index = ids.indexOf(currentId);
  return index === -1 ? undefined : ids[index + step];
};
