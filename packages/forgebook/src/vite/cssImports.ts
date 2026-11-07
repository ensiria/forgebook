/**
 * A style sheet with the sheets it imports by relative path written into it, as Vite's own PostCSS step does before a
 * project's plugins run: Lightning CSS reads an imported file from the disk, so a plugin would never see it, and Tailwind's
 * directives in a sheet of their own would stay undone.
 *
 * @remarks
 * Only a plain `@import "./x.css"` is written in. One with a media query, a layer or a package's name stays for those that
 * read them (Tailwind 4's plugin reads its own imports). Relative addresses in a file from another folder are rewritten,
 * since they now sit in the importing sheet. A sheet that imports itself, or that cannot be read, stays as it was written.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/** A plain relative import of a style sheet, on a line of its own. */
const RELATIVE_IMPORT =
  /^[ \t]*@import\s+(?:url\()?["'](\.{1,2}\/[^"'\n]+\.(?:css|pcss|postcss))["']\)?\s*;[ \t]*$/gm;

/** A relative address in a sheet. */
const RELATIVE_URL = /url\(\s*(["']?)(?!["']?(?:[a-z][a-z0-9+.-]*:|\/|#))([^"')\s]+)\1\s*\)/gi;

/** What a sheet came to. */
export type InlinedCss = {
  /** The text. */
  readonly css: string;
  /** The files written in, absolute. */
  readonly files: readonly string[];
};

/** A sheet's text with its addresses read from another folder. */
const rebased = (css: string, from: string, to: string): string => {
  const prefix = relative(to, from).split("\\").join("/");
  return prefix === ""
    ? css
    : css.replace(RELATIVE_URL, (_, quote: string, url: string) => `url(${quote}${prefix}/${url}${quote})`);
};

/**
 * A sheet with its relative imports written in.
 *
 * @param css - its text.
 * @param file - its file, absolute.
 */
export const inlineCssImports = (css: string, file: string): InlinedCss => {
  const files: string[] = [];
  const inlined = (text: string, current: string, seen: ReadonlySet<string>): string =>
    text.replace(RELATIVE_IMPORT, (statement: string, path: string) => {
      const imported = resolve(dirname(current), path);
      if (seen.has(imported)) return statement;
      try {
        const body = readFileSync(imported, "utf8");
        files.push(imported);
        return inlined(
          rebased(body, dirname(imported), dirname(file)),
          imported,
          new Set([...seen, imported])
        );
      } catch {
        return statement;
      }
    });
  return { css: inlined(css, file, new Set([file])), files };
};
