/**
 * What a Vue catalogue's preview does to every story's app before the story is drawn: `setup((app) => app.use(pinia))`,
 * as an application's `main.ts` does to its root. A decorator runs too late for it (the app exists, and what a plugin
 * or a global mixin installs must be there before any component is made), so the renderer calls these on each story's
 * app before it mounts, in the page and in the server tests given the preview.
 *
 * @remarks
 * Not the preview's own `setup` field, which runs once before any story. The shape of Storybook's `setup` of
 * `@storybook/vue3` with the app alone; a migrated preview imports it from here. A framework built on Vue prepares the
 * app first (Nuxt installs its router and its state), so a set-up can use what it installed and override it.
 *
 * @module
 */
import { type AppSetup, addAppSetup } from "./appSetups.ts";

/**
 * Has every story's app set up before it is drawn: plugins (`app.use`), global components and directives, global mixins,
 * values provided to every component.
 *
 * @param each - what to do to a story's app.
 */
export const setup = (each: AppSetup): void => {
  addAppSetup(each);
};
