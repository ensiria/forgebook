/**
 * What an application's entry files say about how it is drawn, read from their text: the global style sheets, what wraps
 * the app, the elements beside its root and what its page's head links to.
 *
 * @remarks
 * Pure: text in, names out. Regular expressions instead of a parser because the entries are TSX, Vue, Svelte, HTML and
 * JSON alike, and a name missed here costs one line less in a report the person reads, never a wrong file: only a style
 * sheet is acted on, and `projectLook.ts` checks it before it is written. A wrapper is told from a leaf by its closing tag, so a layout's
 * `<Header />` is not reported as something a story needs.
 *
 * @module
 */
/** The extensions of a style sheet Vite compiles. */
const STYLE_SHEET = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss)$/;

/**
 * Whether a path or a specifier names a style sheet: what a page or `angular.json` says is one is not taken on trust, as
 * a preview's import of it would run a script.
 *
 * @param specifier - the path or the specifier.
 */
export const isStyleSheet = (specifier: string): boolean => STYLE_SHEET.test(specifier);

/**
 * A script's lines outside block comments that start their line, so a commented-out import is not read as a live one. A
 * `/*` inside a line is left alone: it is as likely a glob in a string.
 */
const liveLines = (text: string): string => {
  let isInComment = false;
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (isInComment) isInComment = !line.includes("*/") && !line.includes("-->");
    else if (trimmed.startsWith("/*")) isInComment = !line.includes("*/");
    else if (trimmed.startsWith("<!--")) isInComment = !line.includes("-->");
    else lines.push(line);
  }
  return lines.join("\n");
};

/** A page without its comments: found by position, so an unclosed one costs one pass. */
const withoutHtmlComments = (html: string): string => {
  let kept = "";
  let position = 0;
  while (position < html.length) {
    const start = html.indexOf("<!--", position);
    if (start === -1) return kept + html.slice(position);
    kept += html.slice(position, start);
    const end = html.indexOf("-->", start + 4);
    if (end === -1) return kept;
    position = end + 3;
  }
  return kept;
};

/** A statement that only loads a module: `import "./index.css";`, at the start of a line so a comment's is left out. */
const BARE_IMPORT = /^[ \t]*import\s+["']([^"'\n]+)["']/gm;

/** The wrappers that change nothing a story needs: React's and Solid's own, and the app itself. */
const NEUTRAL_WRAPPERS = new Set([
  "App",
  "StrictMode",
  "Suspense",
  "Fragment",
  "React.StrictMode",
  "React.Suspense",
  "React.Fragment"
]);

/** What Angular's bootstrap provides that a story gets anyway or does not notice. */
const NEUTRAL_PROVIDERS = new Set([
  "provideBrowserGlobalErrorListeners",
  "provideClientHydration",
  "provideZoneChangeDetection",
  "provideZonelessChangeDetection"
]);

/**
 * The style sheets a script loads for everything it draws: `import "./x.css"`, not `import styles from "./x.module.css"`,
 * whose classes belong to that file.
 *
 * @param text - the script, or the script block of a `.svelte` or `.vue` file.
 */
export const styleSheetImports = (text: string): readonly string[] =>
  [...liveLines(text).matchAll(BARE_IMPORT)].flatMap((match) => {
    const specifier = match[1] ?? "";
    return STYLE_SHEET.test(specifier) ? [specifier] : [];
  });

/**
 * The components an entry's markup wraps the app in, in JSX or in a Svelte file: the tags that close.
 *
 * @param text - the file's text.
 */
export const markupWrappers = (text: string): readonly string[] => [
  ...new Set(
    [...text.matchAll(/<\/([A-Z][\w.]*)\s*>/g)]
      .map((match) => match[1] ?? "")
      .filter((name) => !NEUTRAL_WRAPPERS.has(name))
  )
];

/**
 * What a Vue entry installs on the app: `app.use(router)`, `createApp(App).use(createPinia())`.
 *
 * @param text - the file's text.
 */
