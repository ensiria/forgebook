/**
 * Tests for the errors the open frames report: the ring that keeps the last ones numbered, a frame's report read off the
 * connection, and the command's reading of an answer and of `--since`.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { errorsOutput } from "../bin/forgebook/agentText.ts";
import { askErrors, followErrors, sinceOf } from "../bin/forgebook/errorsRun.ts";
import {
  createLiveErrors,
  isLiveErrorReport,
  isMappedStackAnswer,
  type LiveErrorReport
} from "../src/liveErrors.ts";
import type { ErrorsDocument } from "../src/vite/agent.types.ts";

const REPORT: LiveErrorReport = {
  kind: "render",
  storyId: "kit:a--b",
  view: "?theme=dark",
  message: "It threw"
};
const AT = new Date("2026-10-31T12:00:00Z");

describe("createLiveErrors", () => {
  it("numbers the errors as they come, gives those after a number, and keeps only the last ones", () => {
    const live = createLiveErrors(2);
    expect(live.last()).toBe(0);
    expect(live.add(REPORT, AT)).toEqual({ ...REPORT, n: 1, at: "2026-10-31T12:00:00.000Z" });
    live.add({ ...REPORT, kind: "play" }, AT);
    live.add({ ...REPORT, message: "Again" }, AT);
    expect(live.since(0).map((error) => error.n)).toEqual([2, 3]);
    expect(live.since(2).map((error) => error.message)).toEqual(["Again"]);
    expect(live.last()).toBe(3);
  });
});

describe("isLiveErrorReport", () => {
  it("takes a frame's report, and refuses anything else off the connection", () => {
    expect(isLiveErrorReport(REPORT)).toBe(true);
    expect(isLiveErrorReport({ ...REPORT, kind: "crash" })).toBe(false);
    expect(isLiveErrorReport({ kind: "render" })).toBe(false);
    expect(isLiveErrorReport("render")).toBe(false);
  });

  it("takes a report's stack when it is text", () => {
    expect(isLiveErrorReport({ ...REPORT, stack: "Error: It threw" })).toBe(true);
    expect(isLiveErrorReport({ ...REPORT, stack: 3 })).toBe(false);
  });
});

describe("isMappedStackAnswer", () => {
  it("takes the dev server's mapped stack, and refuses anything else", () => {
    expect(isMappedStackAnswer({ sent: "at a (x:19:1)", stack: "at a (x:3:1)" })).toBe(true);
    expect(isMappedStackAnswer({ sent: "at a (x:19:1)" })).toBe(false);
    expect(isMappedStackAnswer(null)).toBe(false);
  });
});

describe("forgebook errors' parts", () => {
  const document: ErrorsDocument = {
    schema: 1,
    errors: [{ ...REPORT, n: 4, at: "2026-10-31T12:00:00.000Z" }],
    last: 4,
    problems: []
  };

  it("reads --since as a whole number above 0, else every error kept", () => {
    expect(sinceOf("4")).toBe(4);
    expect(sinceOf(undefined)).toBe(0);
    expect(sinceOf("-2")).toBe(0);
    expect(sinceOf("soon")).toBe(0);
  });

  it("asks for the errors after a number, and says so when the catalogue does not answer with them", async () => {
    let asked = "";
    const answered = await askErrors((route, params) => {
      asked = `${route}?${params.toString()}`;
      return Promise.resolve({ status: 200, body: document });
    }, 3);
    expect(asked).toBe("errors?since=3");
    expect(answered).toEqual(document);
    expect(await askErrors(() => Promise.resolve({ status: 500, body: { error: "down" } }), 0)).toBe(
      "The catalogue answered 500 for its errors"
    );
  });

  it("says when the catalogue stopped answering, and asks a restarted one from the start", async () => {
    expect(await askErrors(() => Promise.reject(new Error("fetch failed")), 0)).toBe(
      "The catalogue stopped answering: fetch failed"
    );
    // the first answer counts up to 5; the restarted server's counts only 1, so it is asked from 0 again
    const asked: string[] = [];
    const answers = [
      { ...document, last: 5, errors: [] },
      { ...document, last: 1, errors: [] },
      { ...document, last: 1 }
    ];
    const controller = new AbortController();
    const seen: number[] = [];
    await followErrors(
      (_route, params) => {
        asked.push(params.get("since") ?? "");
        const answer = answers.shift();
        if (answers.length === 0) controller.abort();
        return Promise.resolve({ status: 200, body: answer ?? document });
      },
      0,
      (each) => seen.push(each.last),
      controller.signal
    );
    expect(asked).toEqual(["0", "5", "0"]);
    expect(seen).toEqual([1]);
  });

  it("prints one JSON line per error while following, the whole document otherwise", () => {
    const style = { color: false, unicode: false, width: 200 };
    expect(errorsOutput(document, { isJson: true, isFollowing: true }, style)).toBe(
      `${JSON.stringify(document.errors[0])}\n`
    );
    expect(JSON.parse(errorsOutput(document, { isJson: true, isFollowing: false }, style))).toEqual(document);
    expect(errorsOutput(document, { isJson: false, isFollowing: false }, style)).toContain(
      "render: It threw"
    );
    const placed: ErrorsDocument = {
      ...document,
      errors: [{ ...REPORT, place: "src/A.stories.tsx:3:9", n: 4, at: "2026-10-31T12:00:00.000Z" }]
    };
    expect(errorsOutput(placed, { isJson: false, isFollowing: false }, style)).toContain(
      "render: src/A.stories.tsx:3:9: It threw"
    );
  });
});
