/**
 * The table's pull request, against a recorded GitHub: a first run makes the branch from the base and opens the pull
 * request; with one open, a commit goes on top without forcing and its description is replaced; a branch left with no
 * pull request starts again from the base; a commit that changes nothing is not made.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { COMMIT_MESSAGE, type GitHubAccess, publishTable, TABLE_BRANCH } from "./publish.ts";

/** A recorded request. */
type Call = { method: string; path: string; body: unknown };

/** A GitHub that answers from a table of routes (204 for a deletion) and records every call. */
const fakeGitHub = (routes: Record<string, unknown>): { access: GitHubAccess; calls: Call[] } => {
  const calls: Call[] = [];
  const fake: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = `${url.pathname.replace("/repos/o/r", "")}${url.search}`;
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (method === "DELETE") return new Response(null, { status: 204 });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response("not found", { status: 404 });
    return Response.json(routes[key]);
  };
  return { access: { repository: "o/r", token: "t", base: "develop", fetch: fake }, calls };
};

const FILES = [{ path: "docs/compatibility.md", content: "# Compatibility\n" }];
const PULLS = `/pulls?state=open&base=develop&head=${encodeURIComponent(`o:${TABLE_BRANCH}`)}`;

/** The routes of a base branch whose tree the new files change. */
const FROM_BASE = {
  "GET /git/ref/heads/develop": { object: { sha: "base" } },
  "GET /git/commits/base": { tree: { sha: "base-tree" } },
  "POST /git/trees": { sha: "tree" },
  "POST /git/commits": { sha: "commit" },
  "POST /git/refs": {},
  "POST /pulls": { html_url: "https://github.com/o/r/pull/9" }
};

describe("publishTable", () => {
  it("makes the branch from the base and opens the pull request on a first run", async () => {
    const { access, calls } = fakeGitHub({ ...FROM_BASE, [`GET ${PULLS}`]: [] });
    expect(await publishTable(access, FILES, "body")).toBe("https://github.com/o/r/pull/9");
    expect(calls.find((call) => call.path === "/git/commits")?.body).toEqual({
      message: COMMIT_MESSAGE,
      tree: "tree",
      parents: ["base"]
    });
    expect(calls.find((call) => call.path === "/git/refs")?.body).toEqual({
      ref: `refs/heads/${TABLE_BRANCH}`,
      sha: "commit"
    });
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("starts a branch left by a closed or merged pull request again from the base", async () => {
    const { access, calls } = fakeGitHub({
      ...FROM_BASE,
      [`GET ${PULLS}`]: [],
      [`GET /git/ref/heads/${TABLE_BRANCH}`]: { object: { sha: "old" } }
    });
    await publishTable(access, FILES, "body");
    expect(calls.find((call) => call.method === "DELETE")?.path).toBe(`/git/refs/heads/${TABLE_BRANCH}`);
    expect(calls.find((call) => call.path === "/git/commits")?.body).toMatchObject({ parents: ["base"] });
  });

  it("adds a commit on top of an open pull request's branch without forcing, and replaces its description", async () => {
    const { access, calls } = fakeGitHub({
      [`GET ${PULLS}`]: [{ number: 7, html_url: "https://github.com/o/r/pull/7" }],
      [`GET /git/ref/heads/${TABLE_BRANCH}`]: { object: { sha: "head" } },
      "GET /git/commits/head": { tree: { sha: "head-tree" } },
      "POST /git/trees": { sha: "tree" },
      "POST /git/commits": { sha: "commit" },
      [`PATCH /git/refs/heads/${TABLE_BRANCH}`]: {},
      "PATCH /pulls/7": {}
    });
    expect(await publishTable(access, FILES, "new body")).toBe("https://github.com/o/r/pull/7");
    expect(calls.find((call) => call.path.startsWith("/git/refs/"))?.body).toEqual({
      sha: "commit",
      force: false
    });
    expect(calls.find((call) => call.path === "/pulls/7")?.body).toEqual({ body: "new body" });
    expect(calls.find((call) => call.path === "/git/trees")?.body).toEqual({
      base_tree: "head-tree",
      tree: [{ path: "docs/compatibility.md", mode: "100644", type: "blob", content: "# Compatibility\n" }]
    });
    expect(
      calls.some((call) => call.method === "DELETE" || (call.path === "/pulls" && call.method === "POST"))
    ).toBe(false);
  });

  it("makes no commit when the files are already on the branch", async () => {
    const { access, calls } = fakeGitHub({
      [`GET ${PULLS}`]: [{ number: 7, html_url: "https://github.com/o/r/pull/7" }],
      [`GET /git/ref/heads/${TABLE_BRANCH}`]: { object: { sha: "head" } },
      "GET /git/commits/head": { tree: { sha: "same" } },
      "POST /git/trees": { sha: "same" },
      "PATCH /pulls/7": {}
    });
    await publishTable(access, FILES, "body");
    expect(calls.some((call) => call.path === "/git/commits")).toBe(false);
    expect(calls.some((call) => call.path.startsWith("/git/refs/"))).toBe(false);
  });
});
