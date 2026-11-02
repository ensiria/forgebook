/**
 * Tests for the Next.js renderer: async server components awaited before the story counts as drawn, at any depth and
 * inside the catalogue's decorators; a lazy module waited for; the story's route made fresh when it is mounted.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readPreview, readStory } from "forgebook/story-module";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import dynamic from "../src/next/dynamic.tsx";
import Head from "../src/next/head.tsx";
import { nextRenderer } from "../src/nextRenderer.tsx";
import { storyRoute } from "../src/storyRoute.ts";

/**
 * Waits a moment, as data a server reads would.
 *
 * @param value - what it gives.
 */
const later = <TValue,>(value: TValue): Promise<TValue> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(value), 20);
  });

/** A server component inside another, given as its child. */
const Author = async ({ name }: { readonly name: string }): Promise<ReactNode> => (
  <em>{await later(name)}</em>
);

/** A server component, its child a server component too. */
const Post = async ({
  title,
  children
}: {
  readonly title?: unknown;
  readonly children?: ReactNode;
}): Promise<ReactNode> => (
  <article>
    <h1>{await later(String(title))}</h1>
    {children}
  </article>
);

/** A server component that fails once its data came, as one calling `notFound` does. */
const Missing = async (): Promise<ReactNode> => {
  await later(null);
  throw new Error("No such post");
};

/**
 * A drawing of a story file's story.
 *
 * @param exports - the story file's exports.
 * @param decorators - the catalogue's decorators.
 * @param parameters - the story's parameters.
 */
const drawing = (
  exports: Readonly<Record<string, unknown>>,
  decorators: readonly LoadedDecorator[] = []
): StoryDrawing => {
  const story = readStory({ default: { title: "Blog/Post" }, ...exports }, "Shown");
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "blog-post--shown", name: "Shown", title: "Blog/Post" },
    story,
    args: { title: "First light" },
    texts: {},
    clock: heldStoryClock(0),
    decorators,
    globals: {},
    loaded: {}
  };
};

/**
 * Mounts a drawing in a new canvas.
 *
 * @param shown - the drawing.
 */
const mount = (shown: StoryDrawing): { readonly canvas: HTMLElement; readonly drawn: Promise<void> } => {
  const canvas = document.createElement("div");
  document.body.append(canvas);
  return { canvas, drawn: nextRenderer.mount(canvas, shown, () => undefined).drawn };
};

describe("nextRenderer", () => {
  it("draws an async component and the async ones in its tree before the story counts as drawn", async () => {
    const { canvas, drawn } = mount(
      drawing({
        Shown: {
          render: (args: { readonly title?: unknown }) => (
            <Post title={args.title}>
              <Author name="Ada" />
            </Post>
          )
        }
      })
    );
    await drawn;
    expect(canvas.innerHTML).toBe("<article><h1>First light</h1><em>Ada</em></article>");
  });

  it("swaps the meta's async component, inside a catalogue decorator that draws the story as a component", async () => {
    const story = readStory({ default: { title: "Blog/Post", component: Post }, Shown: {} }, "Shown");
    if (typeof story === "string") throw new Error(story);
    const { decorators } = readPreview({
      decorators: [
        (Story: () => ReactNode) => (
          <main>
            <Story />
          </main>
        )
      ]
    });
    const { canvas, drawn } = mount({ ...drawing({ Shown: {} }, decorators), story });
    await drawn;
    expect(canvas.innerHTML).toBe("<main><article><h1>First light</h1></article></main>");
  });

  it("waits for a dynamic module without a loading state, and puts Head's tags in the head", async () => {
    const Late = dynamic(async () => ({ default: (): ReactNode => <b>loaded</b> }));
    const { canvas, drawn } = mount(
      drawing({
        Shown: {
          render: () => (
            <>
              <Head>
                <meta name="forgebook-test" content="head" />
              </Head>
              <Late />
            </>
          )
        }
      })
    );
    await drawn;
    expect(canvas.innerHTML).toBe("<b>loaded</b>");
    expect(document.head.querySelector('meta[name="forgebook-test"]')).not.toBeNull();
  });

  it("never counts as drawn a story whose server component throws, and hands the error to the frame", async () => {
    const errors: string[] = [];
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const mounted = nextRenderer.mount(canvas, drawing({ Shown: { render: () => <Missing /> } }), (error) =>
      errors.push(error.message)
    );
    let isDrawn = false;
    void mounted.drawn.then(() => {
      isDrawn = true;
    });
    await vi.waitFor(() => expect(errors).toEqual(["No such post"]));
    await later(null);
    expect(isDrawn).toBe(false);
  });

  it("starts each mounted story at its own route", () => {
    const shown = drawing({
      Shown: { parameters: { nextjs: { navigation: { pathname: "/blog/a" } } }, render: () => null }
    });
    mount(shown);
    expect(storyRoute().pathname).toBe("/blog/a");
    mount(drawing({ Shown: { render: () => null } }));
    expect(storyRoute().pathname).toBe("/");
  });
});
