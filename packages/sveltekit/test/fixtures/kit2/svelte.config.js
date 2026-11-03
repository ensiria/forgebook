/** A SvelteKit 2 project's configuration: SvelteKit's options under `kit`, `$lib` moved, an alias of its own. */
export default {
  kit: {
    files: { lib: "src/library" },
    alias: { $ui: "src/ui", "$icons/*": "src/icons/*" },
    env: { publicPrefix: "APP_" }
  }
};
