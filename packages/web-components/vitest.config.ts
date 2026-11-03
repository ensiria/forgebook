/**
 * The Web Components package's tests: the renderer draws stories in a simulated page.
 *
 * @module
 */
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "happy-dom" } });
