/**
 * Which args fill a snippet with a text: `#name`, the snippet prop `name` drawn as that text.
 *
 * @remarks
 * A snippet is a prop like any other in Svelte 5, and a text passed to it would reach `{@render children()}` as a
 * string, which throws: an arg has to say it is a snippet's text, so the renderer can make the snippet. A story that
 * passes a snippet of its own passes it under the prop's name. Free of Svelte, since the shell's code writer reads it too
 * and the shell loads no Svelte.
 *
 * @module
 */

/** What an arg's name starts with when it fills a snippet with a text. */
export const SNIPPET_MARK = "#";

/**
 * The snippet prop an arg fills with a text.
 *
 * @param name - the arg's name.
 * @returns the snippet prop's name, or none for any other arg.
 */
export const snippetOfArg = (name: string): string | undefined =>
  name.startsWith(SNIPPET_MARK) && name.length > SNIPPET_MARK.length
    ? name.slice(SNIPPET_MARK.length)
    : undefined;
