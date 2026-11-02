/**
 * The Accessibility card's check, run in a story's frame: axe on the whole document (a story may put a menu or a
 * dialog on `body`), with the rules the generated tests use.
 *
 * @remarks
 * axe is loaded only when the card asks: a frame that is never checked never downloads it. It is its own minified file,
 * loaded as a script: as a module it would pass through Vite's pre-bundling on every cold start and through the
 * minifier on every build, more than half a megabyte for a card most visits never open. Its address comes from the
 * generated page: a package's own modules are pre-bundled, where Vite cannot follow a `?url` import. A build keeps it
 * gzipped (`.bin`) and the frame unpacks it, since it would otherwise be half of what a static catalogue weighs.
 *
 * @module
 */

import type axe from "axe-core";

import type { Violation } from "../a11y.ts";
import type { A11ySettings } from "../catalogue.ts";
import { unpackedScript } from "../packedText.ts";

/** Whether a value is axe: the global its script sets. */
const isAxe = (value: unknown): value is typeof axe =>
  typeof value === "object" && value !== null && "run" in value;

/**
 * The address a script tag can load: the script's own, or a compressed script's text, unpacked.
 *
 * @param axeUrl - the script's address.
 */
const scriptAddress = async (axeUrl: string): Promise<string> =>
  axeUrl.endsWith(".bin") ? unpackedScript(axeUrl) : axeUrl;

/**
 * axe, from its script.
 *
 * @param document - the frame's document.
 * @param axeUrl - the script's address.
 */
const loadAxe = async (document: Document, axeUrl: string): Promise<typeof axe> => {
  const view = document.defaultView;
  const known = view === null ? undefined : Reflect.get(view, "axe");
  if (isAxe(known)) return known;
  const address = await scriptAddress(axeUrl);
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = address;
    script.onload = resolve;
    script.onerror = (): void => reject(new Error(`${axeUrl} could not be loaded`));
    document.head.append(script);
  });
  const loaded = view === null ? undefined : Reflect.get(view, "axe");
  if (!isAxe(loaded)) throw new Error(`${axeUrl} did not set axe`);
  return loaded;
};

/**
 * The rules the document breaks now.
 *
 * @param document - the frame's document.
 * @param rules - the catalogue's accessibility rules: its tags and the rules it turns off.
 * @param axeUrl - the address of axe's script, which the generated page imports; a page written by hand passes its own.
 * @returns each broken rule with the elements that break it.
 */
export const checkStory = async (
  document: Document,
  rules: A11ySettings,
  axeUrl: string | undefined
): Promise<Violation[]> => {
  if (axeUrl === undefined) throw new Error("This frame was mounted without `axeUrl`");
  const checker = await loadAxe(document, axeUrl);
  const results = await checker.run(document, {
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
