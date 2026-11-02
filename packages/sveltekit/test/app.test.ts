/**
 * Tests for the `$app` stand-ins in a page: `goto` and the navigation callbacks move the story's page, the stores and
 * `$app/state` follow it, a form's action answers with the story's result, the paths read the project's settings.
 *
 * @module
 */
import { describe, expect, it, vi } from "vitest";

import { applyAction, deserialize } from "../src/app/forms.ts";
import { goto, invalidateAll, preloadData, pushState } from "../src/app/navigation.ts";
import { asset, match, resolve, resolveRoute } from "../src/app/paths.ts";
import { page, updated } from "../src/app/state.ts";
import { getStores } from "../src/app/stores.ts";
import { APP_SETTINGS_KEY, type KitAppSettings } from "../src/appSettings.ts";
import { createKitStore, type KitStore, setCurrentStore } from "../src/kitStore.ts";
import { storyPage } from "../src/storyPage.ts";

// the frame's page holds its settings before any module runs, `$app/paths` reading them as it loads
vi.hoisted(() => {
  Reflect.set(globalThis, Symbol.for("forgebook.sveltekit.app"), {
    base: "/docs",
    assets: "",
    version: "2.0.0",
    routes: [
      { id: "/", page: true, endpoint: false },
      { id: "/blog/[slug]", page: true, endpoint: false },
      { id: "/api/posts", page: false, endpoint: true }
    ],
    staticFiles: ["favicon.png"]
  });
});

/** The settings the frame's page holds. */
const SETTINGS: KitAppSettings = {
  base: "/docs",
  assets: "",
  version: "2.0.0",
  routes: [
    { id: "/", page: true, endpoint: false },
    { id: "/blog/[slug]", page: true, endpoint: false },
    { id: "/api/posts", page: false, endpoint: true }
  ],
  staticFiles: ["favicon.png"]
};

/**
 * A story's page, made the frame's current one.
 *
 * @param parameters - the story's parameters.
 * @param report - where its calls are told.
 */
const story = (
  parameters: Readonly<Record<string, unknown>> = {},
  report?: (name: string, values: readonly unknown[]) => void
): KitStore => {
  const store = createKitStore(parameters, report);
  setCurrentStore(store);
  return store;
};

describe("the settings", () => {
  it("are the page's, as the plugin wrote them", () => {
    expect(Reflect.get(globalThis, Symbol.for(APP_SETTINGS_KEY))).toEqual(SETTINGS);
  });
});

