/**
 * Tests for what the Network tab is told: its shape, the log's length, and which requests are the story's own.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  isStoryRequest,
  MAX_REQUESTS,
  type NetworkRequest,
  networkReportOf,
  shownUrl,
  withRequest
} from "../src/networkReport.ts";

/** The page's origin. */
const ORIGIN = "http://localhost:6459";

/** A request. */
const REQUEST: NetworkRequest = { method: "GET", url: "/api/a", status: 200, isMocked: true };

describe("networkReportOf", () => {
  it("reads a report back", () => {
    expect(networkReportOf({ handlers: [{ label: "GET /a" }], requests: [{ ...REQUEST }] })).toEqual({
      handlers: [{ label: "GET /a" }],
      requests: [REQUEST]
    });
  });

  it("reads nothing from what is not one", () => {
    expect(networkReportOf(undefined)).toBeUndefined();
    expect(networkReportOf(null)).toBeUndefined();
    expect(networkReportOf({ handlers: 1, requests: [] })).toBeUndefined();
  });
});

describe("the log", () => {
  it("keeps the latest first, and stays short", () => {
    let requests: readonly NetworkRequest[] = [];
    for (let index = 0; index <= MAX_REQUESTS; index += 1) {
      requests = withRequest(requests, { ...REQUEST, url: `/${index}` });
    }
    expect(requests).toHaveLength(MAX_REQUESTS);
    expect(requests[0]?.url).toBe(`/${MAX_REQUESTS}`);
  });

  it("writes the page's own addresses without their origin", () => {
    expect(shownUrl(`${ORIGIN}/api/a?b=1`, ORIGIN)).toBe("/api/a?b=1");
    expect(shownUrl("https://api.example.test/a", ORIGIN)).toBe("https://api.example.test/a");
  });
});

describe("isStoryRequest", () => {
  it("keeps what a story asks for", () => {
    expect(isStoryRequest(`${ORIGIN}/api/users`, ORIGIN)).toBe(true);
    expect(isStoryRequest("https://api.example.test/users", ORIGIN)).toBe(true);
  });

  it("leaves out the page's own files and the dev server's", () => {
    expect(isStoryRequest(`${ORIGIN}/src/Select.tsx?t=1`, ORIGIN)).toBe(false);
    expect(isStoryRequest(`${ORIGIN}/@fs/repo/kit.scss`, ORIGIN)).toBe(false);
    expect(isStoryRequest(`${ORIGIN}/node_modules/.vite/deps/react.js?v=1`, ORIGIN)).toBe(false);
    expect(isStoryRequest(`${ORIGIN}/@vite/client`, ORIGIN)).toBe(false);
    expect(isStoryRequest("https://fonts.example.test/inter.woff2", ORIGIN)).toBe(false);
  });
});
