/**
 * Tests for a story's address shown alone and the HTML that shows it in another page.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { codeLiteral } from "../src/codeLiteral.ts";
import { isEmbedAddress } from "../src/embed.ts";
import { embedAddressOf, embedCode, isLocalAddress } from "../src/embedCode.ts";
import { switchesProblem, themeSwitch } from "../src/switches.ts";
import { frameAddressOf } from "../src/viewState.ts";

/** A story's address. */
const LINK = "https://ui.example.com/?embed&story=kit%3Abutton--primary";

describe("the embed's address", () => {
  it("is asked for by its parameter, with a value or none", () => {
    expect(isEmbedAddress("?embed&story=a")).toBe(true);
    expect(isEmbedAddress("story=a&embed=1")).toBe(true);
    expect(isEmbedAddress("?story=a")).toBe(false);
    expect(isEmbedAddress("")).toBe(false);
    expect(isEmbedAddress("?embed=0&story=a")).toBe(false);
    expect(isEmbedAddress("?embed=false&story=a")).toBe(false);
  });

  it("is a name no switch may take, or that catalogue's links would all turn into embeds", () => {
    expect(switchesProblem([{ ...themeSwitch(), id: "embed" }])).toBeDefined();
  });

  it("keeps what draws the story and leaves out the stage's own settings", () => {
    const link = embedAddressOf(
      "https://ui.example.com/",
      "kit:a",
      "?theme=dark&width=360&compare=theme&zoom=150&panel=closed&tab=code&tools=grid&matrix=a&component=b&embed"
    );
    expect(link).toBe("https://ui.example.com/?embed&theme=dark&width=360&story=kit%3Aa");
  });

  it("names the story given, not one the view repeats", () => {
    expect(embedAddressOf("/", "b", "story=a")).toBe("/?embed&story=b");
  });

  it("stays out of a frame's address", () => {
    expect(frameAddressOf("frame.html", "a", "embed&theme=dark")).toBe("frame.html?theme=dark&story=a");
  });
});

describe("the embed's code", () => {
  it("is an iframe with a title and a height, and no script unless asked", () => {
    const code = embedCode({ link: LINK, title: "Button: Primary", height: 312.4, isFollowing: false });
    expect(code).toBe(
      `<iframe src="https://ui.example.com/?embed&amp;story=kit%3Abutton--primary" title="Button: Primary" width="100%" height="312" loading="lazy" style="border: 0"></iframe>`
    );
  });

  it("escapes what could end an attribute", () => {
    const code = embedCode({
      link: 'https://ui.example.com/?a="><script>&b=1',
      title: 'A "quoted" <title>',
      height: 100,
      isFollowing: false
    });
    expect(code).not.toContain("<script>");
    expect(code).toContain("&quot;&gt;&lt;script&gt;&amp;b=1");
    expect(code).toContain('title="A &quot;quoted&quot; &lt;title&gt;"');
  });

  it("answers only its own frame and origin when it follows the story", () => {
    const code = embedCode({ link: LINK, title: "A", height: 100, isFollowing: true });
    expect(code).toContain(`origin !== ${codeLiteral("https://ui.example.com")}`);
    expect(code).toContain("source !== frame.contentWindow");
    expect(code).toContain('"forgebook:embed-size"');
    expect(code).toContain("Number.isFinite(data.height)");
    expect(code.match(/<\/script>/g)).toHaveLength(1);
  });

  it("knows a link that opens only on this computer", () => {
    expect(isLocalAddress("http://localhost:5173/?embed")).toBe(true);
    expect(isLocalAddress("http://127.0.0.1:5173/")).toBe(true);
    expect(isLocalAddress("http://[::1]:5173/")).toBe(true);
    expect(isLocalAddress(LINK)).toBe(false);
  });
});
