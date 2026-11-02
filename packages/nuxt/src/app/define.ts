/**
 * Nuxt's `define…` helpers in a catalogue: each returns what it is given, as Nuxt's do once its compiler has read them,
 * so a component, a plugin or the app config written with one loads as it is.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */
import { defineComponent } from "vue";

/** A component written with Nuxt's helper: Vue's `defineComponent`, since its `asyncData` option is Nuxt 2's. */
export const defineNuxtComponent: typeof defineComponent = defineComponent;

/**
 * A plugin: the plugin itself, since a story runs none.
 *
 * @param plugin - the plugin.
 */
export const defineNuxtPlugin = <TPlugin>(plugin: TPlugin): TPlugin => plugin;

/**
 * A payload plugin: the plugin itself, since a story runs none.
 *
 * @param plugin - the plugin.
 */
export const definePayloadPlugin = <TPlugin>(plugin: TPlugin): TPlugin => plugin;

/**
 * The app config, as `app.config.ts` writes it: the config itself.
 *
 * @param config - the config.
 */
export const defineAppConfig = <TConfig>(config: TConfig): TConfig => config;
