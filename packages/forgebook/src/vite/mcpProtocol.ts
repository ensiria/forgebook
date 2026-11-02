/**
 * The part of the Model Context Protocol a stdio server with a few tools needs, written here instead of taking the
 * protocol's SDK: one JSON-RPC message in, its answer out. Pure apart from the tools it calls.
 *
 * @remarks
 * Two eras of the protocol are served, as the specification's backward-compatibility rules describe: the current
 * stateless one (`2026-07-28`: each request carries its version in `params._meta`, `server/discover` answers what the
 * server offers) and the handshake one most clients still speak (`2025-11-25` and before: `initialize`, then
 * requests). An `initialize` puts the session in the handshake era; a request carrying the version in `_meta` is
 * answered statelessly. The tools never change while the server runs, so their list is cacheable and public.
 *
 * The MCP Apps extension (`io.modelcontextprotocol/ui`, specification 2026-01-26) is offered only to a client that
 * declares it, read from the handshake or from the request's own `_meta`: what depends on it is a function of what the
 * client said, never of the connection, and any other client gets exactly the answers of a server without it.
 *
 * @module
 */

/** The protocol's current version, stateless. */
export const MODERN_VERSION = "2026-07-28";

/** The handshake versions answered: the latest first, which a client asking for another is offered. */
export const HANDSHAKE_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

/** Every version served, for `server/discover` and for the error a client with another one gets. */
export const SUPPORTED_VERSIONS: readonly string[] = [MODERN_VERSION, ...HANDSHAKE_VERSIONS];

/** The MCP Apps extension's identifier, in a client's and the server's capabilities. */
export const UI_EXTENSION = "io.modelcontextprotocol/ui";

/** The content type of an app's resource, the only one the extension defines. */
export const APP_MIME_TYPE = "text/html;profile=mcp-app";

/** The `_meta` keys of the current era. */
const META = {
  version: "io.modelcontextprotocol/protocolVersion",
  capabilities: "io.modelcontextprotocol/clientCapabilities",
  serverInfo: "io.modelcontextprotocol/serverInfo"
} as const;

/** JSON-RPC's and the protocol's error codes this server answers with. */
const ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  resourceNotFoundBefore: -32002,
  unsupportedVersion: -32022
} as const;

/** How long a client may keep the tools' list, in ms: they never change while the server runs. */
const TOOLS_TTL_MS = 300_000;

/** What a tool gives back: its answer as data, and whether it is a failure the agent should read. */
export type McpToolResult = {
  /** The answer, as JSON; also sent as text, as the protocol asks. */
  readonly structured: unknown;
  /** Whether the call failed (a story that does not exist): the agent reads why in the answer. */
  readonly isError: boolean;
  /** Pictures sent beside the answer, for the agent to look at; none by default. */
  readonly images?: readonly McpImage[];
};

/** A picture in a tool's answer. */
export type McpImage = {
  /** Its bytes, in base64. */
  readonly data: string;
  /** Its type (`image/png`). */
  readonly mimeType: string;
};

/** A tool the server offers. */
export type McpTool = {
  /** Its name (`list_stories`). */
  readonly name: string;
  /** What it does, for the agent choosing it. */
  readonly description: string;
  /** The JSON Schema of its arguments. */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** Runs it with the arguments the client sent. */
  readonly call: (args: Readonly<Record<string, unknown>>) => Promise<McpToolResult>;
  /**
   * The `ui://` resource a client shows this tool's answer in. A tool that has one is listed only to a client that
   * renders apps: the others have no use for it, and every tool listed is words in the agent's context.
   */
  readonly appResource?: string;
};

/** What reading an app's resource gives. */
export type McpAppContent = {
  /** The page, one HTML5 document. */
  readonly html: string;
  /** The origins the page may frame; the host blocks every other (`frame-src`). */
  readonly frameDomains: readonly string[];
};

/** An app's resource: a `ui://` page a client that renders apps shows a tool's answer in. */
export type McpAppResource = {
  /** Its address (`ui://forgebook/story-preview`). */
  readonly uri: string;
  /** Its name, for the client's lists. */
  readonly name: string;
  /** What it shows. */
  readonly description: string;
  /** Reads it. A host may do so at any time, before any tool is called, so it starts nothing. */
  readonly read: () => Promise<McpAppContent>;
};

