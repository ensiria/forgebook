/**
 * Tests for what the dev server's two origins answer a browser's request: the catalogue refuses another origin's
 * page, the frames' origin serves the frame page, the public folder and the modules the catalogue imports, nothing
 * else; and for the `frames` option, checked and resolved.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  builtPlacement,
  framesOriginOf,
  framesProblem,
  resolvedFrames,
  servedPlacement
} from "../src/vite/framesConfig.ts";
import {
  catalogueAnswer,
  framesAnswer,
  graphUrlOf,
  pageEntries,
  type RequestFacts
} from "../src/vite/originGuard.ts";

/** A request a page made, with what its browser says of it: its address, its query split off. */
const request = (
  address: string,
  facts: Partial<Omit<RequestFacts, "path" | "query">> = {}
): RequestFacts => ({
  path: address.split("?")[0] ?? address,
  query: address.includes("?") ? address.slice(address.indexOf("?")) : "",
  site: "same-origin",
  mode: "cors",
  dest: "script",
  origin: undefined,
  host: "127.0.0.1:5173",
  ...facts
});

/** A request from a tool, which says nothing of a page. */
const TOOL = { site: undefined, mode: undefined, dest: undefined } as const;

/** The server's pages another origin may frame: the preview's. */
const FRAMED: ReadonlySet<string> = new Set(["/__forgebook/api/preview"]);

/** A path that is neither public nor named by the frame page. */
const PLAIN = { isPublic: false, isPageEntry: false, isServedAlike: false };

describe("catalogueAnswer", () => {
  it("refuses what another origin's page asks, a frame's first", () => {
    expect(
      catalogueAnswer(request("/__forgebook/api/stories", { site: "same-site", dest: "empty" }), FRAMED)
    ).toBe("refuse");
    expect(catalogueAnswer(request("/@fs/project/src/secret.ts", { site: "cross-site" }), FRAMED)).toBe(
      "refuse"
    );
  });

  it("serves its own page's requests, a navigation from anywhere, and a tool's", () => {
    expect(catalogueAnswer(request("/src/Button.tsx"), FRAMED)).toBe("serve");
    expect(
      catalogueAnswer(request("/", { site: "cross-site", mode: "navigate", dest: "iframe" }), FRAMED)
    ).toBe("serve");
    expect(catalogueAnswer(request("/__forgebook/api/stories", TOOL), FRAMED)).toBe("serve");
  });

  it("tells another origin's page by its Origin when the browser sends no Sec-Fetch-Site", () => {
    const old = { ...TOOL, origin: "http://127.0.0.1:5174" };
    expect(catalogueAnswer(request("/__forgebook/api/stories", old), FRAMED)).toBe("refuse");
    expect(catalogueAnswer(request("/src/a.ts", { ...TOOL, origin: "null" }), FRAMED)).toBe("refuse");
    expect(catalogueAnswer(request("/src/a.ts", { ...TOOL, origin: "http://127.0.0.1:5173" }), FRAMED)).toBe(
      "serve"
    );
    // a browser that sends Sec-Fetch-Site is believed, whatever a proxy did to the Host
    const proxied = { site: "same-origin", origin: "https://ui-6006.example.dev", host: "localhost:6006" };
    expect(catalogueAnswer(request("/src/a.ts", proxied), FRAMED)).toBe("serve");
  });

  it("refuses to open the server's own routes for another origin's page, even as a navigation", () => {
    const opened = { site: "same-site", mode: "navigate", dest: "iframe" } as const;
    expect(catalogueAnswer(request("/__open-in-editor?file=a.ts", opened), FRAMED)).toBe("refuse");
    expect(
      catalogueAnswer(request("/__open-in-editor?file=a.ts", { ...opened, site: "same-origin" }), FRAMED)
    ).toBe("serve");
  });

  it("opens a page made to be framed for another origin's page, only as a page", () => {
    const framed = { site: "cross-site", mode: "navigate", dest: "iframe" } as const;
    expect(catalogueAnswer(request("/__forgebook/api/preview?id=a--b", framed), FRAMED)).toBe("serve");
    expect(
      catalogueAnswer(request("/__forgebook/api/preview", { site: "cross-site", dest: "empty" }), FRAMED)
    ).toBe("refuse");
    expect(catalogueAnswer(request("/__forgebook/api/preview?id=a--b", framed), new Set())).toBe("refuse");
    expect(catalogueAnswer(request("/__forgebook/api/stories", framed), FRAMED)).toBe("refuse");
  });

  it("sends the frame page to the frames' origin", () => {
    expect(
      catalogueAnswer(request("/frame.html", { site: "none", mode: "navigate", dest: "document" }), FRAMED)
    ).toBe("to-frames");
  });
});

