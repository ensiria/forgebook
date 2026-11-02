/**
 * What the frame module tells the Network tab of a story: its handlers and its requests, in one JSON value, and how the
 * tab reads it back.
 *
 * @remarks
 * The value crosses between two documents and a report replaces the last one, so it is whole and short: the log keeps
 * the latest requests, and no body or header, which may hold what a log should not. Pure.
 *
 * @module
 */
import type { JsonValue } from "forgebook/plugin";

/** One handler of a story. */
export type NetworkHandler = {
  /** What it answers, as MSW writes it (`GET /api/users`). */
  readonly label: string;
};

/** One request of a story. */
export type NetworkRequest = {
  /** The method. */
  readonly method: string;
  /** The address, without its origin when it is the page's. */
  readonly url: string;
  /** The answer's status. */
  readonly status: number;
  /** Whether a handler answered it, rather than the network. */
  readonly isMocked: boolean;
};

/** What the tab shows. */
export type NetworkReport = {
  /** The story's handlers. */
  readonly handlers: readonly NetworkHandler[];
  /** Its requests, the latest first. */
  readonly requests: readonly NetworkRequest[];
};

/** The most requests a report holds. */
export const MAX_REQUESTS = 100;

/** Whether a value is an object with named fields. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is one handler. */
const isHandler = (value: unknown): value is NetworkHandler =>
  isRecord(value) && typeof value["label"] === "string";

/** Whether a value is one request. */
const isRequest = (value: unknown): value is NetworkRequest =>
  isRecord(value) &&
  typeof value["method"] === "string" &&
  typeof value["url"] === "string" &&
  typeof value["status"] === "number" &&
  typeof value["isMocked"] === "boolean";

/**
 * A report read back; none for anything else, as before the frame reported.
 *
 * @param value - what the tab received.
 */
export const networkReportOf = (value: JsonValue | undefined): NetworkReport | undefined => {
  if (!isRecord(value)) return undefined;
  const { handlers, requests } = value;
  if (!Array.isArray(handlers) || !Array.isArray(requests)) return undefined;
  return { handlers: handlers.filter(isHandler), requests: requests.filter(isRequest) };
};

/**
 * What a report's list says when a request arrives.
 *
 * @param requests - the requests so far, the latest first.
 * @param request - the new one.
 */
export const withRequest = (
  requests: readonly NetworkRequest[],
  request: NetworkRequest
): readonly NetworkRequest[] => [request, ...requests].slice(0, MAX_REQUESTS);

/** The files a page loads for itself through the same worker: its modules, styles, fonts and images. */
const PAGE_FILE = /\.(?:[cm]?[jt]sx?|s?css|map|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i;

/** The dev server's own addresses. */
const DEV_SERVER_PATH = /^\/(?:@|node_modules\/)/;

/**
 * An address as the log writes it: without its origin when it is the page's.
 *
 * @param url - the request's address.
 * @param origin - the page's origin.
 */
export const shownUrl = (url: string, origin: string): string => {
  const parsed = new URL(url);
  return parsed.origin === origin ? `${parsed.pathname}${parsed.search}` : url;
};

/**
 * Whether a request no handler answered is the story's own, worth listing: every file the page loads goes through the
 * same worker, and would bury it.
 *
 * @param url - the request's address.
 * @param origin - the page's origin.
 */
export const isStoryRequest = (url: string, origin: string): boolean => {
  const { origin: requestOrigin, pathname } = new URL(url);
  if (requestOrigin !== origin) return !PAGE_FILE.test(pathname);
  return !PAGE_FILE.test(pathname) && !DEV_SERVER_PATH.test(pathname);
};
