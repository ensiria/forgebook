/**
 * `next/headers` in a catalogue: `headers()`, `cookies()` and `draftMode()` return the request a story gives
 * (`parameters.nextjs.headers`, `cookies` and `draftMode`), so a server component that reads them draws.
 *
 * @remarks
 * Each returns a promise, as Next.js 15 and later do (`(await cookies()).get("theme")`); reading one without `await`,
 * which Next.js 15 still allowed with a warning and Next.js 16 removed, is not kept. A cookie set or deleted (by a
 * server action the story calls) changes the story's request and is listed among its events.
 *
 * @module
 */
import { currentStore } from "../routeStore.ts";

/** A cookie, as `cookies().get` returns it. */
export type RequestCookie = {
  /** Its name. */
  readonly name: string;
  /** Its value. */
  readonly value: string;
};

/** The request's cookies, as `cookies()` gives them. */
export type RequestCookies = {
  /** A cookie by name, or none. */
  readonly get: (name: string | { readonly name: string }) => RequestCookie | undefined;
  /** Every cookie, or every one of a name. */
  readonly getAll: (name?: string | { readonly name: string }) => RequestCookie[];
  /** Whether a cookie is there. */
  readonly has: (name: string) => boolean;
  /** Sets a cookie: a server action may. */
  readonly set: (name: string | RequestCookie, value?: string) => RequestCookies;
  /** Deletes a cookie: a server action may. */
  readonly delete: (name: string | { readonly name: string }) => RequestCookies;
  /** How many cookies there are. */
  readonly size: number;
  /** The cookies as a `Cookie` header writes them. */
  readonly toString: () => string;
};

/** Draft mode, as `draftMode()` gives it. */
export type DraftMode = {
  /** Whether it is on. */
  readonly isEnabled: boolean;
  /** Turns it on. */
  readonly enable: () => void;
  /** Turns it off. */
  readonly disable: () => void;
};

/**
 * A cookie's name, given as a text or as an object with one.
 *
 * @param name - the name.
 */
const nameOf = (name: string | { readonly name: string }): string =>
  typeof name === "string" ? name : name.name;

/** The story's cookies. */
const cookieStore = (): RequestCookies => {
  const store = currentStore();
  const { cookies } = store.request;
  const all = (): RequestCookie[] => [...cookies].map(([name, value]) => ({ name, value }));
  const self: RequestCookies = {
    get: (name: string | { readonly name: string }): RequestCookie | undefined => {
      const value = cookies.get(nameOf(name));
      return value === undefined ? undefined : { name: nameOf(name), value };
    },
    getAll: (name?: string | { readonly name: string }): RequestCookie[] =>
      name === undefined ? all() : all().filter((cookie) => cookie.name === nameOf(name)),
    has: (name: string): boolean => cookies.has(name),
    set: (name: string | RequestCookie, value?: string): RequestCookies => {
      const cookie = typeof name === "string" ? { name, value: value ?? "" } : name;
      cookies.set(cookie.name, cookie.value);
      store.record("cookies.set", [cookie.name, cookie.value]);
      return self;
    },
    delete: (name: string | { readonly name: string }): RequestCookies => {
      cookies.delete(nameOf(name));
      store.record("cookies.delete", [nameOf(name)]);
      return self;
    },
    get size(): number {
      return cookies.size;
    },
    toString: (): string =>
      all()
        .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
        .join("; ")
  };
  return self;
};

/** The story's cookies (`parameters.nextjs.cookies`). */
export const cookies = async (): Promise<RequestCookies> => cookieStore();

/** The story's request headers (`parameters.nextjs.headers`), read-only as Next.js's are. */
export const headers = async (): Promise<Headers> => new Headers(currentStore().request.headers);

/** The story's draft mode (`parameters.nextjs.draftMode`). */
export const draftMode = async (): Promise<DraftMode> => {
  const store = currentStore();
  return {
    get isEnabled(): boolean {
      return store.request.isDraftMode;
    },
    enable: (): void => {
      store.request.isDraftMode = true;
      store.record("draftMode.enable", []);
    },
    disable: (): void => {
      store.request.isDraftMode = false;
      store.record("draftMode.disable", []);
    }
  };
};
