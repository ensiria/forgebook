/**
 * The inline preview end to end: `forgebook mcp` run as a client runs it, and a host written from the MCP Apps
 * specification (2026-01-26) in a real browser, which loads the resource in a sandboxed frame under the policy the
 * specification spells out and speaks JSON-RPC to it.
 *
 * @remarks
 * The host here is this test's reading of the specification: no client that renders apps took part.
 *
 * @module
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { expect, type Page, test } from "@playwright/test";

/** The catalogue's folder, where the command runs. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

/** A story of the fixture catalogue with a button in it. */
const STORY = "sb:components-button--primary";

/** What a client that renders apps declares. */
const APP_CAPABILITIES = {
  extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } }
};

/** Where a host on the web serves its page. */
const WEB_HOST = "https://host.example/";

/** Where a host on the web serves the app: another origin than its own, as the specification asks. */
const WEB_SANDBOX = "https://sandbox.example/view";

/** A JSON-RPC message, as far as these tests read one. */
type Message = Readonly<Record<string, unknown>>;

/** `forgebook mcp` as a running process. */
type McpClient = {
  /** Sends a request and waits for its answer's result. */
  readonly request: (method: string, params: Message) => Promise<Message>;
  /** Stops it. */
  readonly stop: () => void;
};

/** Reads a value as a message. */
const asMessage = (value: unknown): Message => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
  return Object.fromEntries(Object.entries(value));
};

/**
 * Runs `forgebook mcp` and opens a session.
 *
 * @param url - where it looks for a running catalogue.
 * @param capabilities - what the client declares.
 */
const mcpClient = async (url: string, capabilities: Message): Promise<McpClient> => {
  const process_: ChildProcessWithoutNullStreams = spawn(process.execPath, [ENTRY, "mcp", "--url", url], {
    cwd: APP
  });
  let lastId = 0;
  const waiting = new Map<number, (result: Message) => void>();
  createInterface({ input: process_.stdout }).on("line", (line) => {
    const message = asMessage(JSON.parse(line));
    if (typeof message["id"] === "number") waiting.get(message["id"])?.(asMessage(message["result"]));
  });
  const request = (method: string, params: Message): Promise<Message> =>
    new Promise((done) => {
      lastId += 1;
      waiting.set(lastId, done);
      process_.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: lastId, method, params })}\n`);
    });
  await request("initialize", {
    protocolVersion: "2025-11-25",
    capabilities,
    clientInfo: { name: "test", version: "1" }
  });
  return { request, stop: () => process_.kill() };
};

/** The app's resource read from the server. */
const readApp = async (
  client: McpClient
): Promise<{ readonly html: string; readonly frameDomains: readonly string[] }> => {
  const { contents } = await client.request("resources/read", { uri: "ui://forgebook/story-preview" });
  if (!Array.isArray(contents)) throw new Error("no contents");
  const content = asMessage(contents[0]);
  const meta = asMessage(asMessage(content["_meta"])["ui"]);
  const domains = asMessage(meta["csp"])["frameDomains"];
  if (typeof content["text"] !== "string" || !Array.isArray(domains)) throw new Error("no page");
  return { html: content["text"], frameDomains: domains.map(String) };
};

/** The specification's policy for a resource, from the origins the host allows it to frame. */
const policyOf = (frameDomains: readonly string[]): string =>
  [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self' data:",
    `frame-src ${frameDomains.length === 0 ? "'none'" : frameDomains.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'"
  ].join("; ");

/** What the host page did. */
type Host = {
  /** Every message the app sent. */
  readonly received: Message[];
  /** Sends the app a message. */
  readonly send: (message: Message) => Promise<void>;
};

/** The host's page, which frames the app and passes its messages on. */
const hostPage = (sandbox: string): string => `<!doctype html><title>Host</title>
  <iframe id="view" title="App" width="600" height="400" sandbox="allow-scripts allow-same-origin"></iframe>
  <script>
    const view = document.getElementById("view");
    addEventListener("message", (event) => {
      if (event.source === view.contentWindow) window.fromApp(event.data);
    });
    window.toApp = (message) => view.contentWindow.postMessage(message, "*");
    view.src = ${JSON.stringify(sandbox)};
  </script>`;