describe("$app/navigation and $app/state", () => {
  it("moves the page with goto, its route and params matched, and tells the catalogue and the story's callback", async () => {
    const reports: string[] = [];
    const onGoto = vi.fn();
    story({ sveltekit: { navigation: { goto: onGoto } } }, (name, values) =>
      reports.push(`${name} ${String(values[0])}`)
    );
    expect(page.url.pathname).toBe("/docs/");
    await goto("/docs/blog/hello?tab=2");
    expect(page.url.pathname).toBe("/docs/blog/hello");
    expect(page.route.id).toBe("/blog/[slug]");
    expect(page.params).toEqual({ slug: "hello" });
    expect(storyPage().query).toEqual({ tab: "2" });
    expect(reports).toEqual(["goto /docs/blog/hello?tab=2"]);
    expect(onGoto).toHaveBeenCalledWith("/docs/blog/hello?tab=2");
  });

  it("refuses an address outside the app, as SvelteKit does, and lets beforeNavigate cancel a move", async () => {
    const store = story();
    await expect(goto("https://example.com/")).rejects.toThrow("outside the app");
    store.beforeNavigate((navigation) => navigation.cancel());
    await goto("/docs/blog/x");
    expect(page.url.pathname).toBe("/docs/");
  });

  it("loads the data, then runs onNavigate, moves the page and runs afterNavigate, in SvelteKit's order", async () => {
    const store = story();
    const seen: string[] = [];
    store.setLoader(async (at) => {
      seen.push(`load ${at.url.pathname}`);
      return { path: at.url.pathname };
    });
    store.onNavigate((navigation) => {
      seen.push(`on ${navigation.to?.url.pathname ?? ""} with ${String(page.data["path"])}`);
      return (): void => {
        seen.push("returned");
      };
    });
    store.afterNavigate((navigation) => seen.push(`after ${navigation.type} ${page.url.pathname}`));
    await goto("/docs/blog/b");
    expect(seen).toEqual([
      "load /docs/blog/b",
      "on /docs/blog/b with undefined",
      "after goto /docs/blog/b",
      "returned"
    ]);
    expect(page.data).toEqual({ path: "/docs/blog/b" });
    store.setLoader(async () => ({ path: "again" }));
    await invalidateAll();
    expect(page.data).toEqual({ path: "again" });
    const preloaded = await preloadData("/docs/blog/c");
    expect(preloaded.type === "loaded" ? preloaded.data : undefined).toEqual({ path: "again" });
  });

  it("keeps the later of two moves when the earlier one's load ends last", async () => {
    const store = story();
    let finishSlow = (): void => undefined;
    store.setLoader(
      (at) =>
        new Promise((done) => {
          const data = { at: at.url.pathname };
          if (at.url.pathname.endsWith("/slow")) finishSlow = (): void => done(data);
          else done(data);
        })
    );
    const slow = store.navigate("goto", "/docs/blog/slow");
    expect(await store.navigate("goto", "/docs/blog/fast")).toBe(true);
    finishSlow();
    expect(await slow).toBe(false);
    expect(page.url.pathname).toBe("/docs/blog/fast");
    expect(page.data).toEqual({ at: "/docs/blog/fast" });
    expect(store.navigating()).toBeNull();
  });

  it("follows the redirects a load throws, and gives the page an error another throws, ready to move again", async () => {
    const errors: unknown[] = [];
    const store = story();
    store.setErrorHandler((error) => errors.push(error));
    store.setLoader(async (at) => {
      if (at.url.pathname === "/docs/blog/old") throw { status: 308, location: "/docs/blog/new" };
      if (at.url.pathname === "/docs/blog/gone") throw { status: 404, body: { message: "Gone" } };
      return { at: at.url.pathname };
    });
    expect(await store.navigate("link", "/docs/blog/old")).toBe(true);
    expect(page.url.pathname).toBe("/docs/blog/new");
    expect(storyPage().calls.map((call) => call.name)).toEqual(["redirect"]);
    expect(await store.navigate("link", "/docs/blog/gone")).toBe(false);
    expect(page.error).toEqual({ message: "Gone", status: 404 });
    expect(errors).toHaveLength(1);
    expect(store.navigating()).toBeNull();
    expect(await store.navigate("link", "/docs/blog/again")).toBe(true);
  });

  it("leaves a path outside the base path to the browser: the page stays", async () => {
    const store = story();
    expect(await store.navigate("link", "/elsewhere")).toBe(false);
    expect(page.url.pathname).toBe("/docs/");
  });

  it("sets the page's state with pushState, and answers updated from the story", async () => {
    story({ sveltekit: { updated: true } });
    pushState("", { modal: true });
    expect(page.state).toEqual({ modal: true });
    expect(updated.current).toBe(true);
    expect(await updated.check()).toBe(true);
  });
});

describe("$app/stores", () => {
  it("gives the page as a store that follows its moves", async () => {
    story();
    const paths: string[] = [];
    const stop = getStores().page.subscribe((value) => paths.push(value.url.pathname));
    await goto("/docs/blog/a");
    stop();
    expect(paths).toEqual(["/docs/", "/docs/blog/a"]);
  });
});

describe("$app/forms", () => {
  it("applies an action's result to the page, a redirect moving it", async () => {
    story();
    await applyAction({ type: "failure", status: 422, data: { message: "Too short" } });
    expect(page.form).toEqual({ message: "Too short" });
    expect(page.status).toBe(422);
    await applyAction({ type: "redirect", status: 303, location: "/docs/blog/z" });
    expect(page.params).toEqual({ slug: "z" });
  });

  it("reads an action's answer from its text", () => {
    expect(deserialize('{"type":"success","status":200,"data":"{\\"saved\\":true}"}')).toEqual({
      type: "success",
      status: 200,
      data: { saved: true }
    });
  });
});

describe("$app/paths", () => {
  it("writes paths under the base path, a route id's params filled in, and matches an address", async () => {
    expect(resolve("/blog/[slug]", { slug: "a-b" })).toBe("/docs/blog/a-b");
    expect(resolve("about?x=1")).toBe("/docs/about?x=1");
    expect(resolveRoute("/")).toBe("/docs/");
    expect(asset("favicon.png")).toBe("/docs/favicon.png");
    expect(await match("/docs/blog/q")).toEqual({ id: "/blog/[slug]", params: { slug: "q" } });
    expect(await match("/docs/api/posts")).toBeNull();
  });
});
