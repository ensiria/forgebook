/**
 * What a server component's `fetch` reaches in a server render: the story's mock handlers, never the network.
 *
 * @remarks
 * A server component calls the global `fetch`, so there is no fetch of its own to hand it, as SvelteKit's load gets.
 * The global `fetch` is a wrapper that asks `AsyncLocalStorage` which render called it, so renders under way at once
 * each get their own handlers, and a fetch outside every render (the test's own, another package's) is the real one.
 * It stays once installed, for the life of the test's process: what a render started can fetch after the render ended (a
 * sibling of the component that threw, a render given up on), and that must not find the real one.
 *
 * On a server every address is absolute, so every address goes through the handlers, this machine's included: no
 * other origin is "fetched as it is", since nothing tells an API from whatever answers on the test machine. `fetch` is
 * the only way covered: `node:http` and sockets are not intercepted.
 *
 * Next.js's own options (`next: { revalidate, tags }`, `cache`) are read by the `Request` as any unknown or plain option
 * is, so a component that passes them is answered the same.
 *
 * @module
 */
import { mockedFetch } from "forgebook/story-mocks";

/** The module `AsyncLocalStorage` comes from: named by a variable, as this folder is type-checked without Node's types. */
const ASYNC_HOOKS_MODULE = "node:async_hooks";

/** The module MSW's request handling is imported from, by the project that installs it. */
const MSW_MODULE = "msw";

/** The origin a story's page has on a server, which a handler's path is read from. */
const PAGE_ORIGIN = "http://localhost";

/** The `fetch` a render's server components get. */
type RenderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** What of `AsyncLocalStorage` a render uses. */
type RenderStorage = {
  /** Runs a function with a value that what it starts reads back. */
  readonly run: <TResult>(store: RenderFetch, run: () => TResult) => TResult;
  /** The value of the render that called; none outside every render. */
  readonly getStore: () => RenderFetch | undefined;
};

/** What of `node:async_hooks` a render uses. */
type AsyncHooks = {
  /** Makes a storage. */
  // biome-ignore lint/style/useNamingConvention: Node's name for it
  readonly AsyncLocalStorage: new () => RenderStorage;
};

/**
 * Whether a module is `node:async_hooks`, as much as a render uses.
 *
 * @param module - the module, as `import()` gave it.
 */
const isAsyncHooks = (module: unknown): module is AsyncHooks =>
  typeof module === "object" &&
  module !== null &&
  "AsyncLocalStorage" in module &&
  typeof module.AsyncLocalStorage === "function";

/** The storage of the renders under way, made when the first one runs. */
let storage: RenderStorage | undefined;

/** The storage of the renders under way. */
const renderStorage = async (): Promise<RenderStorage> => {
  if (storage !== undefined) return storage;
  const module: unknown = await import(/* @vite-ignore */ ASYNC_HOOKS_MODULE);
  if (!isAsyncHooks(module)) throw new Error("A server render needs AsyncLocalStorage: run it on Node");
  storage ??= new module.AsyncLocalStorage();
  return storage;
};

/** The wrapper of the global `fetch`, once it is installed. */
let wrapper: typeof globalThis.fetch | undefined;

/**
 * Makes the global `fetch` ask which render called it, unless it already does. Something that replaced it and put back
 * another (a test's stub, an interceptor closed) leaves no wrapper in place, so each render asks again.
 */
const installWrapper = (): void => {
  if (wrapper !== undefined && globalThis.fetch === wrapper) return;
  const original = globalThis.fetch;
  wrapper = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const renderFetch = (await renderStorage()).getStore();
    return (renderFetch ?? original)(input, init);
  };
  globalThis.fetch = wrapper;
};

// on a server, before the stories' modules load, so a client they make at import holds the wrapper
if (typeof window === "undefined") installWrapper();

/**
 * The error of a request no handler answered: what was asked, and what to give.
 *
 * @param request - the request.
 */
const unansweredError = (request: Request): Error =>
  new Error(
    `A server component fetched ${request.method} ${request.url} on a server, and no mock of the story answers it: a ` +
      "server render never reaches the network. Answer it with a handler for that address in " +
      "parameters.msw.handlers, or give the component its data as props."
  );

/**
 * The error of a path fetched on a server, which has no page to read it from.
 *
 * @param path - the path.
 */
const pathError = (path: string): TypeError =>
  new TypeError(
    `A server component fetched ${path} on a server, where a fetch needs a full address (Next.js's server refuses a ` +
      "path too). Fetch the full address, and answer it with a handler in parameters.msw.handlers."
  );

/**
 * Runs a server render with its `fetch` answered by the story's handlers.
 *
 * @remarks
 * A fetch no handler answers fails the render, though the component caught the error or threw one of its own: what it
 * drew instead is not the page.
 *
 * @param handlers - the story's mock handlers.
 * @param render - the render.
 * @returns what the render gave.
 * @throws the first fetch no handler answered, else what the render threw.
 */
export const withStoryFetch = async <TResult>(
  handlers: readonly unknown[],
  render: () => Promise<TResult>
): Promise<TResult> => {
  const renders = await renderStorage();
  let failure: Error | undefined;
  const fail = (error: Error): Error => {
    failure ??= error;
    return error;
  };
  const send = mockedFetch({
    handlers,
    origin: PAGE_ORIGIN,
    // named by a variable, so nothing but a server render with handlers needs MSW
    loadMsw: (): Promise<unknown> => import(/* @vite-ignore */ MSW_MODULE),
    onUnanswered: (request: Request): Error => fail(unansweredError(request))
  });
  const renderFetch: RenderFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    if (typeof input === "string" && !URL.canParse(input)) throw fail(pathError(input));
    return send(new Request(input, init));
  };
  installWrapper();
  try {
    const result = await renders.run(renderFetch, render);
    if (failure !== undefined) throw failure;
    return result;
  } catch (thrown) {
    throw failure ?? thrown;
  }
};
