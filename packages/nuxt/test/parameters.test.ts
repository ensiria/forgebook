/**
 * Tests for what a story's `parameters.nuxt` is read as, and for the addresses `$fetch` asks.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { createError } from "../src/nuxtError.ts";
import { mergedRecords, storyLocationOf, storyNuxtOf } from "../src/parameters.ts";
import { FetchError, fetchAddress } from "../src/storyFetch.ts";

describe("a story's Nuxt settings", () => {
  it("reads a route as a path, a location by path or by name, and anything else as home", () => {
    expect(storyLocationOf("/blog/a")).toBe("/blog/a");
    expect(storyLocationOf({ path: "/a", query: { tab: 1, tags: ["x", 2, {}] }, hash: "#top" })).toEqual({
      path: "/a",
      query: { tab: "1", tags: ["x", "2"] },
      hash: "#top"
    });
    expect(storyLocationOf({ name: "blog-slug", params: { slug: "a", bad: {} } })).toEqual({
      name: "blog-slug",
      params: { slug: "a" },
      query: {}
    });
    expect(storyLocationOf(3)).toBe("/");
    expect(storyLocationOf({ other: true })).toBe("/");
  });

  it("leaves out what is not an object, and reads the public runtime config only", () => {
    expect(
      storyNuxtOf({ nuxt: { data: 1, state: { a: 1 }, runtimeConfig: { secret: "x", public: { b: 2 } } } })
    ).toEqual({
      route: "/",
      data: {},
      state: { a: 1 },
      cookies: {},
      publicRuntimeConfig: { b: 2 },
      appConfig: {}
    });
  });

  it("merges configs in depth, the later's values over the earlier's", () => {
    expect(mergedRecords({ a: { b: 1, c: 2 }, d: [1] }, { a: { c: 3 }, d: [2] })).toEqual({
      a: { b: 1, c: 3 },
      d: [2]
    });
  });
});

describe("$fetch's addresses and errors", () => {
  it("puts the base before a relative address, and the query after it", () => {
    expect(fetchAddress("api/a", "/shop/", { page: 2, tags: ["x", "y"], none: undefined })).toBe(
      "/shop/api/a?page=2&tags=x&tags=y"
    );
    expect(fetchAddress("/api/a?x=1", "/", { y: 2 })).toBe("/api/a?x=1&y=2");
    expect(fetchAddress("https://example.com/a", "/shop/", {})).toBe("https://example.com/a");
  });

  it("takes a base with trailing slashes, however many, and is not slowed by a run inside it", () => {
    expect(fetchAddress("a", "/shop///", {})).toBe("/shop/a");
    const run = "/".repeat(200_000);
    const start = performance.now();
    expect(fetchAddress("a", `${run}shop`, {})).toBe(`${run}shop/a`);
    // a pattern anchored at the end takes more than ten seconds on this
    expect(performance.now() - start).toBeLessThan(5000);
  });

  it("makes Nuxt's error from a failed answer, with its status and data", () => {
    const error = createError(
      new FetchError("/api/a", new Response(null, { status: 404 }), { reason: "gone" })
    );
    expect(error).toMatchObject({ statusCode: 404, data: { reason: "gone" } });
    expect(createError("Plain").statusCode).toBe(500);
  });
});
