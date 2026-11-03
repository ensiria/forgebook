/**
 * `$app/state` in a catalogue: the page, the navigation under way and whether a new version is out, read from the
 * story's page (`parameters.sveltekit`) and followed by Svelte as SvelteKit's own are.
 *
 * @remarks
 * Each field is read when it is read, from the frame's current story, so a component reading `page.url.pathname`
 * in its markup follows a link the story clicked.
 *
 * @module
 */
import type { KitError, KitNavigation, KitPage } from "../kitParameters.ts";
import { currentStore } from "../kitStore.ts";

/** The page, as `page` from `$app/state` gives it. */
export const page: KitPage = {
  get url(): URL {
    return currentStore().page().url;
  },
  get params(): KitPage["params"] {
    return currentStore().page().params;
  },
  get route(): KitPage["route"] {
    return currentStore().page().route;
  },
  get status(): number {
    return currentStore().page().status;
  },
  get error(): KitError | null {
    return currentStore().page().error;
  },
  get data(): KitPage["data"] {
    return currentStore().page().data;
  },
  get state(): KitPage["state"] {
    return currentStore().page().state;
  },
  get form(): unknown {
    return currentStore().page().form;
  }
};

/** The navigation under way, as `navigating` from `$app/state` gives it: every field `null` when there is none. */
export const navigating = {
  get from(): KitNavigation["from"] | null {
    return currentStore().navigating()?.from ?? null;
  },
  get to(): KitNavigation["to"] | null {
    return currentStore().navigating()?.to ?? null;
  },
  get type(): KitNavigation["type"] | null {
    return currentStore().navigating()?.type ?? null;
  },
  get willUnload(): boolean | null {
    return currentStore().navigating()?.willUnload ?? null;
  },
  get delta(): number | null {
    return currentStore().navigating()?.delta ?? null;
  },
  get complete(): Promise<void> | null {
    return currentStore().navigating()?.complete ?? null;
  }
};

/** Whether a new version of the app is out: the story's `updated`. */
export const updated = {
  get current(): boolean {
    return currentStore().updated();
  },
  check: (): Promise<boolean> => {
    const store = currentStore();
    store.record("updated.check", []);
    return Promise.resolve(store.updated());
  }
};
