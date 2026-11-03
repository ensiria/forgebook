/**
 * A snippet that draws a text: what a `#name` arg becomes, so a component's `{@render children()}` draws the text the
 * story or the props panel wrote.
 *
 * @remarks
 * A snippet made outside a component is a raw one, which Svelte draws from HTML and which must be one element: the text
 * sits in a `span`. Each snippet prop keeps the snippet of its text, so a story drawn again with the same text keeps what it drew,
 * and a text typed in the panel replaces the one before.
 *
 * @module
 */
import { createRawSnippet, type Snippet } from "svelte";

/**
 * Makes the snippet of a snippet prop's text, the same one while the text stays the same.
 *
 * @param prop - the snippet prop (`children`).
 * @param text - its text.
 */
export type TextSnippets = (prop: string, text: string) => Snippet;

/** A text as HTML holds it. */
const escapedText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The snippets of a story's texts, kept for as long as the story is drawn.
 *
 * @returns the function that makes a text's snippet.
 */
export const textSnippets = (): TextSnippets => {
  const kept = new Map<string, { readonly text: string; readonly snippet: Snippet }>();
  return (prop: string, text: string): Snippet => {
    const known = kept.get(prop);
    if (known?.text === text) return known.snippet;
    const snippet = createRawSnippet(() => ({ render: (): string => `<span>${escapedText(text)}</span>` }));
    kept.set(prop, { text, snippet });
    return snippet;
  };
};
