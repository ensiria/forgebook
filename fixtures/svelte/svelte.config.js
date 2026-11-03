/**
 * Svelte's options for the fixture, read by Svelte's Vite plugin: `await` in a component, so a story shows the frame
 * waits for what a component awaits.
 *
 * @module
 */
export default { compilerOptions: { experimental: { async: true } } };
