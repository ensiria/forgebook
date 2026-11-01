/**
 * Tests for the part of the Model Context Protocol `forgebook mcp` speaks: the handshake era, the stateless era, and
 * the errors either gives.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  answerMcpMessage,
  type McpServer,
  type McpSession,
  type McpToolResult,
  NEW_SESSION,
  SUPPORTED_VERSIONS
} from "../src/vite/mcpProtocol.ts";

/** A server with one tool that echoes its arguments, and fails on `fail`. */
const SERVER: McpServer = {
  info: { name: "forgebook", version: "1.2.3" },
  instructions: "The stories.",
  tools: [
    {
      name: "echo",
      description: "Echoes.",
      inputSchema: { type: "object" },
      call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => ({
        structured: { got: args },
        isError: args["fail"] === true,
        ...(args["picture"] === true ? { images: [{ data: "iVBORw0KGgo=", mimeType: "image/png" }] } : {})
      })
    },
    {
      name: "broken",
      description: "Throws.",
      inputSchema: { type: "object" },
      call: async (): Promise<McpToolResult> => {
        throw new Error("no browser installed");
      }
    }
  ]
};

/** The `_meta` of a stateless request. */
const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};

/** A stateless request's params: its own, and the `_meta` the protocol asks for. */
const withMeta = (
  params: Readonly<Record<string, unknown>> = {},
  meta: Readonly<Record<string, unknown>> = META
): Record<string, unknown> => ({
  ...params,
  // biome-ignore lint/style/useNamingConvention: the protocol names this field
  _meta: meta
});

/** Sends one message and reads the answer. */
const send = async (
  message: unknown,
  session: McpSession = NEW_SESSION
): Promise<{ readonly answer: unknown; readonly session: McpSession }> => {
  const step = await answerMcpMessage(JSON.stringify(message), session, SERVER);
  return { answer: step.reply === undefined ? undefined : JSON.parse(step.reply), session: step.session };
};

describe("the handshake era", () => {
  it("agrees on the version asked for, then answers requests", async () => {
    const opened = await send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" }
    });
    expect(opened.answer).toMatchObject({
      id: 1,
      result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: SERVER.info }
    });
    const listed = await send({ jsonrpc: "2.0", id: 2, method: "tools/list" }, opened.session);
    expect(listed.answer).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [
          { name: "echo", description: "Echoes.", inputSchema: { type: "object" } },
          { name: "broken", description: "Throws.", inputSchema: { type: "object" } }
        ]
      }
    });
  });

  it("answers a tool that throws with its error, and the session goes on", async () => {
    const answer = await send({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: withMeta({ name: "broken", arguments: {} })
    });
    expect(answer).toMatchObject({
      answer: { result: { structuredContent: { error: "no browser installed" }, isError: true } }
    });
  });

  it("offers its latest handshake version to a client asking for an unknown one", async () => {
    const opened = await send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2099-01-01" }
    });
    expect(opened.answer).toMatchObject({ result: { protocolVersion: "2025-11-25" } });
  });

  it("answers ping, and never answers a notification", async () => {
    expect((await send({ jsonrpc: "2.0", id: 9, method: "ping" })).answer).toEqual({
      jsonrpc: "2.0",
      id: 9,
      result: {}
    });
    expect((await send({ jsonrpc: "2.0", method: "notifications/initialized" })).answer).toBeUndefined();
  });
});

describe("the stateless era", () => {
  it("discovers what the server offers, with its caching hints", async () => {
    const { answer } = await send({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: withMeta()
    });
    expect(answer).toMatchObject({
      result: {
        resultType: "complete",
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: { tools: {} },
        instructions: "The stories.",
        cacheScope: "public",
        // biome-ignore lint/style/useNamingConvention: the protocol names this field
        _meta: { "io.modelcontextprotocol/serverInfo": SERVER.info }
      }
    });
  });

  it("calls a tool: its JSON as text and as structured content, a failure marked", async () => {
    const { answer } = await send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: withMeta({ name: "echo", arguments: { fail: true } })
    });
    expect(answer).toMatchObject({
      result: {
        resultType: "complete",
        content: [{ type: "text", text: '{"got":{"fail":true}}' }],
        structuredContent: { got: { fail: true } },
        isError: true
      }
    });
  });

  it("sends a tool's pictures after its JSON, as image content", async () => {
    const { answer } = await send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: withMeta({ name: "echo", arguments: { picture: true } })
    });
    expect(answer).toMatchObject({
      result: {
        content: [
          { type: "text", text: '{"got":{"picture":true}}' },
          { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" }
        ],
        isError: false
      }
    });
  });

  it("names the versions it serves to a client with another one", async () => {
    const meta = { ...META, "io.modelcontextprotocol/protocolVersion": "1900-01-01" };
    const { answer } = await send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: withMeta({}, meta)
    });
    expect(answer).toMatchObject({
      error: { code: -32022, data: { supported: SUPPORTED_VERSIONS, requested: "1900-01-01" } }
    });
  });
});

describe("errors", () => {
  it("refuses a request with neither a handshake nor the version in _meta", async () => {
    expect((await send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).answer).toMatchObject({
      error: { code: -32602 }
    });
  });

  it("answers an unknown tool, an unknown method and a line that is not JSON", async () => {
    const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: withMeta({ name: "nope" }) };
    expect((await send(call)).answer).toMatchObject({
      error: { code: -32602, message: "Unknown tool: nope" }
    });
    expect((await send({ jsonrpc: "2.0", id: 2, method: "nope", params: withMeta() })).answer).toMatchObject({
      error: { code: -32601 }
    });
    const parsed = await answerMcpMessage("{not json", NEW_SESSION, SERVER);
    expect(JSON.parse(parsed.reply ?? "")).toMatchObject({ id: null, error: { code: -32700 } });
  });
});
