/**
 * The code writer of a Nuxt catalogue: Vue's template writer, since a Nuxt story is a Vue story. The shell's page
 * imports it from this package, which a Nuxt catalogue installs, rather than from `@forgebook/vue`, which it need not.
 *
 * @module
 */
import { codeOf as vueCodeOf } from "@forgebook/vue/code";
import type { StoryCodeWriter } from "forgebook/renderer";

/** Writes a story drawn from its args as a template, as Vue's adapter writes it. */
export const codeOf: StoryCodeWriter = vueCodeOf;
