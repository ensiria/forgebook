/**
 * Forgebook's renderer for a SvelteKit project: Svelte's renderer, each story given its page (`$app/state`), its
 * page's data loaded by its `load` before it is drawn, and its links kept in the story.
 *
 * @remarks
 * A story's page (`parameters.sveltekit`) lives in a store made when the story is mounted, so a story drawn again with
 * other args keeps where its links took it, and one that starts over starts at its own page. A story that gives its
 * page data (`page.data`, `serverData` or `load`) or an action's answer (`forms.result`) is a page's: its component
 * gets `data`, `form` and `params`, as SvelteKit
 * draws a `+page.svelte`, unless its args give them. Every link the story draws is caught, so the frame stays on its
 * story: one of the app moves the story's page, one an `hrefs` entry names calls it instead, and each is listed among
 * the story's events. Everything else is Svelte's renderer (`@forgebook/svelte/renderer`), which this one wraps.
 *
 * @module
 */
import { svelteRenderer } from "@forgebook/svelte/renderer";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";

import { hrefCallbackOf, type KitPage, type StoryKit } from "./kitParameters.ts";
import { createKitStore, type DataLoader, type KitStore, setCurrentStore } from "./kitStore.ts";

/** How many redirects a page's loads may throw before the catalogue gives up, as a browser does. */
const MOST_REDIRECTS = 10;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An error as the frame takes it: SvelteKit's `error(404, "…")` written with its status. */
const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (isRecord(error) && typeof error["status"] === "number" && isRecord(error["body"])) {
    const message = error["body"]["message"];
    return new Error(`${error["status"]}: ${typeof message === "string" ? message : "error"}`);
  }
  return new Error(String(error));
};

/**
 * The address a redirect a load threw goes to (SvelteKit's `redirect(303, "/login")`), or none.
 *
 * @param thrown - what the load threw.
 */
const redirectOf = (thrown: unknown): string | undefined =>
  isRecord(thrown) &&
  typeof thrown["status"] === "number" &&
  thrown["status"] >= 300 &&
  thrown["status"] < 400 &&
  typeof thrown["location"] === "string"
    ? thrown["location"]
    : undefined;

/**
 * The address a load fetches: in a page, as the frame's `fetch` reads it, so the catalogue's mocks answer a path; on a
 * server, which has no page to read a path from, from the story's page, as SvelteKit's `fetch` does.
 *
 * @param input - what the load fetches.
 * @param pageUrl - the story's page.
 */
const pageRequest = (input: string, pageUrl: URL): string =>
  typeof location === "undefined" ? new URL(input, pageUrl).href : input;

/**
 * The loader of a story's page data: its loads in order, the layouts' first, each `parent()` the data above it.
 *
 * @param kit - the story's settings.
 * @param store - the story's page, which records what the loads call.
 * @returns the loader, or none for a story that gives no load and no server data.
 */
const loaderOf = (kit: StoryKit, store: KitStore): DataLoader | undefined => {
  if (kit.loads.length === 0 && kit.serverData === null) return undefined;
  return async (
    at: Pick<KitPage, "url" | "params" | "route">
  ): Promise<Readonly<Record<string, unknown>>> => {
    let merged: Readonly<Record<string, unknown>> = kit.page.data;
    if (kit.loads.length === 0) return { ...merged, ...kit.serverData };
    for (const [index, load] of kit.loads.entries()) {
      const above = merged;
      const isPage = index === kit.loads.length - 1;
      const result: unknown = await load({
        params: at.params,
        url: at.url,
        route: at.route,
        fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
          globalThis.fetch(typeof input === "string" ? pageRequest(input, at.url) : input, init),
        // the page's server data is the page's load's; a layout's server load is given by `page.data`
        data: isPage ? kit.serverData : null,
        parent: async (): Promise<Readonly<Record<string, unknown>>> => above,
        depends: (...dependencies: string[]): void => store.record("depends", dependencies),
        setHeaders: (): void => undefined,
        untrack: <TValue>(read: () => TValue): TValue => read()
      });
      merged = { ...merged, ...(isRecord(result) ? result : {}) };
    }
    return merged;
  };
};

