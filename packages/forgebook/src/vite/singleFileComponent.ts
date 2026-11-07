/**
 * The component a `.vue`, `.svelte` or `.astro` file is, read from its text with no framework's compiler.
 *
 * @remarks
 * Every pattern here is bounded or a plain search for a marker: this reads every such file of a repository, any of which
 * may be crafted to make a pattern take minutes.
 *
 * @module
 */
import { codeKey, guidanceOfComment, nameOfFile, type ScannedComponent } from "./componentScan.ts";

/**
 * The comment that documents a single-file component: at the very top, or first thing in its script. A comment further in
 * is about a prop or a helper.
 */
const leadingComment = (text: string): string | undefined => {
  const script = text.indexOf("<script");
  const opened = script === -1 ? -1 : text.indexOf(">", script);
  for (const [from, open, close] of [
    [0, "<!--", "-->"],
    [opened + 1, "/*", "*/"]
  ] as const) {
    const start = from + (text.slice(from).length - text.slice(from).trimStart().length);
    if (from >= 0 && text.startsWith(open, start)) {
      const end = text.indexOf(close, start);
      if (end !== -1) return text.slice(start + open.length, end);
    }
  }
  return undefined;
};

/** A text without what stands between each pair of markers. */
const without = (text: string, open: string, close: string): string => {
  let out = "";
  let index = 0;
  for (let start = text.indexOf(open); start !== -1; start = text.indexOf(open, index)) {
    const end = text.indexOf(close, start);
    if (end === -1) break;
    out += text.slice(index, start);
    index = end + close.length;
  }
  return out + text.slice(index);
};

/** The markup of a single-file component: its template's, or what is left without scripts and styles. */
const markupOf = (text: string): string => {
  const [open, close] = [text.indexOf("<template"), text.lastIndexOf("</template>")];
  const opened = open === -1 ? -1 : text.indexOf(">", open);
  if (opened !== -1 && close > opened) return text.slice(opened + 1, close);
  const plain = without(without(text, "<script", "</script>"), "<style", "</style>");
  return plain.startsWith("---") ? plain.slice(plain.indexOf("---", 3) + 3) : plain;
};

/**
 * The one component of a `.vue`, `.svelte` or `.astro` file, from its text.
 *
 * @param file - its path.
 * @param text - its text.
 */
export const singleFileComponent = (file: string, text: string): ScannedComponent => {
  const markup = markupOf(text);
  const first = /<([a-zA-Z][\w.-]{0,80})([^<>]{0,2000})>/.exec(markup);
  const classes = /(?<![:\w-])class="([^"]*)"/.exec(first?.[2] ?? "")?.[1] ?? "";
  const defined = /defineProps<\{([^}]{0,5000})\}>/.exec(text)?.[1] ?? "";
  const props = [
    ...[...defined.matchAll(/(\w+)\??\s*:/g)].flatMap((match) => match[1] ?? []),
    ...[...text.matchAll(/export let (\w+)/g)].flatMap((match) => match[1] ?? [])
  ];
  const renders = [...markup.matchAll(/<([A-Z][\w.]*)/g)].flatMap((match) => match[1] ?? []);
  const comment = leadingComment(text);
  return {
    name: nameOfFile(file),
    file,
    line: 1,
    ...(first?.[1] === undefined ? {} : { root: first[1] }),
    props,
    classes: classes.split(/\s+/).filter((each) => each !== ""),
    renders: [...new Set(renders)],
    isExported: true,
    isDefault: true,
    ...guidanceOfComment(comment),
    ...codeKey(text, nameOfFile(file))
  };
};
