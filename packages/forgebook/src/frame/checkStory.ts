/**
 * The Accessibility card's check, run in a story's frame: axe on the whole document (a story may put a menu or a
 * dialog on `body`), with the rules the generated tests use.
 *
 * @remarks
 * axe is loaded only when the card asks: a frame that is never checked never downloads it.
 *
 * @module
 */
import { AXE_TAGS, type Violation } from "../a11y";

/**
 * The rules the document breaks now.
 *
 * @param document - the frame's document.
 * @returns each broken rule with the elements that break it.
 */
export const checkStory = async (document: Document): Promise<Violation[]> => {
  const { default: axe } = await import("axe-core");
  const results = await axe.run(document, { runOnly: { type: "tag", values: [...AXE_TAGS] } });
  return results.violations.map((violation) => ({
    id: violation.id,
    help: violation.help,
    impact: violation.impact ?? undefined,
    helpUrl: violation.helpUrl,
    targets: violation.nodes.map((node) => node.target.map(String).join(" "))
  }));
};