/** Serves a host on the web: public addresses, fulfilled by the browser's test driver. */
const webHost = async (page: Page, html: string, frameDomains: readonly string[]): Promise<string> => {
  const headers = { "Content-Security-Policy": policyOf(frameDomains) };
  await page.route(WEB_SANDBOX, (route) => route.fulfill({ contentType: "text/html", headers, body: html }));
  await page.route(WEB_HOST, (route) =>
    route.fulfill({ contentType: "text/html", body: hostPage(WEB_SANDBOX) })
  );
  return WEB_HOST;
};

/** The port a server listens on. */
const portOf = (server: Server): number => {
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("not listening");
  return address.port;
};

/**
 * Serves a host on the computer itself, as a desktop client's can be: two local origins, a real server.
 *
 * @returns the host's address and the server to stop.
 */
const localHost = async (
  html: string,
  frameDomains: readonly string[]
): Promise<{ readonly address: string; readonly server: Server }> => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    if (request.url !== "/view") {
      response.end(hostPage(`http://localhost:${portOf(server)}/view`));
      return;
    }
    response.setHeader("Content-Security-Policy", policyOf(frameDomains));
    response.end(html);
  });
  await new Promise<void>((done) => {
    server.listen(0, "127.0.0.1", done);
  });
  return { address: `http://127.0.0.1:${portOf(server)}/`, server };
};

/**
 * Opens a host, which answers `ui/initialize` and passes the app's `tools/call` to the server.
 *
 * @param page - the browser's page.
 * @param client - the server.
 * @param address - the host's page.
 * @param theme - the appearance the host tells the app.
 */
const openHost = async (
  page: Page,
  client: McpClient,
  address: string,
  theme: "light" | "dark" = "light"
): Promise<Host> => {
  const received: Message[] = [];
  const send = async (message: Message): Promise<void> => {
    await page.evaluate((each) => {
      // biome-ignore lint/suspicious/noExplicitAny: the page's own global, set by the host's script
      (window as any).toApp(each);
    }, message);
  };
  await page.exposeFunction("fromApp", async (value: unknown) => {
    const message = asMessage(value);
    received.push(message);
    const { id, method, params } = message;
    if (method === "ui/initialize")
      await send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2026-01-26",
          hostInfo: { name: "test-host", version: "1" },
          hostCapabilities: { openLinks: {}, serverTools: {} },
          hostContext: { theme, displayMode: "inline" }
        }
      });
    if (method === "tools/call") {
      const result = await client.request("tools/call", asMessage(params));
      await send({ jsonrpc: "2.0", id, result });
    }
  });
  await page.goto(address);
  await expect
    .poll(() => received.some((each) => each["method"] === "ui/notifications/initialized"))
    .toBe(true);
  return { received, send };
};

/** Calls the tool and hands the host its input and result, as the specification's lifecycle orders them. */
const showStory = async (host: Host, client: McpClient, id: string): Promise<void> => {
  const args = { id };
  await host.send({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: args } });
  const params = await client.request("tools/call", { name: "story_preview", arguments: args });
  await host.send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params });
};

