/**
 * The Accessibility card's check, run in a story's frame: axe on the whole document (a story may put a menu or a
 * dialog on `body`), with the rules the generated tests use.
 *
 * @remarks
 * axe is loaded only when the card asks: a frame that is never checked never downloads it.
 *
 * @module
 */

import type { Violation } from "../a11y.ts";
import type { A11ySettings } from "../catalogue.ts";

/**
 * The rules the document breaks now.
 *
 * @param document - the frame's document.
 * @param rules - the catalogue's accessibility rules: its tags and the rules it turns off.
 * @returns each broken rule with the elements that break it.
 */
export const checkStory = async (document: Document, rules: A11ySettings): Promise<Violation[]> => {
  const { default: axe } = await import("axe-core");
  const results = await axe.run(document, {
    runOnly: { type: "tag", values: [...rules.tags] },
    rules: Object.fromEntries(rules.disabledRules.map((rule) => [rule, { enabled: false }]))
  });
  return results.violations.map((violation) => ({
    id: violation.id,
    help: violation.help,
    impact: violation.impact ?? undefined,
    helpUrl: violation.helpUrl,
    targets: violation.nodes.map((node) => node.target.map(String).join(" "))
  }));
};
