/**
 * `next/head` in a catalogue: the tags a component gives `Head` go to the frame's `<head>`, as Next.js puts them in
 * the page's.
 *
 * @remarks
 * Next.js's own `Head` needs the head manager its app creates; a portal into the frame's head does the same for one
 * story. Its server render (the generated tests) draws nothing, since there is no document to put the tags in.
 *
 * @module
 */
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Next.js's `Head`.
 *
 * @param props - the tags.
 */
const Head = ({ children }: { readonly children?: ReactNode }): ReactNode =>
  typeof document === "undefined" ? null : createPortal(children, document.head);

export default Head;