export const vueInstalls = (text: string): readonly string[] => [
  ...new Set([...text.matchAll(/\.use\(\s*([A-Za-z_$][\w$.]*)/g)].map((match) => match[1] ?? ""))
];

/**
 * What an Angular entry or its `app.config` provides: `provideRouter(routes)`.
 *
 * @param text - the file's text.
 */
export const angularProviders = (text: string): readonly string[] => [
  ...new Set(
    [...text.matchAll(/\b(provide[A-Z]\w*)\(/g)]
      .map((match) => match[1] ?? "")
      .filter((name) => !NEUTRAL_PROVIDERS.has(name))
  )
];

/** One attribute of a tag's text. */
const attribute = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1];

/** A page's `<link>` and `<script>` tags as text. */
const tags = (html: string, name: string): readonly string[] =>
  // no `<` inside a tag, so a page full of unclosed tags stays linear
  [...html.matchAll(new RegExp(`<${name}\\b[^<>]*>`, "g"))].map((match) => match[0]);

/** Whether an address leaves the project (`https://…`, `//…`, `data:…`). */
const isRemote = (address: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(address);

/** An address fit to name in a report: a web address, with nothing a sentence could hide in it. */
const isWebAddress = (address: string): boolean => /^(?:https?:)?\/\/[^\s<>"'`]+$/i.test(address);

/** What a page's HTML says. */
export type PageFacts = {
  /** The local scripts it starts, as written. */
  readonly scripts: readonly string[];
  /** The local style sheets it links, as written. */
  readonly styleSheets: readonly string[];
  /** The remote addresses its links load (a font's, a CDN's style sheet). */
  readonly remoteLinks: readonly string[];
  /** The ids in its body. */
  readonly bodyIds: readonly string[];
};

/**
 * The ids in a page's body, or in all of a text that has none (a layout's markup with no `<body>` of its own).
 *
 * @param html - the page or the markup.
 */
export const bodyIds = (html: string): readonly string[] => {
  const start = html.search(/<body\b/i);
  const ids = [...(start === -1 ? html : html.slice(start)).matchAll(/\bid=["']([\w-]+)["']/g)];
  return ids.map((match) => match[1] ?? "");
};

/**
 * What a page's HTML says about the app it starts.
 *
 * @param html - the page.
 */
export const pageFacts = (page: string): PageFacts => {
  const html = withoutHtmlComments(page);
  const links = tags(html, "link");
  const addresses = links.flatMap((tag) => {
    const href = attribute(tag, "href");
    return href === undefined ? [] : [{ href, rel: attribute(tag, "rel") ?? "" }];
  });
  return {
    scripts: tags(html, "script").flatMap((tag) => {
      const source = attribute(tag, "src");
      return source === undefined || isRemote(source) ? [] : [source];
    }),
    styleSheets: addresses.flatMap(({ href, rel }) =>
      rel === "stylesheet" && !isRemote(href) ? [href] : []
    ),
    remoteLinks: addresses.flatMap(({ href, rel }) =>
      isWebAddress(href) && (rel === "stylesheet" || rel === "preload") ? [href] : []
    ),
    bodyIds: bodyIds(html)
  };
};

/**
 * The global style sheets of an Angular project: the first project's build `styles` in `angular.json`, those that are
 * injected only. The builder's option is the one place Angular names them.
 *
 * @param parsed - `angular.json`, parsed.
 */
export const angularStyles = (parsed: unknown): readonly string[] => {
  const projects = recordAt(parsed, "projects");
  const all = Object.values(projects ?? {});
  // a workspace may list a library first: the app's styles are the ones its stories miss
  const project = all.find((each) => recordField(each, "projectType") === "application") ?? all[0];
  const targets = recordAt(project, "architect") ?? recordAt(project, "targets");
  const styles = recordAt(recordAt(targets, "build"), "options")?.["styles"];
  if (!Array.isArray(styles)) return [];
  return styles.flatMap((style: unknown) => {
    if (typeof style === "string") return [style];
    const input = recordAt({ style }, "style");
    return input?.["inject"] !== false && typeof input?.["input"] === "string" ? [input["input"]] : [];
  });
};

/** A field of a value, whatever it holds. */
const recordField = (value: unknown, name: string): unknown =>
  typeof value === "object" && value !== null
    ? Object.entries(value).find(([key]) => key === name)?.[1]
    : undefined;

/** A field of a value, when both are plain objects. */
const recordAt = (value: unknown, name: string): Readonly<Record<string, unknown>> | undefined => {
  if (typeof value !== "object" || value === null || !(name in value)) return undefined;
  const field: unknown = Object.entries(value).find(([key]) => key === name)?.[1];
  if (typeof field !== "object" || field === null || Array.isArray(field)) return undefined;
  return Object.fromEntries(Object.entries(field));
};