describe("framesAnswer", () => {
  const navigate = { mode: "navigate", dest: "iframe", site: "same-site" } as const;

  it("opens the frame page and the public files, and no other page", () => {
    expect(framesAnswer(request("/frame.html", navigate), PLAIN)).toBe("serve");
    expect(framesAnswer(request("/data.json", navigate), { ...PLAIN, isPublic: true })).toBe("serve");
    expect(framesAnswer(request("/", navigate), PLAIN)).toBe("not-found");
    expect(framesAnswer(request("/__forgebook/api/stories", navigate), PLAIN)).toBe("not-found");
    expect(framesAnswer(request("/src/secret.ts?raw", { dest: "iframe" }), PLAIN)).toBe("not-found");
  });

  it("serves no page of the catalogue's, even to a script", () => {
    expect(framesAnswer(request("/index.html"), { ...PLAIN, isPageEntry: true })).toBe("not-found");
  });

  it("refuses what another origin's page asks", () => {
    expect(framesAnswer(request("/src/Button.tsx", { site: "cross-site" }), PLAIN)).toBe("refuse");
  });

  it("leaves to Vite what a script cannot read as text", () => {
    for (const dest of ["image", "font", "style", "video"])
      expect(framesAnswer(request("/src/assets/x.png", { dest }), PLAIN)).toBe("serve");
  });

  it("asks the graph for a worker's and a worklet's script, and its imports, whose exports reach the page", () => {
    for (const dest of ["worker", "sharedworker", "serviceworker", "audioworklet", "paintworklet"])
      expect(framesAnswer(request("/@fs/project/package.json?raw&import", { dest }), PLAIN)).toBe(
        "ask-graph"
      );
  });

  it("asks the graph for a module made from a file, whatever the request says it becomes", () => {
    for (const query of ["?raw", "?import", "?inline", "?url", "?worker", "?v=1&raw"])
      expect(framesAnswer(request(`/src/secret.ts${query}`, { dest: "image" }), PLAIN)).toBe("ask-graph");
  });

  it("serves the project's API through Vite's proxy, and the paths the configuration names", () => {
    const alike = { ...PLAIN, isServedAlike: true };
    expect(framesAnswer(request("/api/users", { dest: "empty" }), alike)).toBe("serve");
    expect(framesAnswer(request("/api/report.pdf", { mode: "navigate", dest: "iframe" }), alike)).toBe(
      "serve"
    );
  });

  it("refuses the server's own routes on the frames' origin, as anything", () => {
    expect(framesAnswer(request("/__open-in-editor?file=a.ts", { dest: "image" }), PLAIN)).toBe("refuse");
    expect(framesAnswer(request("/__forgebook/api/stories", { dest: "style" }), PLAIN)).toBe("refuse");
  });

  it("serves a script the page names, Vite's client and the public files; asks the graph for the rest", () => {
    expect(framesAnswer(request("/.forgebook-frame.ts"), { ...PLAIN, isPageEntry: true })).toBe("serve");
    expect(framesAnswer(request("/@vite/client"), PLAIN)).toBe("serve");
    expect(framesAnswer(request("/@id/__x00__vite/dynamic-import-helper.js"), PLAIN)).toBe("serve");
    expect(
      framesAnswer(request("/mockServiceWorker.js", { dest: "empty" }), { ...PLAIN, isPublic: true })
    ).toBe("serve");
    expect(framesAnswer(request("/@fs/project/src/secret.ts"), PLAIN)).toBe("ask-graph");
    expect(framesAnswer(request("/src/Button.tsx", { dest: "empty" }), PLAIN)).toBe("ask-graph");
    expect(framesAnswer(request("/src/Button.tsx", TOOL), PLAIN)).toBe("ask-graph");
  });

  it("serves the frame page whatever asks, and a service worker's script only as a script", () => {
    expect(framesAnswer(request("/frame.html", TOOL), PLAIN)).toBe("serve");
    expect(framesAnswer(request("/src/sw.ts", { dest: "serviceworker" }), PLAIN)).toBe("ask-graph");
  });
});

