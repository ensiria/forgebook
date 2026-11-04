/**
 * The adapter suite's subject for Solid, shared by its page run and its server run: a greeting with a counter of its
 * own, and the decorator the suite wraps it in.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import { THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";
import { createSignal, type JSX } from "solid-js";

/**
 * The subject's story: a greeting with a counter of its own; it throws while drawn for `THROWING_NAME`.
 *
 * @param props - the name, as the story's args carry it.
 */
const Greeting = (props: { readonly name?: unknown }): JSX.Element => {
  const [clicks, setClicks] = createSignal(0);
  // read untracked, as a component's body is: the throw happens when the story is made, as React's and Vue's do
  if (props.name === THROWING_NAME) throw new Error("No greeting");
  return (
    <button type="button" onClick={() => setClicks(clicks() + 1)}>
      Hello {String(props.name)} {clicks()}
    </button>
  );
};

/**
 * A drawing of the greeting.
 *
 * @param name - the name.
 */
export const greetingDrawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: { render: (args: { readonly name?: unknown }) => <Greeting name={args.name} /> }
    },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "kit:kit-greeting--plain", name: "Plain", title: "Kit/Greeting" },
    story,
    args: { name },
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/**
 * Whether what a decorator's `story()` gave, typed `unknown` by the frame, is something Solid inserts: nodes in a page,
 * the server's templates on Node, a text, a list of them.
 *
 * @param value - what `story()` gave.
 */
const isElement = (value: unknown): value is JSX.Element =>
  typeof value !== "function" && typeof value !== "symbol" && typeof value !== "bigint";

/**
 * A decorator drawing the story inside a `section`, written as Solid writes one.
 *
 * @param label - its `data-decorator` value.
 */
export const sectionDecorator =
  (label: string): LoadedDecorator =>
  (story: () => unknown): JSX.Element => {
    const inner = story();
    return <section data-decorator={label}>{isElement(inner) ? inner : null}</section>;
  };