/**
 * Loads a story's page data before it is drawn, following the redirects its loads throw.
 *
 * @param store - the story's page.
 */
const loadFirst = async (store: KitStore): Promise<void> => {
  for (let redirects = 0; ; redirects += 1) {
    try {
      await store.reload();
      return;
    } catch (thrown) {
      const location = redirectOf(thrown);
      if (location === undefined || redirects >= MOST_REDIRECTS) throw thrown;
      store.record("redirect", [location]);
      await store.navigate("goto", location);
    }
  }
};

/**
 * The drawing Svelte's renderer gets: a page's component given its data, form and params, unless its args give them.
 *
 * @param drawing - the drawing the frame gave.
 * @param store - the story's page.
 */
const withPage = (drawing: StoryDrawing, store: KitStore): StoryDrawing => {
  if (!store.kit.isPage) return drawing;
  const page = store.page();
  return {
    ...drawing,
    args: {
      ...("data" in drawing.args ? {} : { data: page.data }),
      ...("form" in drawing.args ? {} : { form: page.form }),
      // SvelteKit 3 gives a page its route's params too
      ...("params" in drawing.args ? {} : { params: page.params }),
      ...drawing.args
    }
  };
};

/**
 * Keeps a story's links in the story: a link of the app moves its page, one an `hrefs` entry names calls it, one
 * outside the app goes nowhere; each is recorded.
 *
 * @param canvas - the story's canvas.
 * @param store - the story's page.
 * @returns what stops it.
 */
const catchLinks = (canvas: HTMLElement, store: KitStore): (() => void) => {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const link = event.composedPath().find((target) => target instanceof HTMLAnchorElement);
    const href = link instanceof HTMLAnchorElement ? link.getAttribute("href") : null;
    if (href === null) return;
    // the frame's address names the story: a link never takes the frame away from it
    event.preventDefault();
    store.record("link", [href]);
    const callback = hrefCallbackOf(store.kit.hrefs, href);
    if (callback !== undefined) callback(href, event);
    else void store.navigate("link", href);
  };
  canvas.addEventListener("click", onClick);
  return (): void => canvas.removeEventListener("click", onClick);
};

/**
 * The store of a story about to be drawn, made the frame's current one, with its loader.
 *
 * @param drawing - the drawing the frame gave.
 */
const storeOf = (drawing: StoryDrawing): KitStore => {
  const store = createKitStore(drawing.story.parameters, drawing.report);
  store.setLoader(loaderOf(store.kit, store));
  setCurrentStore(store);
  return store;
};

/** Svelte's renderer for a SvelteKit project. */
export const kitRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const store = storeOf(first);
    let latest = first;
    let inner: MountedStory | undefined;
    let isGone = false;
    const stopLinks = catchLinks(canvas, store);
    let shown = store.page();
    // a page's component follows its data, form and params, as SvelteKit gives them again after a move or an action
    const stopData = store.subscribe(() => {
      const now = store.page();
      if (now.data === shown.data && now.form === shown.form && now.params === shown.params) return;
      shown = now;
      if (store.kit.isPage) inner?.update(withPage(latest, store));
    });
    const draw = (): MountedStory => {
      const mounted = svelteRenderer.mount(canvas, withPage(latest, store), onError);
      inner = mounted;
      return mounted;
    };
    // a page without loads is drawn at once, as any Svelte story; one with loads once they are done
    const drawn =
      store.kit.loads.length === 0
        ? draw().drawn
        : loadFirst(store).then(
            async (): Promise<void> => (isGone ? undefined : draw().drawn),
            (error: unknown): Promise<void> => {
              onError(toError(error));
              return new Promise<void>(() => undefined);
            }
          );
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        latest = next;
        inner?.update(withPage(next, store));
      },
      unmount: (): void => {
        isGone = true;
        stopLinks();
        stopData();
        inner?.unmount();
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const store = storeOf(drawing);
    if (store.kit.loads.length > 0) await loadFirst(store);
    return svelteRenderer.renderToString(withPage(drawing, store));
  }
};
