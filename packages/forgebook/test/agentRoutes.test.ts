/**
 * The API's answers when a catalogue's preview does not load on the server.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { FrameworkAdapter } from "../src/vite/adapter.ts";
import { agentAnswer } from "../src/vite/agentRoutes.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { agentSourcesModule } from "../src/vite/pages.ts";

const FRAMEWORK: FrameworkAdapter = {
  name: "test",
  docsModule: "file:///docs.js",
  pages: { frame: "frame", code: "code" }
};

const CONFIG = resolveConfig(
  { framework: FRAMEWORK, title: "Library", stories: ["*.stories.tsx"] },
  "/library"
);

/** A source of one story, as the agent module gives it. */
const SOURCE = {
  id: "stories",
  name: "Library",
  files: [{ index: { "./a.stories.tsx": { title: "Kit/Button", stories: [{ exportName: "Plain" }] } } }]
};

describe("agentSourcesModule", () => {
  it("imports a preview only when it is asked for: a static import would stop every answer on the server", () => {
    const config = { ...CONFIG, previews: ["/library/preview.ts"] };
    const code = agentSourcesModule(config);
    expect(code).not.toContain("import * as preview");
    expect(code).toContain('() => import("/library/preview.ts")');
  });
});

describe("agentAnswer", () => {
  it("lists the stories when a preview only a browser can load fails on the server", async () => {
    const load = async (): Promise<unknown> => ({
      sources: [SOURCE],
      previews: [(): Promise<unknown> => Promise.reject(new ReferenceError("document is not defined"))]
    });
    const server = { load, resolveSource: async (): Promise<undefined> => undefined };
    const answer = await agentAnswer(server, CONFIG, "stories", new URLSearchParams(), "http://host");
    expect(answer.status).toBe(200);
    expect(JSON.stringify(answer.body)).toContain("stories:kit-button--plain");
  });
});
