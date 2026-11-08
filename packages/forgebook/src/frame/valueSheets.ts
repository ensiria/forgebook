/**
 * The style sheets of the switches' values (`sheet` on a value): the sheets of the values drawn, placed after the
 * source's, the switches' in the order they are declared.
 *
 * @remarks
 * Loaded only by a frame of a catalogue that has any (`mountFrame.ts`). A change keeps the old sheet in the document until
 * the new one has loaded, and says when, so the frame moves the root's attributes at the same moment and the story is
 * never drawn with neither. The reader's next choice overtakes one still loading: only the last one takes the old
 * sheets away.
 *
 * @module
 */

import { shownSwitches, type ViewSwitch } from "../switches.ts";
import type { SheetsChoice } from "../viewState.ts";

/** The address of each value's sheet, by `<switch id>=<value>`, as the generated frame gives them. */
export type ValueSheets = Readonly<Record<string, string>>;

/**
 * The addresses a view's values draw with, in order; only Styles › Full has them, since Structure and Restyled leave
 * out a theme's look.
 *
 * @param values - the switches' values, the story's fixed ones among them.
 * @param sheets - the Styles setting.
 * @param valueSheets - each value's sheet.
 * @param switches - the catalogue's switches.
 */
export const valueSheetUrls = (
  values: Readonly<Record<string, string>>,
  sheets: SheetsChoice,
  valueSheets: ValueSheets,
  switches: readonly ViewSwitch[]
): string[] => {
  if (sheets !== "full") return [];
  const shown = shownSwitches(values, switches);
  return switches.flatMap((each) => valueSheets[`${each.id}=${shown[each.id] ?? each.default}`] ?? []);
};

/** A link in the document, and whether it loaded. */
type PlacedLink = {
  readonly link: HTMLLinkElement;
  readonly isLoaded: Promise<boolean>;
};

/**
 * Puts sheets back in their order: an overtaken choice of two switches at once can leave a kept sheet on the wrong side of a
 * new one. A sheet already in place is not touched, since moving a link loads it again.
 *
 * @param head - the document's head.
 * @param end - what the sheets end before.
 * @param links - the sheets, in order.
 */
const keepOrder = (head: HTMLElement, end: Node, links: readonly HTMLLinkElement[]): void => {
  let next: Node = end;
  for (const link of links.toReversed()) {
    if (link.nextSibling !== next) head.insertBefore(link, next);
    next = link;
  }
};

/**
 * Shows the sheets of a frame's values, from now on after what the document's head holds.
 *
 * @param document - the frame's document: the source's sheets are already placed.
 * @param onFailed - told a sheet that did not load, with what to say. The frame goes on without it, and choosing the value
 * again tries again.
 * @returns what shows a list of sheets, and answers once they have settled whether it is still the last one asked.
 */
export const valueSheetsIn = (
  document: Document,
  onFailed: (message: string) => void
): ((urls: readonly string[]) => Promise<boolean>) => {
  const { head } = document;
  // what keeps the values' sheets together, whatever the frame adds to the head after them
  const end = document.createComment(" the switches' values' sheets end here ");
  head.append(end);
  const placed = new Map<string, PlacedLink>();
  let lastAsked = 0;
  const place = (url: string, before: Node): PlacedLink => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    const isLoaded = new Promise<boolean>((resolve) => {
      link.addEventListener("load", () => resolve(true));
      link.addEventListener("error", () => {
        // forgotten, so that choosing the value again asks the server again
        placed.delete(url);
        link.remove();
        onFailed(`The style sheet ${url} did not load`);
        resolve(false);
      });
    });
    head.insertBefore(link, before);
    return { link, isLoaded };
  };
  return async (urls: readonly string[]): Promise<boolean> => {
    lastAsked += 1;
    const asked = lastAsked;
    let before: Node = end;
    // last to first, each new one before the next: a sheet kept where it is keeps the switches' order
    for (const url of urls.toReversed()) {
      const each = placed.get(url) ?? place(url, before);
      placed.set(url, each);
      before = each.link;
    }
    await Promise.all(urls.map((url) => placed.get(url)?.isLoaded));
    if (asked !== lastAsked) return false;
    for (const [url, { link }] of placed) {
      if (urls.includes(url)) continue;
      link.remove();
      placed.delete(url);
    }
    keepOrder(
      head,
      end,
      urls.flatMap((url) => placed.get(url)?.link ?? [])
    );
    return true;
  };
};
