/**
 * The fixture app's own Vite configuration, as a SvelteKit 3 project writes it: SvelteKit's options in its plugin, which
 * the catalogue reads from here (the version), and Svelte's (`await` in a component).
 *
 * @module
 */
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      version: { name: "1.4.0" },
      compilerOptions: { experimental: { async: true } }
    })
  ]
});
