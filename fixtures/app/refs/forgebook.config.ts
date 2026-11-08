/**
 * The fixture kit's catalogue composing another, already built: the white-label catalogue, built with its agents' index
 * and served on a host of its own by the shell's browser tests (`refs.e2e.ts`), and a second whose host has no index,
 * for the message a reader gets then.
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

import { REF_HOST_PORT } from "../shell/ports.ts";

export default defineConfig({
  framework: react(),
  title: "Kit with others",
  sources: ["@fixture/kit/stories"],
  presets: [kitPreset()],
  id: "refs",
  refs: {
    ember: { title: "Ember UI", url: `http://127.0.0.1:${REF_HOST_PORT}/` },
    gone: { title: "Gone UI", url: `http://127.0.0.1:${REF_HOST_PORT}/gone/` }
  }
});
