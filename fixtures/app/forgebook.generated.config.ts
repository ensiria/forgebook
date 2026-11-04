/**
 * The fixture catalogue with its generated home: the same catalogue, its written home (`forgebook.home.md`) turned off,
 * so the shell's tests see the home every catalogue without one keeps.
 *
 * @module
 */
import { defineConfig } from "forgebook";

import config from "./forgebook.config.ts";

export default defineConfig({ ...config, home: false });
