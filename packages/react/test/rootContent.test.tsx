/**
 * Tests for what a React story still waits for: a fallback shown by a boundary the adapter did not write, nested ones,
 * work not finished, and a React whose private fields cannot be read, which must never read as nothing pending.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { ContentState, MountedStory, StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { Activity, lazy, type ReactNode, Suspense, use, useDeferredValue, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { reactFrameRenderer } from "../src/reactFrameRenderer.tsx";
import { checkedContent, contentOfRoot, isReadingSound } from "../src/rootContent.tsx";

/** A promise, and what ends it. */
const held = <TValue,>(): { readonly promise: Promise<TValue>; readonly give: (value: TValue) => void } => {
  let give = (_value: TValue): void => undefined;
  const promise = new Promise<TValue>((resolve) => {
    give = resolve;
  });
  return { promise, give };
};

/** What the deferred story shows first. */
const OLD_WORDS = Promise.resolve("Old");

/** A drawing of a story with this render. */
const drawing = (render: () => ReactNode, parameters: Record<string, unknown> = {}): StoryDrawing => {
  const story = readStory({ default: { title: "Kit/Late" }, Shown: { render, parameters } }, "Shown");
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "kit-late--shown", name: "Shown", title: "Kit/Late" },
    story,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** The stories a test left in the page: one still drawing itself would outlive the simulated page and fail the run. */
const shownStories: MountedStory[] = [];

afterEach(() => {
  for (const story of shownStories.splice(0)) story.unmount();
});

/** Mounts a story in a new canvas and waits until it is drawn. */
const mounted = async (
  render: () => ReactNode
): Promise<{
  readonly canvas: HTMLElement;
  readonly settled: (timeout: number) => Promise<ContentState>;
}> => {
  const canvas = document.createElement("div");
  document.body.append(canvas);
  const story = reactFrameRenderer.mount(canvas, drawing(render), (error) => {
    throw error;
  });
  shownStories.push(story);
  await story.drawn;
  if (story.settled === undefined) throw new Error("React's renderer says what a story waits for");
  return { canvas, settled: story.settled };
};

/** Shows what a promise gives, once it does. */
const Words = ({ promise }: { readonly promise: Promise<string> }): ReactNode => <b>{use(promise)}</b>;

/** A boundary the first promise's content brings in, which waits for the second. */
const Waterfall = ({
  first,
  second
}: {
  readonly first: Promise<string>;
  readonly second: Promise<string>;
}): ReactNode => (
  <>
    {use(first)}
    <Suspense fallback={<i>Inner</i>}>
      <Words promise={second} />
    </Suspense>
  </>
);

/** Opens a boundary from an effect: nothing pending when it first commits. */
const OpensLater = ({ promise }: { readonly promise: Promise<string> }): ReactNode => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => setIsOpen(true), []);
  return isOpen ? (
    <Suspense fallback={<i>Loading</i>}>
      <Words promise={promise} />
    </Suspense>
  ) : null;
};

/** Moves to a promise through a deferred value: the old content stays, with no fallback. */
const Deferred = ({ promise }: { readonly promise: Promise<string> }): ReactNode => {
  const [current, setCurrent] = useState<Promise<string>>(OLD_WORDS);
  const shown = useDeferredValue(current);
  useEffect(() => setCurrent(promise), [promise]);
  return (
    <Suspense fallback={<i>Loading</i>}>
      <Words promise={shown} />
    </Suspense>
  );
};

/** Draws itself again and again. */
const Ticks = (): ReactNode => {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicks((count) => count + 1), 5);
    return (): void => clearInterval(timer);
  }, []);
  return <p>{ticks}</p>;
};

