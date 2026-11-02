/**
 * `$app/stores` in a catalogue, for a project on SvelteKit 2: the page, the navigation and the version as Svelte stores,
 * over the same story page as `$app/state`.
 *
 * @remarks
 * SvelteKit 3 removed the module; a project on SvelteKit 2 still imports it, so the catalogue gives it either way.
 *
 * @module
 */
import type { KitNavigation, KitPage } from "../kitParameters.ts";
import { currentStore } from "../kitStore.ts";

/** A store a component subscribes to with `$name`. */
export type Readable<TValue> = {
  /** Calls `run` with the value now and at each change; returns what stops it. */
  readonly subscribe: (run: (value: TValue) => void) => () => void;
};

/**
 * A store over a value of the story's page.
 *
 * @param read - reads the value from the frame's current story.
 */
const readable = <TValue>(read: () => TValue): Readable<TValue> => ({
  subscribe: (run: (value: TValue) => void): (() => void) => {
    const store = currentStore();
    let last = read();
    run(last);
    // the page changes alone, the navigation alone: each store runs only for its own value
    return store.subscribe(() => {
      const value = read();
      if (value === last) return;
      last = value;
      run(value);
    });
  }
});

/** The page, as `$page` reads it. */
export const page: Readable<KitPage> = readable(() => currentStore().page());

/** The navigation under way, or `null`, as `$navigating` reads it. */
export const navigating: Readable<Partial<KitNavigation> | null> = readable(() =>
  currentStore().navigating()
);

/** Whether a new version is out, as `$updated` reads it; `updated.check()` resolves with the same. */
export const updated: Readable<boolean> & { readonly check: () => Promise<boolean> } = {
  ...readable(() => currentStore().updated()),
  check: (): Promise<boolean> => {
    const store = currentStore();
    store.record("updated.check", []);
    return Promise.resolve(store.updated());
  }
};

/** The three stores, as `getStores()` returns them. */
export const getStores = (): {
  readonly page: Readable<KitPage>;
  readonly navigating: Readable<Partial<KitNavigation> | null>;
  readonly updated: Readable<boolean> & { readonly check: () => Promise<boolean> };
} => ({ page, navigating, updated });