/** Who the server is, and what it tells an agent about itself. */
export type McpServer = {
  /** Its name and version, as the protocol's `serverInfo`. */
  readonly info: { readonly name: string; readonly version: string };
  /** What the server is for, for the agent; none when it needs no words. */
  readonly instructions: string | undefined;
  /** Its tools. */
  readonly tools: readonly McpTool[];
  /** The apps' resources its tools show their answers in; none by default. */
  readonly apps?: readonly McpAppResource[];
};

/** What a session remembers between messages: what the client said when it opened it with the handshake. */
export type McpSession = {
  /** The handshake version agreed on `initialize`; none in the stateless era or before any request. */
  readonly handshakeVersion: string | undefined;
  /** Whether the handshake declared that the client renders apps. */
  readonly isAppHost: boolean;
};

/** A new session: no handshake yet. */
export const NEW_SESSION: McpSession = { handshakeVersion: undefined, isAppHost: false };

/** Who a request came from, as far as the answer depends on it. */
type Asker = {
  /** Whether it is answered in the stateless era. */
  readonly isModern: boolean;
  /** Whether the client renders apps. */
  readonly isAppHost: boolean;
};

/** A JSON-RPC answer. */
type Reply = { readonly jsonrpc: "2.0"; readonly id: unknown } & (
  | { readonly result: Readonly<Record<string, unknown>> }
  | { readonly error: { readonly code: number; readonly message: string; readonly data?: unknown } }
);

/** What one message gives: the answer to write, if any, and the session after it. */
export type McpStep = {
  /** The answer, as one line of JSON; none for a notification. */
  readonly reply: string | undefined;
  /** The session after the message. */
  readonly session: McpSession;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An error answer. */
const failure = (id: unknown, code: number, message: string, data?: unknown): Reply => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data }
});

/** A result answer. */
const success = (id: unknown, result: Readonly<Record<string, unknown>>): Reply => ({
  jsonrpc: "2.0",
  id,
  result
});

/** What the stateless era adds to every result: its type and who answered. */
const modernResult = (
  server: McpServer,
  result: Readonly<Record<string, unknown>>
): Record<string, unknown> => ({
  resultType: "complete",
  ...result,
  // biome-ignore lint/style/useNamingConvention: the protocol names this field
  _meta: { [META.serverInfo]: server.info }
});

/**
 * Why a stateless request cannot be answered: its `_meta` lacks the version or the client's capabilities, or names a
 * version not served.
 *
 * @returns the error answer, or none when the request is valid.
 */
const modernProblem = (id: unknown, meta: Readonly<Record<string, unknown>>): Reply | undefined => {
  const version = meta[META.version];
  if (typeof version !== "string" || !isRecord(meta[META.capabilities]))
    return failure(
      id,
      ERRORS.invalidParams,
      `A request needs ${META.version} and ${META.capabilities} in _meta`
    );
  if (!SUPPORTED_VERSIONS.includes(version))
    return failure(id, ERRORS.unsupportedVersion, "Unsupported protocol version", {
      supported: SUPPORTED_VERSIONS,
      requested: version
    });
  return undefined;
};

/** Whether a client's capabilities say it renders the only kind of app there is. */
const declaresApps = (capabilities: unknown): boolean => {
  if (!isRecord(capabilities) || !isRecord(capabilities["extensions"])) return false;
  const settings = capabilities["extensions"][UI_EXTENSION];
  return (
    isRecord(settings) &&
    Array.isArray(settings["mimeTypes"]) &&
    settings["mimeTypes"].includes(APP_MIME_TYPE)
  );
};

/** What the server offers this client: more than its tools only when it has apps and the client renders them. */
const capabilitiesFor = (server: McpServer, isAppHost: boolean): Readonly<Record<string, unknown>> =>
  isAppHost && server.apps !== undefined
    ? { tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } }
    : { tools: {} };

