/**
 * Nuxt's `$fetch` in a catalogue: the browser's `fetch` with what ofetch, Nuxt's `$fetch`, adds that a component relies
 * on: the app's base path, a query, a body sent as JSON, the answer read as JSON or text, and an error that carries the
 * status and the answer's data when the status is not a success.
 *
 * @remarks
 * Written on `fetch` rather than taking ofetch, so a catalogue's page loads nothing it would have to find in the
 * project's installed packages, and the catalogue's MSW handlers answer it as they answer `fetch`. ofetch's retries
 * and interceptors are left out: a story's answers come at once.
 *
 * @module
 */

/** A query's values, by name. */
export type FetchQuery = Readonly<Record<string, unknown>>;

/** What `$fetch` takes besides the address. */
export type StoryFetchOptions = {
  /** The method; GET by default. */
  readonly method?: string;
  /** The search params, by name: a list repeats its name, `undefined` is left out. */
  readonly query?: FetchQuery;
  /** `query`'s other name. */
  readonly params?: FetchQuery;
  /** The body: an object or an array is sent as JSON. */
  readonly body?: unknown;
  /** The headers. */
  readonly headers?: HeadersInit;
  /** What a relative address is resolved against; the app's base path by default. */
  readonly baseURL?: string;
  /** How the answer is read; from its content type by default. */
  readonly responseType?: "json" | "text" | "blob" | "arrayBuffer";
  /** What aborts the request. */
  readonly signal?: AbortSignal;
};

/** The error of an answer whose status is not a success. */
export class FetchError extends Error {
  /** The answer's status. */
  readonly statusCode: number;
  /** The answer's status text. */
  readonly statusMessage: string;
  /** The answer's body, read. */
  readonly data: unknown;

  /**
   * The error of an answer.
   *
   * @param address - the address asked.
   * @param response - the answer.
   * @param data - its body, read.
   */
  constructor(address: string, response: Response, data: unknown) {
    super(`[${response.status}] ${response.statusText} ${address}`.replace(/\s+/g, " ").trim());
    this.name = "FetchError";
    this.statusCode = response.status;
    this.statusMessage = response.statusText;
    this.data = data;
  }
}

/** Fetches an address, as Nuxt's `$fetch`. */
export type StoryFetch = <TResult = unknown>(
  address: string,
  options?: StoryFetchOptions
) => Promise<TResult>;

/**
 * An address with its base and query: a relative one resolved against the base, as ofetch does.
 *
 * @param address - the address.
 * @param baseURL - the base.
 * @param query - the search params.
 */
export const fetchAddress = (address: string, baseURL: string, query: FetchQuery): string => {
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(address) || address.startsWith("//");
  const joined = isAbsolute ? address : `${baseURL.replace(/\/+$/, "")}/${address.replace(/^\/+/, "")}`;
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(name, String(item));
  }
  const text = search.toString();
  if (text === "") return joined;
  return `${joined}${joined.includes("?") ? "&" : "?"}${text}`;
};

/**
 * A body as `fetch` sends it: an object or an array as JSON, anything else as it is.
 *
 * @param body - the body.
 */
const sentBody = (body: unknown): { readonly body: BodyInit | undefined; readonly isJson: boolean } => {
  if (body === undefined || body === null) return { body: undefined, isJson: false };
  if (typeof body === "string" || body instanceof Blob || body instanceof FormData)
    return { body, isJson: false };
  if (body instanceof URLSearchParams || body instanceof ArrayBuffer) return { body, isJson: false };
  return { body: JSON.stringify(body), isJson: true };
};

/**
 * An answer's body, read as its type or its content type says.
 *
 * @param response - the answer.
 * @param type - how to read it; from the content type when none.
 */
const readBody = async (response: Response, type: StoryFetchOptions["responseType"]): Promise<unknown> => {
  if (type === "blob") return response.blob();
  if (type === "arrayBuffer") return response.arrayBuffer();
  const text = await response.text();
  const isJson =
    type === "json" || (type === undefined && /json/i.test(response.headers.get("content-type") ?? ""));
  if (!isJson || text === "") return text;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return text;
  }
};

/**
 * A request as `fetch` takes it: its address, with its base and query, and its method, headers and body.
 *
 * @param address - the address.
 * @param baseURL - the app's base path.
 * @param options - the method, query, body, headers.
 */
const requestOf = (
  address: string,
  baseURL: string,
  options: StoryFetchOptions
): { readonly url: string; readonly init: RequestInit } => {
  const url = fetchAddress(address, options.baseURL ?? baseURL, options.query ?? options.params ?? {});
  const { body, isJson } = sentBody(options.body);
  const headers = new Headers(options.headers);
  if (isJson && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const method = options.method ?? (body === undefined ? "GET" : "POST");
  return {
    url,
    init: {
      method: method.toUpperCase(),
      headers,
      ...(body === undefined ? {} : { body }),
      ...(options.signal === undefined ? {} : { signal: options.signal })
    }
  };
};

/**
 * `$fetch` with a base path.
 *
 * @param baseURL - the app's base path.
 * @returns the function.
 */
export const createStoryFetch = (baseURL: string): StoryFetch => {
  /**
   * Fetches an address. Its answer is what the server sent, which no type can check: the caller names the type it
   * expects, as it does with ofetch's `$fetch<T>`.
   *
   * @param address - the address.
   * @param options - the method, query, body, headers.
   */
  function storyFetch<TResult = unknown>(address: string, options?: StoryFetchOptions): Promise<TResult>;
  async function storyFetch(address: string, options: StoryFetchOptions = {}): Promise<unknown> {
    const { url, init } = requestOf(address, baseURL, options);
    const response = await fetch(url, init);
    const data = await readBody(response, options.responseType);
    if (!response.ok) throw new FetchError(url, response, data);
    return data;
  }
  return storyFetch;
};
