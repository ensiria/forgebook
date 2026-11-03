/**
 * Tests for the MCP Apps extension (`io.modelcontextprotocol/ui`, specification 2026-01-26) as `forgebook mcp` speaks
 * it: what a client that renders apps gets, what any other client does not, and that nothing runs before it is asked.
 *
 * @remarks
 * No client that renders apps ran these messages: they are checked against the specification's text, so each test
 * names the rule it holds the server to.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { PREVIEW_URI, previewResource, previewTool } from "../bin/forgebook/mcpPreview.ts";
import { PREVIEW_TEXTS, previewTexts } from "../src/previewTexts.ts";
import {
  APP_MIME_TYPE,
  answerMcpMessage,
  type McpServer,
  type McpSession,
  NEW_SESSION,
  UI_EXTENSION
} from "../src/vite/mcpProtocol.ts";

/** The catalogue's answer: one story. */
const STORIES: Readonly<Record<string, unknown>> = {
  schema: 1,
  problems: [],
  components: [
    {
      stories: [
        {
          id: "kit:button--primary",
          links: {
            address: "http://localhost:5173/?story=kit%3Abutton--primary",
            frame: "http://localhost:5173/frame.html?story=kit%3Abutton--primary"
          }
        }
      ]
    }
  ]
};

/** A catalogue with one story, counting what was started. */
const reach = (): {
  readonly server: McpServer;
  readonly counts: { started: number; reserved: number };
} => {
  const counts = { started: 0, reserved: 0 };
  const server: McpServer = {
    info: { name: "forgebook", version: "1.2.3" },
    instructions: undefined,
    tools: [
      {
        name: "plain",
        description: "Plain.",
        inputSchema: { type: "object" },
        call: async () => ({ structured: {}, isError: false })
      },
      previewTool({
        ask: async () => ({
          status: 200,
          body: STORIES
        }),
        serve: async () => {
          counts.started += 1;
          return "http://127.0.0.1:6100";
        }
      })
    ],
    apps: [
      previewResource({
        origin: async () => {
          counts.reserved += 1;
          return "http://127.0.0.1:6100";
        },
        strings: {},
        version: "1.2.3"
      })
    ]
  };
  return { server, counts };
};

/** What a client that renders apps declares. */
const APP_CAPABILITIES: Readonly<Record<string, unknown>> = {
  extensions: { [UI_EXTENSION]: { mimeTypes: [APP_MIME_TYPE] } }
};

/** A stateless request's `_meta`. */
const meta = (capabilities: unknown): Record<string, unknown> => ({
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": capabilities
});

/** Sends one message and reads its answer's result, or throws on anything else. */
const send = async (
  server: McpServer,
  method: string,
  params: Readonly<Record<string, unknown>>,
  session: McpSession = NEW_SESSION
): Promise<{ readonly answer: Record<string, unknown>; readonly session: McpSession }> => {
  const line = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const step = await answerMcpMessage(line, session, server);
  if (step.reply === undefined) throw new Error("no answer");
  return { answer: JSON.parse(step.reply), session: step.session };
};

/** Opens a handshake session with these capabilities. */
const handshake = async (server: McpServer, capabilities: unknown): Promise<McpSession> => {
  const params = { protocolVersion: "2025-11-25", capabilities, clientInfo: { name: "t", version: "1" } };
  return (await send(server, "initialize", params)).session;
};

/** The tools a session is offered, by name. */
const listed = async (server: McpServer, session: McpSession): Promise<unknown> => {
  const { answer } = await send(server, "tools/list", {}, session);
  return answer["result"];
};

describe("capability negotiation", () => {
  it("declares the extension and resources to a client that renders apps, in the handshake", async () => {
    const { server } = reach();
    const { answer } = await send(server, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: APP_CAPABILITIES
    });
    expect(answer).toMatchObject({
      result: { capabilities: { tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } } }
    });
  });

  it("declares them in server/discover, from the request's own capabilities", async () => {
    const { server } = reach();
    const { answer } = await send(server, "server/discover", {
      // biome-ignore lint/style/useNamingConvention: the protocol names this field
      _meta: meta(APP_CAPABILITIES)
    });
    expect(answer).toMatchObject({
      result: { capabilities: { resources: {}, extensions: { [UI_EXTENSION]: {} } } }
    });
  });

  it("treats a client without the app type as one that renders none", async () => {
    const { server } = reach();
    const capabilities = { extensions: { [UI_EXTENSION]: { mimeTypes: ["text/plain"] } } };
    const session = await handshake(server, capabilities);
    expect(JSON.stringify(await listed(server, session))).not.toContain("story_preview");
  });
});

describe("a client that renders no apps", () => {
  it("gets the same answers as from a server with no previews", async () => {
    const { server } = reach();
    const without: McpServer = {
      info: server.info,
      instructions: server.instructions,
      tools: server.tools.filter((tool) => tool.name === "plain")
    };
    const params = { protocolVersion: "2025-11-25", capabilities: {} };
    // biome-ignore lint/style/useNamingConvention: the protocol names this field
    const stateless = { _meta: meta({}) };
    expect((await send(server, "initialize", params)).answer).toEqual(
      (await send(without, "initialize", params)).answer
    );
    expect((await send(server, "tools/list", stateless)).answer).toEqual(
      (await send(without, "tools/list", stateless)).answer
    );
    expect((await send(server, "server/discover", stateless)).answer).toEqual(
      (await send(without, "server/discover", stateless)).answer
    );
  });

  it("does not answer for what it did not offer", async () => {
    const { server, counts } = reach();
    const session = await handshake(server, {});
    const tool = { name: "story_preview", arguments: { id: "kit:button--primary" } };
    expect((await send(server, "tools/call", tool, session)).answer).toMatchObject({
      error: { code: -32602 }
    });
    for (const method of ["resources/list", "resources/read", "resources/templates/list"])
      expect((await send(server, method, { uri: PREVIEW_URI }, session)).answer).toMatchObject({
        error: { code: -32601 }
      });
    expect(counts.started).toBe(0);
  });
});

