/**
 * Tests for the token tools as an agent calls them: each asks the catalogue the right question and gives back its
 * answer, and what an agent has to pass is declared.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueTools } from "../bin/forgebook/mcpTools.ts";
import type { AgentAnswer } from "../src/vite/agentRoutes.ts";
import { pluginsDocument } from "../src/vite/pluginConfig.ts";

/** The questions the tools asked. */
const asked: string[] = [];

const TOOLS = catalogueTools({
  ask: async (route: string, params: URLSearchParams): Promise<AgentAnswer> => {
    asked.push(`${route}?${params.toString()}`);
    return { status: 200, body: { schema: 1 } };
  },
  writeNew: () => Promise.reject(new Error("not asked in these tests")),
  check: async () => "unused",
  checkPage: async () => "unused",
  shot: async () => "unused",
  plugins: pluginsDocument([{ apiVersion: 1, id: "acme", tabs: [{ id: "a", label: "A", view: "@acme/a" }] }])
});

const tool = (name: string): (typeof TOOLS)[number] => {
  const found = TOOLS.find((each) => each.name === name);
  if (found === undefined) throw new Error(`no tool ${name}`);
  return found;
};

describe("list_plugins", () => {
  it("answers from the configuration, without asking the catalogue", async () => {
    const count = asked.length;
    const result = await tool("list_plugins").call({});
    expect(result.isError).toBe(false);
    expect(result.structured).toEqual({
      schema: 1,
      apiVersions: [1],
      plugins: [
        { id: "acme", tabs: [{ id: "a", label: "A" }], switches: [], docBlocks: [], runsInFrames: false }
      ]
    });
    expect(asked).toHaveLength(count);
  });
});

describe("token tools", () => {
  it("lists a category, up to a limit", async () => {
    await tool("list_tokens").call({ category: "color", limit: 5 });
    expect(asked.at(-1)).toBe("tokens?category=color&limit=5");
  });

  it("asks for one token, whose name is required", async () => {
    await tool("get_token").call({ name: "color.brand.primary" });
    expect(asked.at(-1)).toBe("token?name=color.brand.primary");
    expect(tool("get_token").inputSchema).toMatchObject({ required: ["name"] });
  });

  it("asks for the nearest token, the type the same word the command uses", async () => {
    await tool("nearest_token").call({ value: "#1c1b1b", type: "background" });
    expect(asked.at(-1)).toBe("nearest-token?value=%231c1b1b&type=background");
  });

  it("gives back the catalogue's answer, not a summary of it", async () => {
    const result = await tool("list_tokens").call({});
    expect(JSON.stringify(result)).toContain("schema");
  });
});
