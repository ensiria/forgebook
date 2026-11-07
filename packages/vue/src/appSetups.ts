/**
 * The set-ups a Vue catalogue's preview gave (`setup`, `appSetup.ts`), and the renderer's call of them on each story's
 * app. Kept out of the package's exports: a preview only adds to the list.
 *
 * @remarks
 * A preview that is edited runs again in the open frame and calls `setup` anew: the first call after a story was drawn
 * starts a new list, so its set-ups replace the earlier ones rather than run beside them (a second `createPinia()`, a
 * global mixin twice). A story already drawn keeps the app it has; the next one drawn gets the new set-ups.
 *
 * @module
 */
import type { App } from "vue";

/** What a preview does to a story's app. */
export type AppSetup = (app: App) => void;

/** The set-ups in the order the preview gave them. */
const setups: AppSetup[] = [];

/** Whether a story's app was set up since the list was last started: a later `setup` belongs to a preview run again. */
let hasSetUp = false;

/**
 * Adds a set-up, starting a new list when the preview runs again after stories were drawn.
 *
 * @param each - what to do to a story's app.
 */
export const addAppSetup = (each: AppSetup): void => {
  if (hasSetUp) {
    setups.length = 0;
    hasSetUp = false;
  }
  setups.push(each);
};

/**
 * Sets up a story's app with what the preview gave.
 *
 * @param app - the story's app, not yet mounted.
 */
export const setUpApp = (app: App): void => {
  hasSetUp = true;
  for (const each of setups) each(app);
};
