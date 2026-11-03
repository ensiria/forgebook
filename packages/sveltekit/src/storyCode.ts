/**
 * The code writer of a SvelteKit catalogue: a story drawn from its args written as Svelte markup, as Svelte's catalogue
 * writes it, under this package's name, so a catalogue needs no other Forgebook package of its own.
 *
 * @module
 */
import { codeOf as svelteCodeOf } from "@forgebook/svelte/code";
import type { StoryCodeWriter } from "forgebook/renderer";

/** Writes a story drawn from its args as Svelte markup. */
export const codeOf: StoryCodeWriter = svelteCodeOf;
