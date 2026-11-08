/**
 * The fixture app's own Vite configuration, as a SvelteKit 2 project writes it: SvelteKit's plugin, which reads
 * `svelte.config.js`.
 *
 * @module
 */
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [sveltekit()] });