describe("tool and resource", () => {
  it("links the tool to its resource through `_meta.ui.resourceUri`, and only for such a client", async () => {
    const { server } = reach();
    const session = await handshake(server, APP_CAPABILITIES);
    expect(await listed(server, session)).toMatchObject({
      tools: [
        { name: "plain" },
        // biome-ignore lint/style/useNamingConvention: the protocol names this field
        { name: "story_preview", _meta: { ui: { resourceUri: PREVIEW_URI } } }
      ]
    });
  });

  it("lists the resource as a `ui://` one of the app type", async () => {
    const { server } = reach();
    const { answer } = await send(server, "resources/list", {}, await handshake(server, APP_CAPABILITIES));
    expect(answer).toMatchObject({ result: { resources: [{ uri: PREVIEW_URI, mimeType: APP_MIME_TYPE }] } });
    expect(PREVIEW_URI.startsWith("ui://")).toBe(true);
  });

  it("reads as one HTML5 document that names the origin the story comes from", async () => {
    const { server } = reach();
    const { answer } = await send(
      server,
      "resources/read",
      { uri: PREVIEW_URI },
      await handshake(server, APP_CAPABILITIES)
    );
    expect(answer).toMatchObject({
      result: {
        contents: [
          {
            uri: PREVIEW_URI,
            mimeType: APP_MIME_TYPE,
            // biome-ignore lint/style/useNamingConvention: the protocol names this field
            _meta: { ui: { csp: { frameDomains: ["http://127.0.0.1:6100"] }, prefersBorder: true } }
          }
        ]
      }
    });
    const content = JSON.stringify(answer);
    expect(content.toLowerCase()).toContain("<!doctype html>");
    expect(content).toContain("ui/initialize");
  });

  it("says how long a stateless client may keep the read: not at all, the port is the session's", async () => {
    const { server } = reach();
    const { answer } = await send(server, "resources/read", {
      uri: PREVIEW_URI,
      // biome-ignore lint/style/useNamingConvention: the protocol names this field
      _meta: meta(APP_CAPABILITIES)
    });
    expect(answer).toMatchObject({ result: { resultType: "complete", ttlMs: 0, cacheScope: "private" } });
  });

  it("answers a resource it does not have with the code of the version in use", async () => {
    const { server } = reach();
    const missing = { uri: "ui://forgebook/nothing" };
    const stateless = await send(server, "resources/read", {
      ...missing,
      // biome-ignore lint/style/useNamingConvention: the protocol names this field
      _meta: meta(APP_CAPABILITIES)
    });
    expect(stateless.answer).toMatchObject({ error: { code: -32602, data: missing } });
    const session = await handshake(server, APP_CAPABILITIES);
    const older = await send(server, "resources/read", missing, session);
    expect(older.answer).toMatchObject({ error: { code: -32002, data: missing } });
  });
});

describe("the page's words", () => {
  it("take a catalogue's replacements by name, and only the page's own", () => {
    const texts = previewTexts({ previewOpen: "Open", searchLabel: "Find" });
    expect(texts).toEqual({ ...PREVIEW_TEXTS, previewOpen: "Open" });
  });
});

describe("what runs when", () => {
  it("starts nothing to list the tools or read the resource, as a host may do so unasked", async () => {
    const { server, counts } = reach();
    const session = await handshake(server, APP_CAPABILITIES);
    await listed(server, session);
    await send(server, "resources/list", {}, session);
    await send(server, "resources/read", { uri: PREVIEW_URI }, session);
    expect(counts.started).toBe(0);
  });

  it("serves the catalogue when the tool is called, and answers the preview's address", async () => {
    const { server, counts } = reach();
    const session = await handshake(server, APP_CAPABILITIES);
    const { answer } = await send(
      server,
      "tools/call",
      { name: "story_preview", arguments: { id: "kit:button--primary", view: "theme=dark" } },
      session
    );
    expect(counts.started).toBe(1);
    const result = answer["result"];
    expect(result).toMatchObject({
      isError: false,
      structuredContent: {
        id: "kit:button--primary",
        preview: "http://127.0.0.1:6100/__forgebook/api/preview?id=kit%3Abutton--primary&view=theme%3Ddark",
        links: { address: "http://127.0.0.1:6100/?story=kit%3Abutton--primary" }
      }
    });
    expect(JSON.stringify(result)).toContain('"type":"text"');
  });

  it("answers with no preview when the catalogue cannot be served, for the page to take a picture", async () => {
    const tool = previewTool({
      ask: async () => ({ status: 200, body: STORIES }),
      serve: () => Promise.reject(new Error("port taken"))
    });
    const result = await tool.call({ id: "kit:button--primary" });
    expect(result).toMatchObject({
      isError: false,
      structured: { id: "kit:button--primary", problem: "port taken" }
    });
    expect(JSON.stringify(result)).not.toContain('"preview"');
  });

  it("starts nothing for a story that does not exist", async () => {
    const { server, counts } = reach();
    const { answer } = await send(
      server,
      "tools/call",
      { name: "story_preview", arguments: { id: "kit:nothing" } },
      await handshake(server, APP_CAPABILITIES)
    );
    expect(counts.started).toBe(0);
    expect(answer).toMatchObject({ result: { isError: true } });
  });
});
