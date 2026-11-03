/**
 * The Next.js package's tests: the stand-ins and the renderer in a simulated page, the plugins' logic on its own.
 *
 * @module
 */
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "happy-dom" } });