/**
 * The cache scope of an answer that depends on who asks. A shared cache must not hand one that names apps to a client
 * that renders none.
 */
const scopeFor = (isAppHost: boolean): string => (isAppHost ? "private" : "public");

/** The tools' list as the protocol gives it: an app's tool only to a client that renders it. */
const toolList = (server: McpServer, isAppHost: boolean): Readonly<Record<string, unknown>>[] =>
  server.tools
    .filter((tool) => tool.appResource === undefined || isAppHost)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      // biome-ignore lint/style/useNamingConvention: the protocol names this field
      ...(tool.appResource === undefined ? {} : { _meta: { ui: { resourceUri: tool.appResource } } })
    }));

/** A tool's answer as the protocol gives it: its JSON as text and as structured content, then its pictures. */
const toolResult = async (
  tool: McpTool,
  args: Readonly<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  let answer: Awaited<ReturnType<McpTool["call"]>>;
  try {
    answer = await tool.call(args);
  } catch (error) {
    // a tool that fails (no browser installed, the dev server gone) answers with its error: the session goes on
    answer = { structured: { error: error instanceof Error ? error.message : String(error) }, isError: true };
  }
  const { structured, isError, images = [] } = answer;
  return {
    content: [
      { type: "text", text: JSON.stringify(structured) },
      ...images.map((image) => ({ type: "image", data: image.data, mimeType: image.mimeType }))
    ],
    structuredContent: structured,
    isError
  };
};

/**
 * An app's resource as `resources/read` gives it. The page names the session's origin, so it is never kept
 * (`ttlMs: 0`), which the handshake era has no way to say.
 */
const readApp = async (
  app: McpAppResource,
  isModern: boolean
): Promise<Readonly<Record<string, unknown>>> => {
  const { html, frameDomains } = await app.read();
  const content = {
    uri: app.uri,
    mimeType: APP_MIME_TYPE,
    text: html,
    // biome-ignore lint/style/useNamingConvention: the protocol names this field
    _meta: { ui: { csp: { frameDomains }, prefersBorder: true } }
  };
  return { contents: [content], ...(isModern ? { ttlMs: 0, cacheScope: "private" } : {}) };
};

/** Answers a request for the apps' resources, or none for another method or a server without apps. */
const answerResources = async (
  server: McpServer,
  id: unknown,
  method: string,
  params: Readonly<Record<string, unknown>>,
  { isModern }: Asker,
  finish: (result: Readonly<Record<string, unknown>>) => Reply
): Promise<Reply | undefined> => {
  const { apps } = server;
  if (apps === undefined) return undefined;
  const kept = isModern ? { ttlMs: TOOLS_TTL_MS, cacheScope: "private" } : {};
  if (method === "resources/list") {
    const resources = apps.map(({ uri, name, description }) => ({
      uri,
      name,
      description,
      mimeType: APP_MIME_TYPE
    }));
    return finish({ resources, ...kept });
  }
  if (method === "resources/templates/list") return finish({ resourceTemplates: [], ...kept });
  if (method !== "resources/read") return undefined;
  const uri = params["uri"];
  const app = apps.find((each) => each.uri === uri);
  if (app === undefined)
    return failure(
      id,
      isModern ? ERRORS.invalidParams : ERRORS.resourceNotFoundBefore,
      "Resource not found",
      {
        uri
      }
    );
  try {
    return finish(await readApp(app, isModern));
  } catch (error) {
    return failure(id, ERRORS.internal, error instanceof Error ? error.message : String(error));
  }
};

