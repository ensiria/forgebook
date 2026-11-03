/**
 * Tests for SvelteKit's route ids as the catalogue reads them: the route a path matches, its params, and the path a
 * route id gives.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { filledRoute, isRouteId, matchRoute } from "../src/routeIds.ts";

/** A project's routes, in no order. */
const ROUTES = [
  "/",
  "/blog",
  "/blog/[slug]",
  "/blog/new",
  "/(app)/settings",
  "/docs/[...path]",
  "/[[lang]]/about",
  "/items/[id=integer]",
  "/files/[name].[ext]"
];

describe("matchRoute", () => {
  it("matches a path to the route SvelteKit would choose, with its params", () => {
    expect(matchRoute(ROUTES, "/")).toEqual({ id: "/", params: {} });
    expect(matchRoute(ROUTES, "/blog/hello")).toEqual({ id: "/blog/[slug]", params: { slug: "hello" } });
    expect(matchRoute(ROUTES, "/blog/new")).toEqual({ id: "/blog/new", params: {} });
    expect(matchRoute(ROUTES, "/blog/")).toEqual({ id: "/blog", params: {} });
  });

  it("leaves a layout group out of the path, and takes any value for a param with a matcher", () => {
    expect(matchRoute(ROUTES, "/settings")).toEqual({ id: "/(app)/settings", params: {} });
    expect(matchRoute(ROUTES, "/items/42")).toEqual({ id: "/items/[id=integer]", params: { id: "42" } });
  });

  it("reads rest and optional params, present or not, and several params in one segment", () => {
    expect(matchRoute(ROUTES, "/docs/a/b/c")).toEqual({ id: "/docs/[...path]", params: { path: "a/b/c" } });
    expect(matchRoute(ROUTES, "/docs")).toEqual({ id: "/docs/[...path]", params: { path: "" } });
    expect(matchRoute(ROUTES, "/it/about")).toEqual({ id: "/[[lang]]/about", params: { lang: "it" } });
    expect(matchRoute(ROUTES, "/about")).toEqual({ id: "/[[lang]]/about", params: { lang: "" } });
    expect(matchRoute(ROUTES, "/files/report.pdf")).toEqual({
      id: "/files/[name].[ext]",
      params: { name: "report", ext: "pdf" }
    });
  });

  it("chooses between routes in SvelteKit's own order", () => {
    expect(matchRoute(["/[a]/[b]", "/[...rest]/edit"], "/x/edit")?.id).toBe("/[...rest]/edit");
    expect(matchRoute(["/[slug]/about", "/[[lang]]/about"], "/en/about")?.id).toBe("/[[lang]]/about");
    expect(matchRoute(["/[id]", "/[id=integer]"], "/7")?.id).toBe("/[id=integer]");
    expect(matchRoute(["/[slug]", "/[[optional]]"], "/x")?.id).toBe("/[slug]");
  });

  it("decodes a param, and matches nothing outside the routes", () => {
    expect(matchRoute(ROUTES, "/blog/caf%C3%A9")?.params).toEqual({ slug: "café" });
    expect(matchRoute(ROUTES, "/nowhere/at/all")).toBeUndefined();
    expect(matchRoute([], "/")).toBeUndefined();
  });
});

describe("filledRoute and isRouteId", () => {
  it("writes a route id's path with its params, groups and empty optional params left out", () => {
    expect(filledRoute("/blog/[slug]", { slug: "hello world" })).toBe("/blog/hello world");
    expect(filledRoute("/(app)/settings", {})).toBe("/settings");
    expect(filledRoute("/[[lang]]/about", {})).toBe("/about");
    expect(filledRoute("/docs/[...path]", { path: "a/b" })).toBe("/docs/a/b");
    expect(filledRoute("/", {})).toBe("/");
  });

  it("tells a route id from a path", () => {
    expect(isRouteId("/blog/[slug]")).toBe(true);
    expect(isRouteId("/(app)/settings")).toBe(true);
    expect(isRouteId("/blog/hello")).toBe(false);
  });
});
