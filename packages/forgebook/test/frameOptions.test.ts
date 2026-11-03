/**
 * Tests for where the command line puts the stories' frames: `--frames` and `--frame-port` over the configuration
 * file's choice.
 *
 * @module
 */
import { ScriptError } from "@ensiria/cli-kit/script";
import { describe, expect, it } from "vitest";

import { withFramePort, withFramesMode } from "../bin/forgebook/catalogueVite.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A catalogue whose file keeps the frames on an origin of their own, on a port it names. */
const ISOLATED = resolveConfig(
  { framework: STUB_FRAMEWORK, title: "Catalogue", sources: [], frames: { port: 7000 } },
  "/catalogue"
);

/** A catalogue whose file keeps the frames on the catalogue's origin. */
const SAME_ORIGIN = resolveConfig(
  { framework: STUB_FRAMEWORK, title: "Catalogue", sources: [], frames: "same-origin" },
  "/catalogue"
);

describe("withFramesMode", () => {
  it("moves the frames to the catalogue's origin when asked", () => {
    expect(withFramesMode(ISOLATED, "same-origin").frames).toEqual({ kind: "same-origin" });
  });

  it("gives the frames an origin of their own over a file that keeps them on the catalogue's", () => {
    expect(withFramesMode(SAME_ORIGIN, "isolated").frames).toEqual(ISOLATED_FRAMES);
  });

  it("keeps the file's choice, its port included, when not asked or asked for the same", () => {
    expect(withFramesMode(ISOLATED, undefined)).toBe(ISOLATED);
    expect(withFramesMode(ISOLATED, "isolated")).toBe(ISOLATED);
    expect(withFramesMode(SAME_ORIGIN, "same-origin")).toBe(SAME_ORIGIN);
  });

  it("refuses a frames' port with the frames on the catalogue's origin, since they then have none", () => {
    expect(() => withFramePort(withFramesMode(ISOLATED, "same-origin"), "6007")).toThrow(ScriptError);
  });
});

describe("withFramePort", () => {
  it("gives the frames the port named", () => {
    expect(withFramePort(withFramesMode(SAME_ORIGIN, "isolated"), "6007").frames).toMatchObject({
      port: 6007
    });
  });

  it("refuses what is not a port", () => {
    expect(() => withFramePort(ISOLATED, "70000")).toThrow("--frame-port 70000 is not a port");
  });
});
