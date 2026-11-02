/**
 * Tests for SvelteKit's renderer in a page: a page's load runs before it is drawn and gives its data, a link moves the
 * story's page and never the frame, a form's action answers with the story's result.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it } from "vitest";

import { APP_SETTINGS_KEY } from "../src/appSettings.ts";
import { kitRenderer } from "../src/kitRenderer.ts";
import { storyPage } from "../src/storyPage.ts";
import PostPage from "./components/PostPage.svelte";

/** The canvases of the running test. */
const canvases: HTMLElement[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/**
 * A drawing of the post page's story with parameters.
 *
 * @param parameters - the story's parameters.
 * @param calls - where the calls it reports go.
 */
const drawing = (parameters: Readonly<Record<string, unknown>>, calls: string[] = []): StoryDrawing => {
  const loaded = readStory(
    { default: { title: "Pages/Post", component: PostPage, parameters }, Plain: {} },
    "Plain"
  );
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:pages-post--plain", name: "Plain", title: "Pages/Post" },
    story: loaded,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {},
    report: (name: string, values: readonly unknown[]): void => {
      calls.push(`${name} ${values.map((value) => JSON.stringify(value)).join(" ")}`);
    }
  };
};

/** Waits until a condition holds, as Svelte draws on its own schedule. */
const settled = async (holds: () => boolean): Promise<void> => {
  await expect.poll(holds, { timeout: 2000 }).toBe(true);
};

/** The text of an element of the canvas, by its test id. */
const textOf = (element: HTMLElement, id: string): string =>
  element.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

Reflect.set(globalThis, Symbol.for(APP_SETTINGS_KEY), {
  base: "",
  routes: [{ id: "/blog/[slug]", page: true, endpoint: false }]
});

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

describe("a page's load", () => {
  it("runs the loads before the page is drawn, the layout's first, with the route's params", async () => {
    const element = canvas();
    const layout = async ({
      parent
    }: {
      readonly parent: () => Promise<Record<string, unknown>>;
    }): Promise<object> => ({
      site: "Kit",
      ...(await parent())
    });
    const load = async ({
      params,
      parent
    }: {
      readonly params: { readonly slug: string };
      readonly parent: () => Promise<{ readonly site?: string }>;
    }): Promise<object> => ({
      title: `${(await parent()).site ?? ""} ${params.slug}`
    });
    const mounted = kitRenderer.mount(
      element,
      drawing({ sveltekit: { page: { url: "/blog/first" }, load: [layout, load] } }),
      () => undefined
    );
    await mounted.drawn;
    expect(element.querySelector("h1")?.textContent).toBe("Kit first");
    expect(storyPage().data).toEqual({ site: "Kit", title: "Kit first" });
    mounted.unmount();
  });

  it("shows what a load throws instead of the page, SvelteKit's error written with its status", async () => {
    const element = canvas();
    const errors: string[] = [];
    const load = (): never => {
      throw { status: 404, body: { message: "No such post" } };
    };
    kitRenderer.mount(element, drawing({ sveltekit: { load } }), (error) => errors.push(error.message));
    await settled(() => errors.length > 0);
    expect(errors).toEqual(["404: No such post"]);
  });
});

describe("links and forms", () => {
  it("moves the story's page on a link of the app and loads its data again, keeps the frame where it is", async () => {
    const element = canvas();
    const calls: string[] = [];
    const load = ({ params }: { readonly params: { readonly slug: string } }): object => ({
      title: params.slug
    });
    const mounted = kitRenderer.mount(
      element,
      drawing({ sveltekit: { page: { url: "/blog/first" }, load } }, calls),
      () => undefined
    );
    await mounted.drawn;
    const before = location.href;
    element.querySelector<HTMLAnchorElement>('a[href="/blog/second"]')?.click();
    await settled(() => element.querySelector("h1")?.textContent === "second");
    expect(textOf(element, "route")).toBe("/blog/[slug] second /blog/second");
    expect(textOf(element, "navigations")).toBe("2");
    element.querySelector<HTMLAnchorElement>('a[href^="https:"]')?.click();
    expect(storyPage().pathname).toBe("/blog/second");
    expect(location.href).toBe(before);
    expect(calls).toEqual(['link "/blog/second"', 'link "https://example.com/away"']);
    mounted.unmount();
  });

  it("answers a form with the story's result, given to the page as its form", async () => {
    const element = canvas();
    const calls: string[] = [];
    const result = { type: "failure", status: 400, data: { message: "Title taken" } };
    const mounted = kitRenderer.mount(
      element,
      drawing({ sveltekit: { forms: { result } } }, calls),
      () => undefined
    );
    await mounted.drawn;
    element.querySelector("form")?.requestSubmit();
    await settled(() => textOf(element, "form") === "Title taken");
    expect(storyPage().status).toBe(400);
    expect(calls).toEqual(['enhance "/?/save" {"title":"Draft"}']);
    mounted.unmount();
  });
});
