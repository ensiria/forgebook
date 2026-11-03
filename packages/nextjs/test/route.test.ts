/**
 * Tests for a story's route: read from its parameters as Storybook's Next.js framework writes them, and moved by an
 * href as Next.js's routers move the app.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  filledRoute,
  HOME_ROUTE,
  hrefOfRoute,
  hrefText,
  pagesQueryOf,
  routeAfter,
  routeAfterAs,
  routeSettingsOf,
  storyRouteOf
} from "../src/route.ts";

describe("storyRouteOf", () => {
  it("starts at / without parameters, and ignores what is not a route", () => {
    expect(storyRouteOf({})).toEqual(HOME_ROUTE);
    expect(storyRouteOf({ nextjs: "nope" })).toEqual(HOME_ROUTE);
    expect(storyRouteOf({ nextjs: { navigation: { pathname: 42, query: { n: 1, bad: {} } } } })).toEqual({
      ...HOME_ROUTE,
      search: "n=1"
    });
  });

  it("reads the App Router's path, search params, params and Storybook's segments", () => {
    const route = storyRouteOf({
      nextjs: {
        navigation: {
          pathname: "/blog/hello",
          query: { tab: "comments", tag: ["a", "b"] },
          segments: ["blog", ["slug", "hello"]],
          params: { lang: "en" }
        }
      }
    });
    expect(route).toEqual({
      pathname: "/blog/hello",
      search: "tab=comments&tag=a&tag=b",
      hash: "",
      params: { slug: "hello", lang: "en" },
      segments: ["blog", "hello"],
      route: "/blog/hello"
    });
    // an object of segments is read as params, as Storybook reads it
    expect(storyRouteOf({ nextjs: { navigation: { segments: { slug: "x" } } } }).params).toEqual({
      slug: "x"
    });
  });

  it("reads the Pages Router's route, its params from the query, and its path", () => {
    const route = storyRouteOf({
      nextjs: { router: { pathname: "/blog/[slug]", query: { slug: "hello", tab: "1" } } }
    });
    expect(route).toMatchObject({
      pathname: "/blog/hello",
      search: "tab=1",
      params: { slug: "hello" },
      route: "/blog/[slug]"
    });
    expect(pagesQueryOf(route)).toEqual({ tab: "1", slug: "hello" });
    const shown = storyRouteOf({
      nextjs: { router: { pathname: "/blog/[slug]", asPath: "/blog/x?y=1#top", query: { slug: "x" } } }
    });
    expect(hrefOfRoute(shown)).toBe("/blog/x?y=1#top");
    expect(
      routeSettingsOf({ nextjs: { router: { locale: "it", locales: ["it", "en", 3], isFallback: true } } })
    ).toEqual({
      locale: "it",
      locales: ["it", "en"],
      defaultLocale: undefined,
      isFallback: true,
      isPreview: false
    });
  });

  it("takes the App Router's path and the Pages Router's route when a story gives both", () => {
    const route = storyRouteOf({
      nextjs: { navigation: { pathname: "/blog/x" }, router: { pathname: "/blog/[slug]" } }
    });
    expect([route.pathname, route.route]).toEqual(["/blog/x", "/blog/[slug]"]);
  });
});

describe("hrefs", () => {
  it("writes URL objects as Next.js's routers do, a route's segments filled in", () => {
    expect(hrefText("/a?b=1")).toEqual({ text: "/a?b=1", route: undefined });
    expect(
      hrefText({ pathname: "/blog/[slug]", query: { slug: "hi there", ref: "nav" }, hash: "top" })
    ).toEqual({
      text: "/blog/hi%20there?ref=nav#top",
      route: "/blog/[slug]"
    });
    expect(hrefText({ pathname: "/s", search: "?q=1" }).text).toBe("/s?q=1");
    expect(hrefText({ pathname: "/s", query: {}, search: "?q=1" }).text).toBe("/s?q=1");
    expect(filledRoute("/docs/[...path]", { path: ["a", "b"] })).toBe("/docs/a/b");
    expect(filledRoute("/docs/[[...path]]", {})).toBe("/docs");
  });

  it("moves a route to an href: relative ones from its path, params kept unless the href names a route", () => {
    const from = storyRouteOf({ nextjs: { navigation: { pathname: "/blog/a", params: { slug: "a" } } } });
    expect(routeAfter(from, "b")).toMatchObject({
      pathname: "/blog/b",
      params: { slug: "a" },
      route: "/blog/b"
    });
    expect(routeAfter(from, "?page=2")).toMatchObject({
      pathname: "/blog/a",
      search: "page=2",
      route: "/blog/a"
    });
    expect(routeAfter(from, { pathname: "/blog/[slug]", query: { slug: "c" } })).toMatchObject({
      pathname: "/blog/c",
      params: { slug: "c" },
      route: "/blog/[slug]"
    });
    // the Pages Router's `as`: the route and its params from the href, the path shown from `as`
    expect(
      routeAfterAs(from, { pathname: "/blog/[slug]", query: { slug: "d" } }, "/blog/d?ref=x")
    ).toMatchObject({
      pathname: "/blog/d",
      search: "ref=x",
      params: { slug: "d" },
      route: "/blog/[slug]"
    });
    // another origin is the browser's: the route does not move
    expect(routeAfter(from, "https://example.com/")).toBeUndefined();
  });
});