describe("pageEntries", () => {
  it("lists the paths a page's scripts, links and inline imports name, without their query", () => {
    const html = [
      '<script type="module" src="/@vite/client"></script>',
      '<script type="module">import { inject } from "/@react-refresh";</script>',
      '<link rel="stylesheet" href="/fonts.css?v=2" />',
      '<link rel="stylesheet" href="https://fonts.example.com/x.css" />',
      '<script type="module" src="/.forgebook-frame.ts"></script>'
    ].join("\n");
    expect([...pageEntries(html)]).toEqual([
      "/@vite/client",
      "/@react-refresh",
      "/fonts.css",
      "/.forgebook-frame.ts"
    ]);
  });
});

describe("graphUrlOf", () => {
  it("reads an address as Vite's graph names the module", () => {
    expect(graphUrlOf("/src/Button.tsx?t=1")).toBe("/src/Button.tsx?t=1");
    expect(graphUrlOf("/@id/__x00__virtual:forgebook/config")).toBe("\0virtual:forgebook/config");
    expect(graphUrlOf("/@fs/My%20Project/a.ts")).toBe("/@fs/My Project/a.ts");
    expect(graphUrlOf("/%E0%A4%A")).toBeUndefined();
  });
});

describe("the frames option", () => {
  it("accepts none, same-origin, a port and two origins", () => {
    expect(framesProblem(undefined)).toBeUndefined();
    expect(framesProblem("same-origin")).toBeUndefined();
    expect(framesProblem({ port: 6007 })).toBeUndefined();
    expect(
      framesProblem({
        origins: { catalogue: "https://ui.example.com", frames: "https://frames.example.com/" }
      })
    ).toBeUndefined();
  });

  it("takes paths of the project's server, never Vite's or Forgebook's own", () => {
    expect(framesProblem({ paths: ["/api/"] })).toBeUndefined();
    for (const paths of [["/"], ["/@fs/"], ["/__forgebook/"], ["api"], "/api/"])
      expect(framesProblem({ paths })).toContain("frames.paths");
    expect(resolvedFrames({ paths: ["/api/"] })).toEqual({
      kind: "isolated",
      port: undefined,
      origins: undefined,
      paths: ["/api/"]
    });
  });

  it("says what is wrong with the rest", () => {
    expect(framesProblem("sandbox")).toContain('"same-origin"');
    expect(framesProblem({ port: 70000 })).toContain("frames.port");
    expect(framesProblem({ origins: { frames: "https://frames.example.com" } })).toContain("both origins");
    expect(
      framesProblem({ origins: { catalogue: "https://ui.example.com/app", frames: "https://f.example.com" } })
    ).toContain("are origins");
    expect(
      framesProblem({ origins: { catalogue: "javascript:alert(1)", frames: "https://f.example.com" } })
    ).toContain("are origins");
    expect(
      framesProblem({ origins: { catalogue: "https://ui.example.com", frames: "https://ui.example.com/" } })
    ).toContain("two different");
  });

  it("isolates the frames by default on the dev server, and keeps a build on its one host", () => {
    const isolated = resolvedFrames(undefined);
    expect(servedPlacement(isolated, { catalogue: 5173, frames: 5174 })).toEqual({
      kind: "ports",
      catalogue: 5173,
      frames: 5174
    });
    expect(builtPlacement(isolated)).toEqual({ kind: "same-origin" });
    expect(servedPlacement(resolvedFrames("same-origin"), { catalogue: 5173, frames: 5174 })).toEqual({
      kind: "same-origin"
    });
  });

  it("uses the origins it names, normalised, on the dev server and in a build", () => {
    const named = resolvedFrames({
      origins: { catalogue: "https://ui.example.com/", frames: "https://frames.example.com" }
    });
    const placement = {
      kind: "origins",
      catalogue: "https://ui.example.com",
      frames: "https://frames.example.com"
    };
    expect(builtPlacement(named)).toEqual(placement);
    expect(servedPlacement(named, { catalogue: 5173, frames: 5174 })).toEqual(placement);
  });

  it("names the frames' origin for a catalogue reached at an address", () => {
    const ports = { kind: "ports", catalogue: 5173, frames: 5174 } as const;
    expect(framesOriginOf(ports, "http://localhost:5173/")).toBe("http://localhost:5174");
    expect(framesOriginOf({ kind: "same-origin" }, "http://localhost:5173/")).toBeUndefined();
    expect(framesOriginOf(ports, undefined)).toBeUndefined();
  });
});
