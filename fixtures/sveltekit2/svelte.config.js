/**
 * The fixture app's configuration, as a SvelteKit 2 project writes it: SvelteKit's options under `kit`, read by
 * SvelteKit's plugin and by the catalogue.
 *
 * @module
 */
export default {
  kit: {
    version: { name: "2.4.0" },
    alias: { $ui: "src/lib/components" }
  }
};
