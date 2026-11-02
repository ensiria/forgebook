/**
 * Tests for a story's Nuxt in the page: its route, its links and router calls, its data, state, cookies and config,
 * as the stand-ins of Nuxt's composables read them through the renderer.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type VNode } from "vue";

import { NuxtLink } from "../src/app/components.ts";
import { useAsyncData, useFetch } from "../src/app/data.ts";
import { navigateTo, useRoute } from "../src/app/router.ts";
import { useAppConfig, useCookie, useRuntimeConfig, useState } from "../src/app/state.ts";
import { createNuxtRenderer } from "../src/nuxtRenderer.ts";
import { storyNuxt } from "../src/storyNuxt.ts";
import { project } from "./project.ts";

/** The renderer over the tests' project. */
const renderer = createNuxtRenderer(project);

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
 * A drawing of a story that draws a component, with Nuxt parameters.
 *
 * @param render - what the story draws.
 * @param nuxt - its `parameters.nuxt`.
 * @param report - where its calls are told.
 */
const drawing = (
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
const drawn = async (story: StoryDrawing): Promise<HTMLElement> => {
  const element = canvas();
  await renderer.mount(element, story, (error) => {
    throw error;
  }).drawn;
  await nextTick();
  return element;
};

/** Waits for what a component fetches to be drawn. */
const settled = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
};

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
  vi.unstubAllGlobals();
});

/** Shows the route's path and its slug, read once in setup as a component often does. */
const RouteReader = defineComponent(() => {
  const route = useRoute();
  const slug = String(route.params["slug"] ?? "none");
  return (): VNode => h("p", `${route.path} ${slug}`);
});

describe("the route", () => {
  it("starts where the story says, by a page's name and params or by a path", async () => {
    expect(
      (await drawn(drawing(() => h(RouteReader), { route: { name: "blog-slug", params: { slug: "a" } } })))
        .textContent
    ).toBe("/blog/a a");
    expect((await drawn(drawing(() => h(RouteReader), { route: "/blog/b?x=1" }))).textContent).toBe(
      "/blog/b b"
    );
    // a path no page has still moves the route; a name no page has stays home
    expect((await drawn(drawing(() => h(RouteReader), { route: "/elsewhere" }))).textContent).toBe(
      "/elsewhere none"
    );
    expect((await drawn(drawing(() => h(RouteReader), { route: { name: "nothing" } }))).textContent).toBe(
      "/ none"
    );
  });

  it("moves when a link is clicked, and tells the catalogue", async () => {
    const calls: string[] = [];
    const element = await drawn(
      drawing(
        () => h("div", [h(NuxtLink, { to: "/blog/c" }, () => "Post"), h(RouteReader)]),
        {},
        (name, values) => calls.push(`${name} ${values.join(" ")}`)
      )
    );
    const link = element.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/blog/c");
    link?.click();
    await settled();
    expect(element.querySelector("p")?.textContent).toBe("/blog/c none");
    expect(calls).toEqual(["router.push /blog/c"]);
    expect(storyNuxt().route).toMatchObject({ path: "/blog/c", name: "blog-slug", params: { slug: "c" } });
  });

  it("records a link out of the app instead of leaving the frame", async () => {
    const element = await drawn(
      drawing(() => h(NuxtLink, { to: "https://nuxt.com", target: "_blank" }, () => "Nuxt"))
    );
    const link = element.querySelector("a");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    const event = new MouseEvent("click", { cancelable: true, bubbles: true });
    link?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(storyNuxt().calls).toEqual([
      { name: "navigateTo", values: ["https://nuxt.com", { external: true }] }
    ]);
  });

  it("navigates with navigateTo, refusing another origin unless it is said to be external", async () => {
    await drawn(drawing(() => h(RouteReader)));
    await navigateTo({ path: "/blog/d", query: { tab: "1" } }, { replace: true });
    expect(storyNuxt().route.fullPath).toBe("/blog/d?tab=1");
    await expect(navigateTo("https://example.com")).rejects.toThrow("external: true");
    await navigateTo("https://example.com", { external: true });
    expect(storyNuxt().route.fullPath).toBe("/blog/d?tab=1");
    expect(storyNuxt().calls.map((call) => call.name)).toEqual(["navigateTo", "navigateTo", "navigateTo"]);
  });
});

