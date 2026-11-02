/// <reference lib="dom" />
/**
 * The page a client that renders apps shows `story_preview`'s answer in: an MCP Apps view (specification 2026-01-26) that
 * shows the story live and, when the host cannot, its picture.
 *
 * @remarks
 * Runs in the host's sandboxed frame, written into the resource by its source (`previewPages.ts`), so it takes no import
 * and talks to the host in plain JSON-RPC over `postMessage`, as the specification allows without its SDK. A resource is
 * a template: the story comes from the tool's arguments and answer, and the frame's address is set only when that answer
 * arrives, so a host that reads the resource ahead of time loads no story.
 *
 * Whether a local server gets into the host's frame is not the page's to decide: a host can refuse the origin
 * (`frame-src`), and a browser refuses a public page's frame to a local address (Local Network Access), which a host on
 * a public sandbox origin cannot lift for a server it does not know. Neither is reported to the page as such. So the
 * story counts as shown only once the relay says so, and a blocked frame, a frame that loaded without the relay running
 * (the browser's error page) or a long silence asks the host to run `story_shot`; a story that comes up after all takes
 * the picture's place.
 *
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
 * @module
 */
import type { PreviewRelayMessage } from "./previewRelay.ts";
import type { PreviewTexts } from "./previewTexts.ts";

/** What the page is given when it is written. */
export type PreviewViewOptions = {
  /** Its words. */
  readonly texts: PreviewTexts;
  /** Forgebook's version, which it names to the host. */
  readonly version: string;
  /** The MCP Apps version it speaks. */
  readonly protocolVersion: string;
  /** The tool that takes the picture. */
  readonly shotTool: string;
  /** How long a story may stay silent before its picture is asked for, in ms. */
  readonly silenceMs: number;
};

/** The ids of the elements `previewPages.ts` writes, which the page fills. */
export const PREVIEW_ELEMENTS = {
  title: "story",
  open: "open",
  status: "status",
  frame: "frame",
  picture: "picture"
} as const;

/**
 * Runs the page.
 *
 * @param options - what it is given.
 * @param elements - the ids of its elements.
 */
