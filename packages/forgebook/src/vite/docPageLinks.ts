/**
 * A docs page's links and images: a link to another page written to its file (`./colours.md#brand`), so it also works
 * in the repository, and an image of the page's own package, both checked and written for the shell to fill.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { ASSET_SCHEME, PAGE_LINK_SCHEME } from "../docPages.ts";
import { pageSlug } from "../pageAddress.ts";
import { frontMatterOf, titleOf } from "./docMarkdown.ts";

/** Reads a linked page's text: none when it is not there. */
export type ReadPage = (file: string) => string | undefined;

/**
 * A linked page's text from the disk.
 *
 * @param file - the file.
 */
export const readLinkedFile: ReadPage = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * Whether an address is outside the page's folder: it has a scheme, or starts at the root or the page's own address.
 *
 * @param href - the address.
 */
export const isOutside = (href: string): boolean => /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(href);

/** A path as a link writes it, its escapes read: a `%` that escapes nothing is a file's own character. */
const decodedPath = (path: string): string => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/**
 * The file an address relative to a page names, and its fragment.
 *
 * @param file - the page's file.
 * @param href - the address.
 */
export const relativeTarget = (
  file: string,
  href: string
): { readonly file: string; readonly fragment: string | undefined } => {
  const [path = "", fragment] = href.split("#");
  return { file: resolve(dirname(file), decodedPath(path)), fragment };
};

/**
 * The folder of the package a file belongs to: the nearest with a `package.json`, or the file's own without one.
 *
 * @param file - the file.
 */
export const packageFolderOf = (file: string): string => {
  let folder = dirname(file);
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) return dirname(file);
    folder = parent;
  }
  return folder;
};

/**
 * Whether a page may show a file as an image: a file of its own package. A build copies an image into the catalogue
 * whatever it is, so a path that climbs out of the package would publish a file a reviewer took for a picture's name.
 *
 * @param file - the page's file.
 * @param image - the image's file.
 */
export const isOwnImage = (file: string, image: string): boolean => {
  const fromPackage = relative(packageFolderOf(file), image);
  return !fromPackage.startsWith("..") && existsSync(image) && statSync(image).isFile();
};

/**
 * Whether a link names another page by its file.
 *
 * @param href - the link's address.
 */
export const isPageLink = (href: string): boolean => !isOutside(href) && /\.md(#|$)/i.test(href);

/**
 * The slug of the page a link names; none when its file is not there.
 *
 * @param file - the linking page's file.
 * @param href - the link's address.
 * @param read - reads a linked page's text.
 */
export const linkedSlug = (file: string, href: string, read: ReadPage): string | undefined => {
  const target = relativeTarget(file, href);
  const text = read(target.file);
  return text === undefined ? undefined : pageSlug(titleOf(target.file, frontMatterOf(text)));
};

/**
 * The address the shell fills for a link to another page, by its slug; none when the file is not there.
 *
 * @param file - the linking page's file.
 * @param href - the link's address.
 * @param read - reads a linked page's text.
 */
export const pageAddress = (file: string, href: string, read: ReadPage): string | undefined => {
  const slug = linkedSlug(file, href, read);
  if (slug === undefined) return undefined;
  const { fragment } = relativeTarget(file, href);
  return `${PAGE_LINK_SCHEME}${slug}${fragment === undefined ? "" : `#${fragment}`}`;
};

/**
 * The address an image's file is written as, by its place in the page's images.
 *
 * @param place - its place.
 */
export const assetAddress = (place: number): string => `${ASSET_SCHEME}${place}`;

/**
 * The version of the package a file belongs to, from its `package.json`; none without one.
 *
 * @param file - the file.
 */
export const packageVersionOf = (file: string): string | undefined => {
  const text = readLinkedFile(join(packageFolderOf(file), "package.json"));
  if (text === undefined) return undefined;
  try {
    const manifest: unknown = JSON.parse(text);
    return typeof manifest === "object" &&
      manifest !== null &&
      "version" in manifest &&
      typeof manifest.version === "string"
      ? manifest.version
      : undefined;
  } catch {
    return undefined;
  }
};
