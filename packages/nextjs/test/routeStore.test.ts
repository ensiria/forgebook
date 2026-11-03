/**
 * Tests for a story's router: its history, its calls, and the request its server code reads.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { createRouteStore, currentStore, setCurrentStore } from "../src/routeStore.ts";

describe("createRouteStore", () => {
  it("pushes, replaces and moves through the history, telling the catalogue each call", () => {
    const reported: string[] = [];
    const store = createRouteStore({}, (name, values) => reported.push(`${name}(${values.join(",")})`));
    let changes = 0;
    const stop = store.subscribe(() => {
      changes += 1;
    });
    store.navigate("push", "/a");
    store.navigate("push", "/b");
    store.navigate("replace", "/c");
    expect(store.route().pathname).toBe("/c");
    store.go(-1);
    expect(store.route().pathname).toBe("/a");
    store.go(1);
    expect(store.route().pathname).toBe("/c");
    // nothing before the first entry: the route stays
    store.go(-1);
    store.go(-1);
    store.go(-1);
    expect(store.route().pathname).toBe("/");
    // the same href again changes nothing, and an href outside the app moves nothing
    store.navigate("push", "/");
    expect(store.navigate("push", "https://example.com/")).toBe(false);
    stop();
    expect(changes).toBe(7);
    expect(reported.slice(0, 4)).toEqual([
      "router.push(/a)",
      "router.push(/b)",
      "router.replace(/c)",
      "router.back()"
    ]);
    expect(store.calls()).toHaveLength(reported.length);
  });

  it("holds the story's request and makes a store the frame's current one", () => {
    const store = createRouteStore(
      { nextjs: { headers: { "x-tenant": "harbour" }, cookies: { reader: "Ada", bad: 1 }, draftMode: true } },
      undefined
    );
    expect(store.request.headers.get("x-tenant")).toBe("harbour");
    expect([...store.request.cookies]).toEqual([["reader", "Ada"]]);
    expect(store.request.isDraftMode).toBe(true);
    setCurrentStore(store);
    expect(currentStore()).toBe(store);
  });
});
