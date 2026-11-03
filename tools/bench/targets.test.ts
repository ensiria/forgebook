/**
 * What the tools are told, and what differs between them.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { buildCorpus } from "./corpus.ts";
import { withPorts } from "./runBench.ts";
import { FORGEBOOK, forgebookTarget, LADLE, STORYBOOK, TARGETS, targetsOf } from "./targets.ts";

const COMPONENT = buildCorpus({ components: 8, stories: 16 }).components[0];
const BASE = "http://127.0.0.1:1/";

describe("targets", () => {
  it("addresses the first story as each tool writes its ids", () => {
    if (COMPONENT === undefined) throw new Error("no component");
    expect(FORGEBOOK.storyUrl(BASE, COMPONENT)).toBe(`${BASE}?story=stories%3Aactions-widget0--story0`);
    expect(STORYBOOK.storyUrl(BASE, COMPONENT)).toBe(`${BASE}?path=/story/actions-widget0--story-0`);
    expect(LADLE.storyUrl(BASE, COMPONENT)).toBe(`${BASE}?story=actions--widget0--story0`);
  });

  it("gives Ladle no page of a component and no props table, so those metrics read as absent", () => {
    expect(LADLE.componentUrl).toBeUndefined();
    expect(LADLE.propsTable).toBeUndefined();
  });

  it("removes Storybook's own cache on a cold start, or it would be a warm one", () => {
    expect(STORYBOOK.caches).toContain("node_modules/.cache");
  });

  it("names Forgebook's frame port, the one after its own, so a taken port fails instead of moving", () => {
    expect(FORGEBOOK.ports).toBe(2);
    expect(FORGEBOOK.dev(4000).args).toEqual([
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4000",
      "--frame-port",
      "4001"
    ]);
    expect(FORGEBOOK.configFiles["forgebook.config.ts"]).not.toContain("frames");
  });

  it("keeps Forgebook's frames on the catalogue's origin when asked, on one port", () => {
    const sameOrigin = forgebookTarget("same-origin");
    expect(sameOrigin.ports).toBe(1);
    expect(sameOrigin.dev(4000).args).not.toContain("--frame-port");
    expect(sameOrigin.configFiles["forgebook.config.ts"]).toContain(
      'switches: [themeSwitch()],\n  frames: "same-origin"\n});'
    );
  });

  it("gives each tool ports of its own, after the ports of the one before", () => {
    const ports = withPorts(targetsOf("isolated", true)).map(({ target, port }) => [target.name, port]);
    expect(ports).toEqual([
      ["forgebook", 62_100],
      ["storybook", 62_102],
      ["ladle", 62_103]
    ]);
    expect(targetsOf("same-origin", false).map((target) => target.name)).toEqual(["forgebook"]);
  });

  it("writes Ladle the one story form it draws", () => {
    expect(LADLE.form).toBe("functions");
    expect(TARGETS.filter((target) => target.form === "csf3").map((target) => target.name)).toEqual([
      "forgebook",
      "storybook"
    ]);
  });
});
