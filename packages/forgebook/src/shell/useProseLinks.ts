/**
 * The links of a page's text, opened in place: the text is plain HTML the plugin rendered, so without this a link to
 * another page of the catalogue would reload the whole catalogue.
 *
 * @module
 */
import { type RefObject, useEffect } from "react";

/**
 * Opens the links of a page's text through the catalogue, leaving a click with a modifier to the browser.
 *
 * @param bodyRef - the element that holds the text.
 * @param openLink - opens an address; `false` when it names nothing the catalogue opens, so the browser follows it.
 */
export const useProseLinks = (
  bodyRef: RefObject<HTMLElement | null>,
  openLink: (href: string) => boolean
): void => {
  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;
    const follow = (event: MouseEvent): void => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest(".forgebook-prose a") : null;
      const href = link?.getAttribute("href");
      if (href !== null && href !== undefined && openLink(href)) event.preventDefault();
    };
    body.addEventListener("click", follow);
    return (): void => body.removeEventListener("click", follow);
  }, [bodyRef, openLink]);
};
