/**
 * Tests for where a catalogue's frames run: the two origins each page works out, the frame page's address, and the
 * frame's channel with its shell, which hears only its parent on the catalogue's origin.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type FrameWindow, type ShellEvent, shellChannel } from "../src/frame/shellChannel.ts";
import { framePageAddress, pageOrigins, SAME_ORIGIN } from "../src/frameOrigins.ts";

/** A page's address, as `window.location` gives it. */
const at = (href: string): { protocol: string; hostname: string; origin: string } => {
  const url = new URL(href);
  return { protocol: url.protocol, hostname: url.hostname, origin: url.origin };
};

/** The dev server's placement: the catalogue on 5173, the frames on 5174. */
const PORTS = { kind: "ports", catalogue: 5173, frames: 5174 } as const;

describe("pageOrigins", () => {
  it("puts both on the page's own origin when the frames share it", () => {
    expect(pageOrigins(SAME_ORIGIN, at("http://localhost:5173/"), "catalogue")).toEqual({
      catalogue: "http://localhost:5173",
      frames: "http://localhost:5173"
    });
  });

  it("puts the frames on the catalogue's host at their port, seen from either page", () => {
    const origins = { catalogue: "http://127.0.0.1:5173", frames: "http://127.0.0.1:5174" };
    expect(pageOrigins(PORTS, at("http://127.0.0.1:5173/?story=a"), "catalogue")).toEqual(origins);
    expect(pageOrigins(PORTS, at("http://127.0.0.1:5174/frame.html?story=a"), "frame")).toEqual(origins);
  });

  it("keeps the host the page was reached by, and writes a default port as a browser does", () => {
    expect(pageOrigins(PORTS, at("http://localhost:5173/"), "catalogue").frames).toBe(
      "http://localhost:5174"
    );
    expect(pageOrigins(PORTS, at("http://[::1]:5173/"), "catalogue").frames).toBe("http://[::1]:5174");
    const onDefault = { kind: "ports", catalogue: 8080, frames: 443 } as const;
    expect(pageOrigins(onDefault, at("https://dev.example.com:8080/"), "catalogue").frames).toBe(
      "https://dev.example.com"
    );
  });

  it("takes the origins a configuration names, whatever the page's address", () => {
    const named = {
      kind: "origins",
      catalogue: "https://ui.example.com",
      frames: "https://frames.example.com"
    } as const;
    expect(pageOrigins(named, at("https://frames.example.com/frame.html"), "frame").catalogue).toBe(
      "https://ui.example.com"
    );
  });
});

describe("framePageAddress", () => {
  it("names the frame page on the frames' origin, under the catalogue's path", () => {
    expect(framePageAddress("frame.html", "http://localhost:5174", "/")).toBe(
      "http://localhost:5174/frame.html"
    );
    expect(framePageAddress("frame.html", "https://frames.example.com", "/pr-12/")).toBe(
      "https://frames.example.com/pr-12/frame.html"
    );
    expect(framePageAddress("frame.html", "https://frames.example.com", "/pr-12/index.html")).toBe(
      "https://frames.example.com/pr-12/frame.html"
    );
  });
});

/** A frame's window with its parent page, recording what the frame posts and delivering what is sent to it. */
const frameWindow = (
  href: string
): {
  readonly frame: FrameWindow;
  readonly parent: { readonly posted: { message: unknown; targetOrigin: string }[] };
  readonly deliver: (event: ShellEvent) => void;
} => {
  const posted: { message: unknown; targetOrigin: string }[] = [];
  const parent = {
    posted,
    postMessage: (message: unknown, targetOrigin: string): void => {
      posted.push({ message, targetOrigin });
    }
  };
  const listeners: ((event: ShellEvent) => void)[] = [];
  const frame: FrameWindow = {
    location: at(href),
    parent,
    addEventListener: (_type: "message", listener: (event: ShellEvent) => void): void => {
      listeners.push(listener);
    }
  };
  const deliver = (event: ShellEvent): void => {
    for (const listener of listeners) listener(event);
  };
  return { frame, parent, deliver };
};

describe("shellChannel", () => {
  const replay = { type: "forgebook:replay" } as const;

  it("tells the catalogue's origin only", () => {
    const { frame, parent } = frameWindow("http://127.0.0.1:5174/frame.html?story=a");
    shellChannel(PORTS, frame).tell({ type: "forgebook:size", storyId: "a", height: 10 });
    expect(parent.posted).toEqual([
      {
        message: { type: "forgebook:size", storyId: "a", height: 10 },
        targetOrigin: "http://127.0.0.1:5173"
      }
    ]);
  });

  it("hears its parent on the catalogue's origin, and nobody else", () => {
    const { frame, parent, deliver } = frameWindow("http://127.0.0.1:5174/frame.html?story=a");
    const heard: unknown[] = [];
    shellChannel(PORTS, frame).listen((message) => heard.push(message));
    deliver({ origin: "http://127.0.0.1:5173", source: parent, data: replay });
    // another page that framed the story, a window that is not the parent, the frames' own origin, a stray message
    deliver({ origin: "https://evil.example", source: parent, data: replay });
    deliver({ origin: "http://127.0.0.1:5173", source: {}, data: replay });
    deliver({ origin: "http://127.0.0.1:5174", source: parent, data: replay });
    deliver({ origin: "http://127.0.0.1:5173", source: parent, data: { type: "forgebook:unknown" } });
    expect(heard).toEqual([replay]);
  });

  it("tells nobody when opened alone, its own parent", () => {
    const posted: unknown[] = [];
    const lone: FrameWindow & FrameWindow["parent"] = {
      location: at("http://127.0.0.1:5174/frame.html?story=a"),
      get parent(): FrameWindow["parent"] {
        return lone;
      },
      postMessage: (message: unknown): void => {
        posted.push(message);
      },
      addEventListener: (): void => undefined
    };
    shellChannel(PORTS, lone).tell({ type: "forgebook:size", storyId: "a", height: 10 });
    expect(posted).toEqual([]);
  });
});
