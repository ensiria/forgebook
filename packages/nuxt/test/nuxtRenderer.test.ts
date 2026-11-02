/**
 * Tests for a story's Nuxt in the page: its route, its links and router calls, its data, state, cookies and config,
 * as the stand-ins of Nuxt's composables read them through the renderer.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type VNode } from "vue";

import { NuxtLink } from "../src/app/components.ts";
import { useAsyncData } from "../src/app/data.ts";
import { useFetch } from "../src/app/fetch.ts";
import { navigateTo, useRoute } from "../src/app/router.ts";
import { useAppConfig, useCookie, useRuntimeConfig, useState } from "../src/app/state.ts";
import { storyNuxt } from "../src/storyNuxt.ts";
import { drawing, drawn, renderer, settled, takeAway } from "./drawStory.ts";

afterEach(() => {
  takeAway();
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
    /** The text a story at a route draws, the story taken away after. */
    const textAt = async (route: unknown): Promise<string> => {
      const text = (await drawn(drawing(() => h(RouteReader), { route }))).textContent ?? "";
      await settled();
      const read = `${text} ${storyNuxt().route.fullPath}`;
      takeAway();
      return read;
    };
    expect(await textAt({ name: "blog-slug", params: { slug: "a" } })).toBe("/blog/a a /blog/a");
    // the route keeps its search and hash once the router is ready
    expect(await textAt("/blog/b?x=1#top")).toBe("/blog/b b /blog/b?x=1#top");
    // a path no page has still moves the route; a name no page has stays home
    expect(await textAt("/elsewhere")).toBe("/elsewhere none /elsewhere");
    expect(await textAt({ name: "nothing" })).toBe("/ none /");
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

  it("fetches with useFetch, its key the request as made, and keeps a failure as Nuxt's error", async () => {
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
    expect(storyNuxt().data).toMatchObject({ "/api/products?page=2": [{ name: "Anvil" }] });
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
