/**
 * Tests for a story's SvelteKit settings: the page its parameters give, read against the project's routes, with
 * Storybook's names too.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { hrefCallbacksOf, pageUrl, routePath, storyKitOf } from "../src/kitParameters.ts";

/** A project's page routes. */
const ROUTES = ["/", "/about", "/blog/[slug]"];

describe("storyKitOf", () => {
  it("starts a story with no settings on the home page, with no data, and is no page's", () => {
    const kit = storyKitOf({}, ROUTES, "");
    expect(kit.page.url.href).toBe("http://localhost/");
    expect(kit.page.route).toEqual({ id: "/" });
    expect(kit.page).toMatchObject({ params: {}, status: 200, error: null, data: {}, state: {}, form: null });
    expect(kit.isPage).toBe(false);
  });

  it("reads a path's route and params from the project's routes, under the base path", () => {
    const kit = storyKitOf({ sveltekit: { page: { url: "/blog/hello?tab=1" } } }, ROUTES, "/docs");
    expect(kit.page.url.href).toBe("http://localhost/docs/blog/hello?tab=1");
    expect(kit.page.route).toEqual({ id: "/blog/[slug]" });
    expect(kit.page.params).toEqual({ slug: "hello" });
  });

  it("writes the path a route id and its params give, and keeps what the story gives over what it reads", () => {
    const fromRoute = storyKitOf(
      { sveltekit: { page: { route: "/blog/[slug]", params: { slug: "x" } } } },
      ROUTES,
      ""
    );
    expect(fromRoute.page.url.pathname).toBe("/blog/x");
    expect(fromRoute.page.params).toEqual({ slug: "x" });
    const given = storyKitOf(
      { sveltekit: { page: { url: "/nowhere", route: { id: "/about" } } } },
      ROUTES,
      ""
    );
    expect(given.page.route).toEqual({ id: "/about" });
  });

  it("is a page's with data, a load, server data or an action's answer, server data merged without a load", () => {
    expect(storyKitOf({ sveltekit: { page: { data: { a: 1 } } } }, ROUTES, "").isPage).toBe(true);
    expect(storyKitOf({ sveltekit: { load: (): object => ({}) } }, ROUTES, "").isPage).toBe(true);
    expect(
      storyKitOf({ sveltekit: { forms: { result: { type: "failure", status: 422 } } } }, ROUTES, "").isPage
    ).toBe(true);
    const server = storyKitOf({ sveltekit: { page: { data: { a: 1 } }, serverData: { b: 2 } } }, ROUTES, "");
    expect(server.page.data).toEqual({ a: 1, b: 2 });
    expect(
      storyKitOf({ sveltekit: { load: [(): object => ({}), (): object => ({})] } }, ROUTES, "").loads
    ).toHaveLength(2);
  });

  it("reads Storybook's sveltekit_experimental, Forgebook's own winning where both are given", () => {
    const goto = (): void => undefined;
    const kit = storyKitOf(
      {
        sveltekit_experimental: {
          state: { page: { url: "/about", data: { from: "storybook" } }, updated: { current: true } },
          navigation: { goto }
        },
        sveltekit: { page: { data: { from: "forgebook" } } }
      },
      ROUTES,
      ""
    );
    expect(kit.page.url.pathname).toBe("/about");
    expect(kit.page.data).toEqual({ from: "forgebook" });
    expect(kit.updated).toBe(true);
    expect(kit.navigation.goto).toBe(goto);
    expect(
      storyKitOf({ sveltekit_experimental: { stores: { page: { url: "/blog/a" } } } }, ROUTES, "").page.params
    ).toEqual({ slug: "a" });
  });
});

describe("addresses and links", () => {
  it("makes a path an address after the base path, and reads it back", () => {
    expect(pageUrl("about", "/docs").href).toBe("http://localhost/docs/about");
    expect(pageUrl("https://shop.example/cart", "").href).toBe("https://shop.example/cart");
    expect(routePath("/docs/about", "/docs")).toBe("/about");
    expect(routePath("/docs", "/docs")).toBe("/");
    expect(routePath("/documents", "/docs")).toBe("/documents");
  });

  it("finds every callback a link's href matches, as it is or as a regular expression, a bad one matching none", () => {
    const exact = (): void => undefined;
    const pattern = (): void => undefined;
    const hrefs = {
      "/about": exact,
      "^/(about|blog)": { callback: pattern, asRegex: true },
      "(": { callback: exact, asRegex: true }
    };
    expect(hrefCallbacksOf(hrefs, "/about")).toEqual([exact, pattern]);
    expect(hrefCallbacksOf(hrefs, "/blog/x")).toEqual([pattern]);
    expect(hrefCallbacksOf(hrefs, "/")).toEqual([]);
  });
});