describe("the data", () => {
  it("returns the story's data for a key without calling the handler", async () => {
    const handler = vi.fn(async (): Promise<string> => "fetched");
    const Reader = defineComponent(async () => {
      const { data, status } = await useAsyncData("post", handler);
      return (): VNode => h("p", `${String(data.value)} ${status.value}`);
    });
    expect((await drawn(drawing(() => h(Reader), { data: { post: "given" } }))).textContent).toBe(
      "given success"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler otherwise, transforms its result, and shares it by key", async () => {
    const handler = vi.fn(async (): Promise<{ readonly title: string }> => ({ title: "Hello" }));
    const Reader = defineComponent(async () => {
      const { data } = await useAsyncData("post", handler, {
        transform: (post: { readonly title: string }): string => post.title.toUpperCase()
      });
      return (): VNode => h("p", String(data.value));
    });
    const element = await drawn(drawing(() => h("div", [h(Reader), h(Reader)])));
    expect(element.textContent).toBe("HELLOHELLO");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fetches with useFetch, its key its URL, and keeps a failure as Nuxt's error", async () => {
    const fetched: string[] = [];
    vi.stubGlobal("fetch", async (url: string): Promise<Response> => {
      fetched.push(url);
      return url.includes("missing")
        ? Response.json({ reason: "gone" }, { status: 404 })
        : Response.json([{ name: "Anvil" }]);
    });
    const Reader = defineComponent(async () => {
      const products = await useFetch<{ readonly name: string }[]>("/api/products", { query: { page: 2 } });
      const missing = await useFetch("/api/missing");
      return (): VNode =>
        h(
          "p",
          `${products.data.value?.[0]?.name ?? ""} ${missing.error.value?.statusCode ?? ""} ${missing.status.value}`
        );
    });
    const element = await drawn(drawing(() => h(Reader)));
    expect(element.textContent).toBe("Anvil 404 error");
    expect(fetched).toEqual(["/api/products?page=2", "/api/missing"]);
    expect(storyNuxt().data).toMatchObject({ "/api/products": [{ name: "Anvil" }] });
  });

  it("calls no handler on the server, and draws the story's data there", async () => {
    const handler = vi.fn(async (): Promise<string> => "fetched");
    const Reader = defineComponent(async () => {
      const first = await useAsyncData("given", handler);
      const second = await useAsyncData("other", handler);
      return (): VNode => h("p", `${String(first.data.value)} ${String(second.data.value)}`);
    });
    expect(await renderer.renderToString(drawing(() => h(Reader), { data: { given: "story" } }))).toContain(
      "story undefined"
    );
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("the state and the config", () => {
  it("shares a state's key between components, starting from the story's value, and reads its cookies", async () => {
    const Counter = defineComponent(() => {
      const count = useState("count", () => 0);
      const currency = useCookie("currency", { default: () => "USD" });
      return (): VNode =>
        h("button", { onClick: () => (count.value += 1) }, `${count.value} ${String(currency.value)}`);
    });
    const element = await drawn(
      drawing(() => h("div", [h(Counter), h(Counter)]), { state: { count: 2 }, cookies: { currency: "EUR" } })
    );
    element.querySelector("button")?.click();
    await nextTick();
    expect(element.textContent).toBe("3 EUR3 EUR");
    expect(storyNuxt()).toMatchObject({ state: { count: 3 }, cookies: { currency: "EUR" } });
  });

  it("merges the project's runtime and app config with the story's", async () => {
    const Reader = defineComponent(() => {
      const config = useRuntimeConfig();
      const app = useAppConfig();
      return (): VNode => h("p", JSON.stringify([config.public, app]));
    });
    const element = await drawn(
      drawing(() => h(Reader), {
        runtimeConfig: { public: { api: { version: 2 } } },
        appConfig: { title: "Story" }
      })
    );
    expect(JSON.parse(element.textContent ?? "")).toEqual([
      { siteName: "Shop", api: { base: "/api", version: 2 } },
      { theme: { accent: "teal", radius: "8px" }, title: "Story" }
    ]);
  });

  it("gives a story's own template Nuxt's components without an import", async () => {
    const element = await drawn(
      drawing(() =>
        h(
          defineComponent({
            template: '<NuxtLink to="/blog/e">Post</NuxtLink><ClientOnly><i>client</i></ClientOnly>'
          })
        )
      )
    );
    await settled();
    expect(element.innerHTML).toContain('href="/blog/e"');
    expect(element.textContent).toContain("client");
  });
});