export const previewView = (options: PreviewViewOptions, elements: typeof PREVIEW_ELEMENTS): void => {
  const { texts } = options;
  const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const textOf = (value: unknown): string | undefined =>
    typeof value === "string" && value !== "" ? value : undefined;
  const required = <T extends Element>(id: string, type: new () => T): T => {
    const found = document.getElementById(id);
    if (!(found instanceof type)) throw new Error(`The page has no ${id}`);
    return found;
  };
  const title = required(elements.title, HTMLElement);
  const open = required(elements.open, HTMLButtonElement);
  const status = required(elements.status, HTMLElement);
  const frame = required(elements.frame, HTMLIFrameElement);
  const picture = required(elements.picture, HTMLImageElement);

  /* the host's side of the conversation */
  let lastId = 0;
  const waiting = new Map<number, (reply: Readonly<Record<string, unknown>>) => void>();
  const post = (message: Readonly<Record<string, unknown>>): void => {
    window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
  };
  const notify = (method: string, params: Readonly<Record<string, unknown>>): void => {
    post({ method, params });
  };
  const ask = (
    method: string,
    params: Readonly<Record<string, unknown>>
  ): Promise<Readonly<Record<string, unknown>>> =>
    new Promise((done) => {
      lastId += 1;
      waiting.set(lastId, done);
      post({ id: lastId, method, params });
    });

  /* what the page knows */
  let storyId: string | undefined;
  let view: string | undefined;
  let address: string | undefined;
  let hostOpensLinks = false;
  let hostCallsTools = false;
  let isLive = false;
  let isFallingBack = false;
  let hasRelay = false;
  let silence: ReturnType<typeof setTimeout> | undefined;

  const say = (text: string): void => {
    status.textContent = text;
    status.hidden = text === "";
  };

  const showLink = (): void => {
    open.hidden = !(hostOpensLinks && address !== undefined);
  };

  const showLive = (): void => {
    isLive = true;
    clearTimeout(silence);
    say("");
    picture.hidden = true;
    frame.hidden = false;
  };

  // at this page's own width, so that the picture is not a whole window shrunk into it
  const pictureView = (): string => {
    const search = new URLSearchParams(view);
    if (!search.has("width")) search.set("width", String(document.body.clientWidth));
    return search.toString();
  };

  const showPicture = async (): Promise<void> => {
    if (isLive || isFallingBack || storyId === undefined) return;
    isFallingBack = true;
    clearTimeout(silence);
    if (!hostCallsTools) {
      say(texts.previewUnavailable);
      return;
    }
    say(texts.previewTakingPicture);
    const { result } = await ask("tools/call", {
      name: options.shotTool,
      arguments: { id: storyId, views: [pictureView()] }
    });
    if (isLive) return;
    const content = isRecord(result) && Array.isArray(result["content"]) ? result["content"] : [];
    const image: unknown = content.find((block) => isRecord(block) && block["type"] === "image");
    if (!isRecord(image) || typeof image["data"] !== "string") {
      say(texts.previewUnavailable);
      return;
    }
    picture.src = `data:image/png;base64,${image["data"]}`;
    picture.hidden = false;
    say("");
  };

  const showStory = (preview: string): void => {
    const url = new URL(preview);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    say(texts.previewLoading);
    silence = setTimeout(() => void showPicture(), options.silenceMs);
    frame.src = url.href;
  };

  const showFailure = (structured: unknown): void => {
    const reason = isRecord(structured) ? textOf(structured["error"]) : undefined;
    say(reason ?? texts.previewUnavailable);
  };

  const showAnswer = (answer: unknown): void => {
    const structured = isRecord(answer) ? answer["structuredContent"] : undefined;
    const hasFailed = !isRecord(answer) || answer["isError"] === true;
    if (hasFailed || !isRecord(structured)) {
      showFailure(structured);
      return;
    }
    const links = structured["links"];
    address = isRecord(links) ? textOf(links["address"]) : undefined;
    storyId = textOf(structured["id"]) ?? storyId;
    title.textContent = storyId ?? "";
    showLink();
    const preview = textOf(structured["preview"]);
    if (preview === undefined) say(texts.previewUnavailable);
    else showStory(preview);
  };

  const applyVariables = (styles: unknown): void => {
    const variables = isRecord(styles) ? styles["variables"] : undefined;
    if (!isRecord(variables)) return;
    for (const [name, value] of Object.entries(variables))
      if (typeof value === "string") document.documentElement.style.setProperty(name, value);
  };

  const applyBox = (box: unknown): void => {
    if (!isRecord(box)) return;
    const { style } = document.documentElement;
    if ("height" in box) style.height = "100vh";
    else if (typeof box["maxHeight"] === "number") style.maxHeight = `${box["maxHeight"]}px`;
  };

  const applyContext = (context: unknown): void => {
    if (!isRecord(context)) return;
    const { theme } = context;
    if (theme === "light" || theme === "dark") document.documentElement.style.colorScheme = theme;
    applyVariables(context["styles"]);
    applyBox(context["containerDimensions"]);
  };

  let lastSize = "";
  const reportSize = (): void => {
    const { width, height } = document.body.getBoundingClientRect();
    const size = { width: Math.ceil(width), height: Math.ceil(height) };
    if (JSON.stringify(size) === lastSize) return;
    lastSize = JSON.stringify(size);
    notify("ui/notifications/size-changed", size);
  };

  const applyInitialized = (result: unknown): void => {
    if (!isRecord(result)) return;
    const capabilities = result["hostCapabilities"];
    hostOpensLinks = isRecord(capabilities) && isRecord(capabilities["openLinks"]);
    hostCallsTools = isRecord(capabilities) && isRecord(capabilities["serverTools"]);
    applyContext(result["hostContext"]);
    showLink();
    notify("ui/notifications/initialized", {});
    new ResizeObserver(reportSize).observe(document.body);
  };

  const answerHost = (id: unknown, method: string): void => {
    // the host waits for the answer before it takes the page down; a story in a frame has nothing to save
    if (method === "ping" || method === "ui/resource-teardown") post({ id, result: {} });
    else post({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  };

  const hearHost = (method: string, params: unknown): void => {
    if (method === "ui/notifications/tool-result") showAnswer(params);
    if (method === "ui/notifications/host-context-changed") applyContext(params);
    if (method === "ui/notifications/tool-cancelled") say(texts.previewCancelled);
    if (method === "ui/notifications/tool-input" && isRecord(params) && isRecord(params["arguments"])) {
      storyId = textOf(params["arguments"]["id"]);
      view = textOf(params["arguments"]["view"]);
      title.textContent = storyId ?? "";
    }
  };

  const hearStory = (message: unknown): void => {
    if (!isRecord(message)) return;
    const started: PreviewRelayMessage["type"] = "forgebook:preview-started";
    const ready: PreviewRelayMessage["type"] = "forgebook:preview-ready";
    const size: PreviewRelayMessage["type"] = "forgebook:preview-size";
    if (message["type"] === started) hasRelay = true;
    if (message["type"] === ready) showLive();
    if (message["type"] === size && typeof message["height"] === "number")
      frame.style.height = `${message["height"]}px`;
  };

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source === frame.contentWindow) {
      hearStory(event.data);
      return;
    }
    if (event.source !== window.parent || !isRecord(event.data)) return;
    const { id, method, params } = event.data;
    if (typeof method === "string") {
      if (id === undefined) hearHost(method, params);
      else answerHost(id, method);
      return;
    }
    if (typeof id !== "number") return;
    waiting.get(id)?.(event.data);
    waiting.delete(id);
  });

  // a frame the host's policy refuses never says so to the frame, only to the document that asked for it
  document.addEventListener("securitypolicyviolation", (event) => {
    if (event.effectiveDirective === "frame-src") void showPicture();
  });

  frame.addEventListener("load", () => {
    if (!hasRelay) void showPicture();
  });

  open.addEventListener("click", () => {
    if (address !== undefined) void ask("ui/open-link", { url: address });
  });

  open.textContent = texts.previewOpen;
  frame.title = texts.previewFrame;
  picture.alt = texts.previewPicture;
  say(texts.previewWaiting);
  void ask("ui/initialize", {
    appInfo: { name: "forgebook-story-preview", version: options.version },
    appCapabilities: { availableDisplayModes: ["inline"] },
    protocolVersion: options.protocolVersion
  }).then(({ result }) => {
    applyInitialized(result);
  });
};
