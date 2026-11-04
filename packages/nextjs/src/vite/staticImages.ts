/**
 * Images imported as Next.js imports them: `import hero from "./hero.png"` is `{ src, width, height, blurDataURL }`,
 * so `<Image src={hero} placeholder="blur" />` has its size and its placeholder as in the app.
 *
 * @remarks
 * Only a script's import is changed: a style sheet's `url()` and an import with a query (`?url`, `?raw`, an SVG as a
 * component) stay Vite's. The placeholder is the image itself, since a story has no image server to make the small
 * blurred copy Next.js makes; it shows the same, a moment later.
 *
 * @module
 */
import { readFile } from "node:fs/promises";

import { codeLiteral } from "forgebook/code-literal";
import type { Plugin } from "vite";

import { imageSize } from "./imageSize.ts";

/** The images Next.js imports as objects. */
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svg)$/i;

/** A module that imports as a script: the project's code and its stories. */
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

/** The prefix of an image's module id. */
const IMAGE_PREFIX = "\0forgebook-next-image:";

/**
 * The plugin that turns an image's import into Next.js's object.
 *
 * @returns the plugin.
 */
export const staticImages = (): Plugin => ({
  name: "forgebook:next-static-images",
  enforce: "pre",
  resolveId: {
    filter: { id: IMAGE_FILE },
    async handler(source: string, importer: string | undefined): Promise<string | undefined> {
      const importerFile = importer?.split("?")[0];
      if (importerFile === undefined || !SCRIPT_FILE.test(importerFile) || importer?.startsWith(IMAGE_PREFIX))
        return undefined;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (resolved === null || resolved.external === true || resolved.id.includes("?")) return undefined;
      return `${IMAGE_PREFIX}${resolved.id}`;
    }
  },
  load: {
    filter: { id: new RegExp(`^${IMAGE_PREFIX}`) },
    async handler(id: string): Promise<string | undefined> {
      const file = id.slice(IMAGE_PREFIX.length);
      this.addWatchFile(file);
      const size = imageSize(new Uint8Array(await readFile(file)));
      if (size === undefined)
        this.warn(`${file}: its size could not be read, so next/image needs one written`);
      const fields = [
        "src",
        ...(size === undefined ? [] : [`width: ${size.width}`, `height: ${size.height}`]),
        // Next.js gives no placeholder for an SVG or an animated GIF either
        ...(/\.(svg|gif)$/i.test(file) ? [] : ["blurDataURL: src"])
      ];
      return `import src from ${codeLiteral(`${file}?url`)};\nexport default { ${fields.join(", ")} };\n`;
    }
  }
});
