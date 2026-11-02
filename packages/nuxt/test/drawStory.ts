/**
 * Draws the tests' stories with the Nuxt renderer, over the tests' project, as the frame draws them.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { MountedStory, StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { nextTick, type VNode } from "vue";

import { createNuxtRenderer } from "../src/nuxtRenderer.ts";
import { project } from "./project.ts";

/** The renderer over the tests' project. */
export const renderer = createNuxtRenderer(project);

/** The canvases of the running test. */
const canvases: HTMLElement[] = [];

/** The stories the running test drew, taken away after it as the frame takes them away. */
const mounts: MountedStory[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/**
 * A drawing of a story that draws a component, with Nuxt parameters.
 *
 * @param render - what the story draws.
 * @param nuxt - its `parameters.nuxt`.
 * @param report - where its calls are told.
 */
export const drawing = (
  render: () => VNode,
  nuxt: Readonly<Record<string, unknown>> = {},
  report?: (name: string, values: readonly unknown[]) => void
): StoryDrawing => {
  const story = readStory(
    { default: { title: "Shop/Thing" }, Plain: { render, parameters: { nuxt } } },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "shop:shop-thing--plain", name: "Plain", title: "Shop/Thing" },
    story,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {},
    ...(report === undefined ? {} : { report })
  };
};

/**
 * Draws a story and waits until it is drawn.
 *
 * @param story - the story.
 */
export const drawn = async (story: StoryDrawing): Promise<HTMLElement> => {
  const element = canvas();
  const mounted = renderer.mount(element, story, (error) => {
    throw error;
  });
  mounts.push(mounted);
  await mounted.drawn;
  await nextTick();
  return element;
};

/** Waits for what a component fetches to be drawn. */
export const settled = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
};

/** Takes away what the running test drew, as the frame takes a story away. */
export const takeAway = (): void => {
  for (const each of mounts.splice(0)) each.unmount();
  for (const each of canvases.splice(0)) each.remove();
};