test.describe("forgebook mcp's inline preview", () => {
  test.setTimeout(120_000);

  test("hides the tool from a client that renders no apps", async ({ baseURL }) => {
    const client = await mcpClient(baseURL ?? "", {});
    const { tools } = await client.request("tools/list", {});
    client.stop();
    expect(JSON.stringify(tools)).toContain("story_shot");
    expect(JSON.stringify(tools)).not.toContain("story_preview");
  });

  for (const colorScheme of ["light", "dark"] as const)
    test(`shows the story live, and loads it only once the tool has answered (${colorScheme})`, async ({
      baseURL,
      page
    }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      const client = await mcpClient(baseURL ?? "", APP_CAPABILITIES);
      const frames: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/frame.html")) frames.push(request.url());
      });
      const { html, frameDomains } = await readApp(client);
      const { address, server } = await localHost(html, frameDomains);
      const host = await openHost(page, client, address, colorScheme);
      await expect(page.frameLocator("#view").getByRole("status")).toHaveText("Waiting for the story");
      expect(frames).toEqual([]);

      await showStory(host, client, STORY);
      const story = page.frameLocator("#view").frameLocator("#frame").frameLocator("iframe");
      await expect(story.getByRole("button").first()).toBeVisible({ timeout: 60_000 });
      await expect(page.frameLocator("#view").getByRole("status")).toBeHidden();
      await expect(
        page.frameLocator("#view").getByRole("button", { name: "Open in the catalogue" })
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("preview.png") });
      await writeFile(testInfo.outputPath("messages.json"), JSON.stringify(host.received));

      const initialize = host.received.find((each) => each["method"] === "ui/initialize");
      expect(initialize?.["params"]).toMatchObject({
        protocolVersion: "2026-01-26",
        appInfo: { name: "forgebook-story-preview" },
        appCapabilities: { availableDisplayModes: ["inline"] }
      });
      await expect
        .poll(() => host.received.filter((each) => each["method"] === "ui/notifications/size-changed").length)
        .toBeGreaterThan(0);

      await host.send({ jsonrpc: "2.0", id: 900, method: "ping", params: {} });
      await host.send({
        jsonrpc: "2.0",
        id: 901,
        method: "ui/resource-teardown",
        params: { reason: "done" }
      });
      await expect
        .poll(() => host.received.filter((each) => each["id"] === 900 || each["id"] === 901))
        .toHaveLength(2);
      client.stop();
      server.close();
    });

  /** Checks the app shows the picture it asked the host for. */
  const expectPicture = async (page: Page, host: Host): Promise<void> => {
    const picture = page.frameLocator("#view").getByRole("img", { name: "A picture of the story" });
    await expect(picture).toBeVisible({ timeout: 60_000 });
    expect(await picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const calls = host.received.filter((each) => each["method"] === "tools/call");
    expect(calls.map((each) => asMessage(each["params"])["name"])).toEqual(["story_shot"]);
  };

  test("falls back to story_shot's picture when the host refuses the catalogue's origin", async ({
    baseURL,
    page
  }, testInfo) => {
    const client = await mcpClient(baseURL ?? "", APP_CAPABILITIES);
    const { html } = await readApp(client);
    const { address, server } = await localHost(html, []);
    const host = await openHost(page, client, address);
    await showStory(host, client, STORY);
    await expectPicture(page, host);
    await page.screenshot({ path: testInfo.outputPath("picture.png") });
    client.stop();
    server.close();
  });

  test("falls back to the picture, without waiting, when the browser keeps a public page from local addresses", async ({
    baseURL,
    page
  }) => {
    const client = await mcpClient(baseURL ?? "", APP_CAPABILITIES);
    const { html, frameDomains } = await readApp(client);
    const host = await openHost(page, client, await webHost(page, html, frameDomains));
    const failures: (string | undefined)[] = [];
    page.on("requestfailed", (request) => failures.push(request.failure()?.errorText));
    await showStory(host, client, STORY);
    await expectPicture(page, host);
    expect(failures).toContain("net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS");
    client.stop();
  });

  test("serves nothing until the story is asked for, without a running catalogue", async ({ page }) => {
    // nothing listens here, so the command answers from a server of its own
    const client = await mcpClient("http://127.0.0.1:9", APP_CAPABILITIES);
    const { html, frameDomains } = await readApp(client);
    const origin = frameDomains[0] ?? "";
    await expect(fetch(origin)).rejects.toThrow();
    const { address, server } = await localHost(html, frameDomains);
    const host = await openHost(page, client, address);
    await showStory(host, client, STORY);
    const story = page.frameLocator("#view").frameLocator("#frame").frameLocator("iframe");
    await expect(story.getByRole("button").first()).toBeVisible({ timeout: 60_000 });
    client.stop();
    server.close();
  });
});
