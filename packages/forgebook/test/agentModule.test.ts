/**
 * Tests for the module the dev server answers tools from, when a catalogue's preview does not load on the server.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { agentModuleOf } from "../src/vite/agentRoutes.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { agentSourcesModule } from "../src/vite/pages.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A source of one story, as the agent module gives it. */
const SOURCE = {
  id: "stories",
  name: "Library",
  files: [{ index: { "./a.stories.tsx": { title: "Kit/Button", stories: [{ exportName: "Plain" }] } } }]
};

describe("agentSourcesModule", () => {
  it("leaves the previews out: one only a browser can load would stop every answer on the server", () => {
    const config = resolveConfig(
      { framework: STUB_FRAMEWORK, title: "Library", stories: ["*.stories.tsx"], preview: "./preview.ts" },
      "/library"
    );
    expect(agentSourcesModule(config)).not.toContain("preview");
  });
});

describe("agentModuleOf", () => {
  it("keeps the stories and the previews that load when one only a browser can load fails on the server", async () => {
    const loaded = await agentModuleOf({ sources: [SOURCE] }, [
      (): Promise<unknown> => Promise.reject(new ReferenceError("document is not defined")),
      (): Promise<unknown> => Promise.resolve({ parameters: { layout: "centered" } })
    ]);
    expect(loaded.sources).toEqual([SOURCE]);
    expect(loaded.preview.parameters).toMatchObject({ layout: "centered" });
    expect(loaded.problems).toEqual([expect.stringContaining("document is not defined")]);
  });

  it("refuses what is not the module the plugin writes", async () => {
    await expect(agentModuleOf({ previews: [] }, [])).rejects.toThrow("did not load");
  });
});
