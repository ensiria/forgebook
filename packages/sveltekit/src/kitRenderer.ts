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

import { hrefCallbacksOf, type KitPage, type StoryKit } from "./kitParameters.ts";
import {
  createKitStore,
  type DataLoader,
  errorOfThrown,
  type KitStore,
  setCurrentStore
} from "./kitStore.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An error as the frame takes it: SvelteKit's `error(404, "…")` written with its status. */
const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  const read = errorOfThrown(error);
  return new Error(`${read.status ?? 500}: ${read.message}`);
};

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
 * The href of the link an event went through, as written: an `<a>` (HTML or SVG) or an `<area>`; none without one.
 *
 * @param event - the click.
 */
const linkHref = (event: Event): string | null => {
  for (const target of event.composedPath())
    if (target instanceof Element && (target.localName === "a" || target.localName === "area"))
      return target.getAttribute("href") ?? target.getAttribute("xlink:href");
  return null;
};

/**
 * The address a form sent without `use:enhance` goes to: a GET form's action with its values as the search.
 *
 * @param form - the form.
 * @param submitter - the button that sent it, or none.
 * @param pageUrl - the story's page, the action's base.
 */
const formAddress = (form: HTMLFormElement, submitter: HTMLElement | null, pageUrl: URL): URL => {
  const action = new URL(submitter?.getAttribute("formaction") ?? form.getAttribute("action") ?? "", pageUrl);
  const values = new FormData(form);
  action.search = new URLSearchParams(
    [...values].map(([name, value]): [string, string] => [
      name,
      typeof value === "string" ? value : value.name
    ])
  ).toString();
  return action;
};

/**
 * Keeps a story in its frame: a link of the app moves the story's page, one an `hrefs` entry names calls it, one
 * outside the app goes nowhere; a form sent without `use:enhance` is recorded, and a GET form moves the page as the
 * browser would; each is recorded.
 *
 * @param canvas - the story's canvas.
 * @param store - the story's page.
 * @returns what stops it.
 */
const keepInStory = (canvas: HTMLElement, store: KitStore): (() => void) => {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const href = linkHref(event);
    if (href === null) return;
    // the frame's address names the story: a link never takes the frame away from it
    event.preventDefault();
    store.record("link", [href]);
    const matched = hrefCallbacksOf(store.kit.hrefs, href);
    for (const callback of matched) callback(href, event);
    if (matched.length === 0) void store.navigate("link", href);
  };
  const onSubmit = (event: SubmitEvent): void => {
    // `use:enhance` handles its own form first
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    const form = event.target;
    const method = (event.submitter?.getAttribute("formmethod") ?? form.method).toUpperCase();
    const address = formAddress(form, event.submitter, store.page().url);
    store.record("submit", [
      method,
      method === "GET" ? `${address.pathname}${address.search}` : address.pathname
    ]);
    if (method === "GET") void store.navigate("form", address);
  };
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("submit", onSubmit);
  return (): void => {
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("submit", onSubmit);
  };
};

/** The page of each story drawn now, by its parameters, and how many of its drawings use it. */
const SHARED = new WeakMap<object, { readonly store: KitStore; mounts: number }>();

/**
 * The page of a story about to be drawn, made the frame's current one, with its loader: the one its other drawings use
 * when it is drawn several times at once (a matrix's cells), since one frame shows one page; a new one otherwise.
 *
 * @param drawing - the drawing the frame gave.
 * @returns the page, and what lets it go when the drawing is taken away.
 */
const storeOf = (drawing: StoryDrawing): { readonly store: KitStore; readonly release: () => void } => {
  const key = drawing.story.parameters;
  const shared = SHARED.get(key);
  const entry =
    shared !== undefined && shared.mounts > 0
      ? shared
      : { store: createKitStore(key, drawing.report), mounts: 0 };
  if (entry !== shared) {
    entry.store.setLoader(loaderOf(entry.store.kit, entry.store));
    SHARED.set(key, entry);
  }
  entry.mounts += 1;
  setCurrentStore(entry.store);
  return {
    store: entry.store,
    release: (): void => {
      entry.mounts -= 1;
    }
  };
};

/** Svelte's renderer for a SvelteKit project. */
export const kitRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const { store, release } = storeOf(first);
    let latest = first;
    let inner: MountedStory | undefined;
    let isGone = false;
    const stopKeeping = keepInStory(canvas, store);
    // an error a load throws, then or after a move, is shown in place of the story
    store.setErrorHandler((error: unknown) => onError(toError(error)));
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
        : store
            .reload()
            .then(
              async (isLoaded: boolean): Promise<void> =>
                isLoaded && !isGone ? draw().drawn : new Promise<void>(() => undefined)
            );
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        latest = next;
        inner?.update(withPage(next, store));
      },
      unmount: (): void => {
        isGone = true;
        stopKeeping();
        stopData();
        release();
        inner?.unmount();
      }
    };
  },
  renderToString: async (drawing: StoryDrawing): Promise<string> => {
    const { store, release } = storeOf(drawing);
    try {
      let failure: unknown;
      store.setErrorHandler((error: unknown) => {
        failure = error;
      });
      if (store.kit.loads.length > 0 && !(await store.reload())) throw toError(failure);
      return await svelteRenderer.renderToString(withPage(drawing, store));
    } finally {
      release();
    }
  }
};