/** Answers a request in either era: the methods both share. */
const answerRequest = async (
  server: McpServer,
  id: unknown,
  method: string,
  params: Readonly<Record<string, unknown>>,
  asker: Asker
): Promise<Reply> => {
  const { isModern, isAppHost } = asker;
  const finish = (result: Readonly<Record<string, unknown>>): Reply =>
    success(id, isModern ? modernResult(server, result) : result);
  if (method === "tools/list")
    return finish(
      isModern
        ? { tools: toolList(server, isAppHost), ttlMs: TOOLS_TTL_MS, cacheScope: scopeFor(isAppHost) }
        : { tools: toolList(server, isAppHost) }
    );
  if (method === "tools/call") {
    const name = params["name"];
    const tool = server.tools.find((each) => each.name === name);
    if (tool === undefined) return failure(id, ERRORS.invalidParams, `Unknown tool: ${String(name)}`);
    const args = params["arguments"];
    return finish(await toolResult(tool, isRecord(args) ? args : {}));
  }
  if (method === "server/discover" && isModern)
    return finish({
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: capabilitiesFor(server, isAppHost),
      ...(server.instructions === undefined ? {} : { instructions: server.instructions }),
      ttlMs: TOOLS_TTL_MS,
      cacheScope: scopeFor(isAppHost)
    });
  const resources = await answerResources(server, id, method, params, asker, finish);
  return resources ?? failure(id, ERRORS.methodNotFound, `Method not found: ${method}`);
};

/** A line read as JSON-RPC: a request, a notification (never answered), or the error answer for a bad line. */
type ReadMessage =
  | {
      readonly kind: "request";
      readonly id: unknown;
      readonly method: string;
      readonly params: Readonly<Record<string, unknown>>;
    }
  | { readonly kind: "notification" }
  | { readonly kind: "invalid"; readonly reply: Reply };

/** Reads one line as a JSON-RPC message. */
const readMessage = (line: string): ReadMessage => {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return { kind: "invalid", reply: failure(null, ERRORS.parse, "Parse error") };
  }
  if (!isRecord(message) || message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
    const id = isRecord(message) ? (message["id"] ?? null) : null;
    return { kind: "invalid", reply: failure(id, ERRORS.invalidRequest, "Invalid request") };
  }
  // a notification (no id) is never answered: `notifications/initialized`, a cancellation
  if (!("id" in message)) return { kind: "notification" };
  const params = message["params"];
  return {
    kind: "request",
    id: message["id"],
    method: message["method"],
    params: isRecord(params) ? params : {}
  };
};

/** Answers `initialize`: the version asked for when it is served, the latest handshake one otherwise. */
const initialized = (server: McpServer, id: unknown, params: Readonly<Record<string, unknown>>): McpStep => {
  const asked = params["protocolVersion"];
  const version = HANDSHAKE_VERSIONS.find((each) => each === asked) ?? HANDSHAKE_VERSIONS[0];
  const isAppHost = declaresApps(params["capabilities"]);
  const result = {
    protocolVersion: version,
    capabilities: capabilitiesFor(server, isAppHost),
    serverInfo: server.info,
    ...(server.instructions === undefined ? {} : { instructions: server.instructions })
  };
  return { reply: JSON.stringify(success(id, result)), session: { handshakeVersion: version, isAppHost } };
};

/**
 * Answers one message the client sent: a line of JSON-RPC.
 *
 * @param line - the message, one line of JSON.
 * @param session - what the session remembers.
 * @param server - who the server is and its tools.
 * @returns the answer to write (none for a notification) and the session after the message.
 */
export const answerMcpMessage = async (
  line: string,
  session: McpSession,
  server: McpServer
): Promise<McpStep> => {
  const read = readMessage(line);
  if (read.kind === "notification") return { reply: undefined, session };
  if (read.kind === "invalid") return { reply: JSON.stringify(read.reply), session };
  const { id, method, params } = read;
  if (method === "initialize") return initialized(server, id, params);
  const answer = async (): Promise<Reply> => {
    if (method === "ping") return success(id, {});
    const meta = params["_meta"];
    if (isRecord(meta) && META.version in meta)
      return (
        modernProblem(id, meta) ??
        (await answerRequest(server, id, method, params, {
          isModern: true,
          isAppHost: declaresApps(meta[META.capabilities])
        }))
      );
    if (session.handshakeVersion !== undefined)
      return answerRequest(server, id, method, params, { isModern: false, isAppHost: session.isAppHost });
    return failure(
      id,
      ERRORS.invalidParams,
      `A request needs ${META.version} in _meta, or an initialize first`
    );
  };
  return { reply: JSON.stringify(await answer()), session };
};
