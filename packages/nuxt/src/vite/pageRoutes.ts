/**
 * The routes of a Nuxt project's pages, named and written as Nuxt makes them from the files: `pages/blog/[slug].vue` is
 * `/blog/:slug()`, named `blog-slug`.
 *
 * @remarks
 * Pure: paths in, routes out. A story needs a page's route to set its params and its name, so `useRoute()` returns
 * what the page would see; it draws its own component, not the page, so the routes are flat: a parent page and its
 * children are each a route with its full path, the parent left out when an `index` child takes its path. `definePageMeta`'s `path` and `name` are not
 * read: they need the page's code run.
 *
 * @module
 */
import type { ProjectRoute } from "../project.ts";

/** The extensions of a page. */
export const PAGE_EXTENSIONS = /\.(vue|tsx|jsx|ts|js|mjs)$/;

/** A piece of a segment: text, a param, an optional param or a catch-all. */
type Token =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "param" | "optional" | "catchAll"; readonly value: string };

/**
 * A segment of a page's path split into its pieces: `[slug]`, `[[slug]]`, `[...slug]` and `[[...slug]]` are params.
 *
 * @param segment - the segment (`post-[id]`).
 */
const tokensOf = (segment: string): Token[] => {
  const tokens: Token[] = [];
  const pattern = /\[\[\.\.\.([^\]]+)\]\]|\[\[([^\]]+)\]\]|\[\.\.\.([^\]]+)\]|\[([^\]]+)\]/g;
  let last = 0;
  for (const match of segment.matchAll(pattern)) {
    if (match.index > last) tokens.push({ kind: "text", value: segment.slice(last, match.index) });
    const [, optionalCatchAll, optional, catchAll, param] = match;
    if (optionalCatchAll !== undefined) tokens.push({ kind: "catchAll", value: optionalCatchAll });
    else if (optional !== undefined) tokens.push({ kind: "optional", value: optional });
    else if (catchAll !== undefined) tokens.push({ kind: "catchAll", value: catchAll });
    else if (param !== undefined) tokens.push({ kind: "param", value: param });
    last = match.index + match[0].length;
  }
  if (last < segment.length) tokens.push({ kind: "text", value: segment.slice(last) });
  return tokens;
};

/**
 * A segment as vue-router writes it: a catch-all takes the rest of the path when it ends it, else what is left of its
 * own segment, as Nuxt writes it.
 *
 * @param tokens - the segment's pieces.
 * @param isLast - whether the segment ends the path.
 */
const pathOfTokens = (tokens: readonly Token[], isLast: boolean): string =>
  tokens
    .map((token) => {
      if (token.kind === "text") return token.value;
      if (token.kind === "param") return `:${token.value}()`;
      if (token.kind === "optional") return `:${token.value}?`;
      return isLast ? `:${token.value}(.*)*` : `:${token.value}([^/]*)*`;
    })
    .join("");

/**
 * The route of a page.
 *
 * @param file - the page's path from the pages' folder, with `/` (`blog/[slug].vue`).
 * @returns its route, or none for a file Nuxt ignores (`-draft.vue`).
 */
const routeOf = (file: string): ProjectRoute | undefined => {
  const segments = file.replace(PAGE_EXTENSIONS, "").split("/");
  if (segments.some((segment) => segment.startsWith("-"))) return undefined;
  // a route group, `(admin)`, is a folder that is not part of the path or the name
  const kept = segments.filter((segment) => !/^\(.*\)$/.test(segment));
  const isIndex = kept.at(-1) === "index";
  const named = isIndex ? kept.slice(0, -1) : kept;
  const path = `/${named.map((segment, index) => pathOfTokens(tokensOf(segment), index === named.length - 1)).join("/")}`;
  const name = named.map((segment) => segment.replace(/\[\[?(\.\.\.)?|\]\]?/g, "")).join("-");
  return { path, name: name === "" ? "index" : name };
};

/**
 * The routes of a project's pages.
 *
 * @param files - the pages' paths from the pages' folder, with `/` (`blog/[slug].vue`).
 * @returns the routes; a page whose folder has an `index` page is left out, since that page carries its path and name,
 * as in Nuxt, where the parent keeps neither.
 */
export const pageRoutes = (files: readonly string[]): ProjectRoute[] => {
  const pages = files.filter((file) => PAGE_EXTENSIONS.test(file));
  const indexed = new Set(
    pages.flatMap((file) => {
      const parts = file.replace(PAGE_EXTENSIONS, "").split("/");
      return parts.length > 1 && parts.at(-1) === "index" ? [parts.slice(0, -1).join("/")] : [];
    })
  );
  const routes = new Map<string, ProjectRoute>();
  for (const file of pages) {
    if (indexed.has(file.replace(PAGE_EXTENSIONS, ""))) continue;
    const route = routeOf(file);
    if (route !== undefined && !routes.has(route.name)) routes.set(route.name, route);
  }
  return [...routes.values()];
};
