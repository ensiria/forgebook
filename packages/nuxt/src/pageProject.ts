/**
 * The project the page knows, as the plugin writes it: in a catalogue, the plugin answers this module with the
 * project's own (its routes, config and components, `nuxtPlugin.ts`); anywhere else it is an empty project.
 *
 * Internal: the code the plugin writes imports it (the renderer reads it); a story never imports this module, whose exports may change in any release.
 *
 * @module
 */
import { EMPTY_PROJECT, type NuxtProject } from "./project.ts";

/** The project the page knows: replaced by the project's own in a catalogue. */
export const project: NuxtProject = EMPTY_PROJECT;
