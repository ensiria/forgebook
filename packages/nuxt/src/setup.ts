/**
 * What a Nuxt catalogue's preview does to every story's app before it is drawn: `setup((app) => app.use(pinia))`, as a
 * Nuxt plugin does in the app. Vue's set-up, given from this package, which a Nuxt catalogue installs, rather than from
 * `@forgebook/vue`, which it need not.
 *
 * @module
 */
import { setup as vueSetup } from "@forgebook/vue/setup";

/**
 * Has every story's app set up before it is drawn, after Nuxt prepared it (its router, state and components): plugins
 * (`app.use`), global components and directives, values provided to every component.
 */
export const setup: typeof vueSetup = vueSetup;