/** A little time for React, past its throttling of a fallback's end. */
const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("what a React story waits for", () => {
  it("waits for nothing in a story with no boundary, at the first look", async () => {
    const { settled } = await mounted(() => <p>Plain</p>);
    expect(await settled(0)).toEqual({ state: "settled" });
  });

  it("waits for a lazy component in a boundary the story wrote, until it is in the page", async () => {
    const module = held<{ readonly default: () => ReactNode }>();
    const Late = lazy(() => module.promise);
    const { canvas, settled } = await mounted(() => (
      <Suspense fallback={<i>Loading</i>}>
        <Late />
      </Suspense>
    ));
    expect(await settled(0)).toMatchObject({ state: "waiting", reason: expect.stringContaining("Suspense") });
    const whole = settled(5000);
    module.give({ default: () => <b>Content</b> });
    expect(await whole).toEqual({ state: "settled" });
    // the wait ends only when the content is committed, whatever React's throttle delayed it by
    expect(canvas.querySelector("b")?.textContent).toBe("Content");
    expect(canvas.querySelector("i")).toBeNull();
  });

  it("waits for `use` of a promise, deep in the tree and through a portal", async () => {
    const words = held<string>();
    const { canvas, settled } = await mounted(() => (
      <section>
        <div>
          {createPortal(
            <Suspense fallback={<i>Loading</i>}>
              <Words promise={words.promise} />
            </Suspense>,
            document.body
          )}
        </div>
      </section>
    ));
    expect((await settled(0)).state).toBe("waiting");
    words.give("Content");
    expect(await settled(5000)).toEqual({ state: "settled" });
    expect(canvas.ownerDocument.body.textContent).toContain("Content");
  });

  it("waits for a boundary the resolved content brings in turn", async () => {
    const first = held<string>();
    const second = held<string>();
    const { settled } = await mounted(() => (
      <Suspense fallback={<i>Outer</i>}>
        <Waterfall first={first.promise} second={second.promise} />
      </Suspense>
    ));
    first.give("One");
    await pause(450);
    expect(await settled(0)).toMatchObject({ state: "waiting" });
    second.give("Two");
    expect(await settled(5000)).toEqual({ state: "settled" });
  });

  it("waits for a fallback a state set in an effect is about to show", async () => {
    const words = held<string>();
    const { settled } = await mounted(() => <OpensLater promise={words.promise} />);
    const whole = settled(5000);
    await pause(50);
    words.give("Content");
    expect(await whole).toEqual({ state: "settled" });
    expect(document.body.textContent).toContain("Content");
  });

  it("waits for a deferred value still loading, which shows no fallback", async () => {
    const words = held<string>();
    const { settled } = await mounted(() => <Deferred promise={words.promise} />);
    await pause(30);
    expect(await settled(0)).toMatchObject({ state: "waiting" });
    words.give("New");
    expect(await settled(5000)).toEqual({ state: "settled" });
  });

  it("does not wait for a boundary inside a hidden Activity, which shows nothing", async () => {
    const words = held<string>();
    const { settled } = await mounted(() => (
      <Activity mode="hidden">
        <Suspense fallback={<i>Loading</i>}>
          <Words promise={words.promise} />
        </Suspense>
      </Activity>
    ));
    expect(await settled(5000)).toEqual({ state: "settled" });
  });

  it("settles a story that keeps drawing itself", async () => {
    const { settled } = await mounted(() => <Ticks />);
    expect(await settled(5000)).toEqual({ state: "settled" });
  });

  it("gives up in time, saying what it waited for", async () => {
    const Never = lazy(() => new Promise<{ readonly default: () => ReactNode }>(() => undefined));
    const { settled } = await mounted(() => (
      <Suspense fallback={<i>Loading</i>}>
        <Never />
      </Suspense>
    ));
    const start = performance.now();
    expect(await settled(60)).toMatchObject({
      state: "waiting",
      reason: "1 React Suspense boundary still shows its fallback"
    });
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("has nothing to wait for once the story is gone", async () => {
    const Never = lazy(() => new Promise<{ readonly default: () => ReactNode }>(() => undefined));
    const canvas = document.createElement("div");
    const story = reactFrameRenderer.mount(
      canvas,
      drawing(() => (
        <Suspense fallback={<i>Loading</i>}>
          <Never />
        </Suspense>
      )),
      () => undefined
    );
    await story.drawn;
    const whole = story.settled?.(60_000);
    story.unmount();
    expect(await whole).toEqual({ state: "settled" });
  });
});

describe("a React that cannot be read", () => {
  /** A root as a later React might make it. */
  const rootLike = (fields: Record<string, unknown>): Root => {
    const root = createRoot(document.createElement("div"));
    Reflect.set(root, "_internalRoot", fields);
    return root;
  };

  it("says it cannot tell when the root's fields are gone", () => {
    expect(contentOfRoot(rootLike({})).state).toBe("unknown");
    expect(contentOfRoot(rootLike({ current: {}, pendingLanes: "none" })).state).toBe("unknown");
    expect(contentOfRoot(rootLike({ current: null, pendingLanes: 0 })).state).toBe("unknown");
  });

  it("holds the reading sound on this React", () => {
    expect(isReadingSound(contentOfRoot)).toBe(true);
  });

  it("finds a reading unsound that no longer sees a boundary, or sees one that is not there", () => {
    expect(isReadingSound(() => ({ state: "settled" }))).toBe(false);
    expect(isReadingSound(() => ({ state: "waiting", reason: "always" }))).toBe(false);
    expect(
      isReadingSound(() => {
        throw new Error("moved");
      })
    ).toBe(false);
  });

  it("believes a reading of nothing pending only after the probe, and never asks of a page being left", () => {
    expect(checkedContent({ state: "settled" }, false)).toEqual({ state: "settled" });
    expect(checkedContent({ state: "waiting", reason: "r" }, false).state).toBe("waiting");
    expect(checkedContent({ state: "settled" }, true)).toEqual({ state: "settled" });
  });
});
