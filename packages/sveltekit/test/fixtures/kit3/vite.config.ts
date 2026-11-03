/**
 * A SvelteKit 3 project's configuration: SvelteKit's options in its plugin, beside another plugin of its own.
 *
 * @module
 */
import { sveltekit } from "@sveltejs/kit/vite";
import type { Plugin } from "vite";

/** A plugin of the project's own, which a catalogue keeps. */
const own: Plugin = { name: "project:own" };

export default {
  plugins: [
    sveltekit({ paths: { base: "/docs" }, version: { name: "3.0.0" }, compilerOptions: { runes: true } }),
    own
  ]
};
