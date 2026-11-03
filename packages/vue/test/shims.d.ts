/**
 * Single-file components, as plain `tsc` sees them: their own types need `vue-tsc`, which the fixture catalogue runs.
 *
 * @module
 */
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  /** The component. */
  const component: DefineComponent;
  // biome-ignore lint/style/noDefaultExport: a single-file component is its file's default export
  export default component;
}
