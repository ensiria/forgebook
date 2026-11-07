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
import { switchesDocument } from "../src/vite/switchesDocument.ts";

/** The questions the tools asked. */
const asked: string[] = [];

/** What the tools reach the catalogue through. */
const REACH: Parameters<typeof catalogueTools>[0] = {
  ask: async (route: string, params: URLSearchParams): Promise<AgentAnswer> => {
    asked.push(`${route}?${params.toString()}`);
    return { status: 200, body: { schema: 1 } };
  },
  writeNew: () => Promise.reject(new Error("not asked in these tests")),
  check: async () => "unused",
  stress: async (id: string) =>
    id === "kit:a--b"
      ? {
          schema: 1,
          cases: [
            { name: "plain", storyId: id, args: {}, frame: "f", problems: [] },
            {
              name: "narrow",
              storyId: id,
              args: {},
              frame: "f",
              problems: [{ kind: "spill", message: "spills" }]
            }
          ],
          skipped: []
        }
      : "unused",
  checkPage: async () => "unused",
  servePreview: async () => "unused",
  shot: async () => "unused",
  verify: async () => "unused",
  plugins: pluginsDocument([{ apiVersion: 1, id: "acme", tabs: [{ id: "a", label: "A", view: "@acme/a" }] }]),
  switches: switchesDocument(
    [
      {
        id: "look",
        label: "Theme",
        control: "gallery",
        default: "plain",
        apply: { kind: "code" },
        values: [
          { value: "plain", label: "Plain" },
          {
            value: "night",
            label: "Night",
            implies: { theme: "dark" },
            sheet: "/project/looks/night.css",
            preview: { image: "/project/looks/night.png" }
          }
        ]
      }
    ],
    "/project"
  )
};

const TOOLS = catalogueTools(REACH);

const tool = (name: string): (typeof TOOLS)[number] => {
  const found = TOOLS.find((each) => each.name === name);
  if (found === undefined) throw new Error(`no tool ${name}`);
  return found;
};

describe("list_switches", () => {
  it("answers each value's view and what it brings, from the configuration, its files from the project", async () => {
    const count = asked.length;
    const result = await tool("list_switches").call({});
    expect(result.isError).toBe(false);
    expect(result.structured).toEqual({
      schema: 1,
      switches: [
        {
          id: "look",
          label: "Theme",
          default: "plain",
          control: "gallery",
          values: [
            { value: "plain", label: "Plain", view: "look=plain" },
            {
              value: "night",
              label: "Night",
              view: "look=night",
              implies: { theme: "dark" },
              sheet: "looks/night.css",
              preview: { image: "looks/night.png" }
            }
          ]
        }
      ]
    });
    expect(asked.length).toBe(count);
  });
});

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

describe("story_address with values", () => {
  it("hands the values to the catalogue as JSON, and declares them", async () => {
    expect(JSON.stringify(tool("story_address").inputSchema)).toContain("forgebookUnset");
    asked.length = 0;
    await tool("story_address").call({ id: "kit:a--b", view: "theme=dark", args: { tags: ["ü"] } });
    const params = new URLSearchParams(asked[0]?.split("?")[1]);
    expect(asked[0]?.startsWith("story?")).toBe(true);
    expect(params.get("id")).toBe("kit:a--b");
    expect(params.get("view")).toBe("theme=dark");
    expect(params.get("args")).toBe('{"tags":["ü"]}');
  });

  it("without values, asks for the list as before", async () => {
    asked.length = 0;
    await tool("story_address").call({ id: "kit:a--b" });
    expect(asked[0]?.startsWith("stories?")).toBe(true);
  });
});

describe("check_story on a story its frame gave up on", () => {
  /** The tool, answering this report. */
  const checkTool = (notVerified: string | undefined): (typeof TOOLS)[number] => {
    const tools = catalogueTools({
      ...REACH,
      check: async () => ({
        schema: 1,
        results: [
          {
            storyId: "kit:a--b",
            view: "",
            frame: "f",
            problems: [],
            ...(notVerified === undefined ? {} : { notVerified })
          }
        ]
      })
    });
    const found = tools.find((each) => each.name === "check_story");
    if (found === undefined) throw new Error("check_story is one of the tools");
    return found;
  };

  it("answers an error with the reason, as an agent reads it", async () => {
    const answer = await checkTool("still loading").call({ id: "kit:a--b" });
    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer.structured)).toContain("still loading");
  });

  it("is no error when the checks ran and found nothing", async () => {
    expect((await checkTool(undefined).call({ id: "kit:a--b" })).isError).toBe(false);
  });
});

describe("check_story with stress", () => {
  it("answers the stress matrix, an error when a case breaks something", async () => {
    const tool = catalogueTools(REACH).find((each) => each.name === "check_story");
    const answer = await tool?.call({ id: "kit:a--b", stress: true });
    expect(answer?.isError).toBe(true);
    expect(answer?.structured).toMatchObject({ schema: 1, cases: [{ name: "plain" }, { name: "narrow" }] });
  });
});
