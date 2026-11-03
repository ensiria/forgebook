/**
 * The Accessibility card's check, run in a story's frame: axe on the whole document (a story may put a menu or a
 * dialog on `body`), with the rules the generated tests use.
 *
 * @remarks
 * axe is loaded only when the card asks: a frame that is never checked never downloads it. It is loaded as a script,
 * from the address the generated page gives (`axeScript.ts`), so it passes neither through Vite's pre-bundling nor
 * through a build's minifier; a build keeps it gzipped (`.bin`), and the frame unpacks it.
 *
 * @module
 */

import type axe from "axe-core";

import type { Violation } from "../a11y.ts";
import type { A11ySettings } from "../catalogue.ts";
import { unpackedScript } from "../packedText.ts";

/**
 * Whether a value is axe: the global its script sets.
 *
 * @param value - the window's `axe`.
 */
const isAxe = (value: unknown): value is typeof axe =>
  typeof value === "object" && value !== null && "run" in value && typeof value.run === "function";

/**
 * The address a script element can load: the script's own, or a build's gzipped copy, unpacked into a blob.
 *
 * @param axeUrl - the script's address.
 */
const scriptAddress = async (axeUrl: string): Promise<string> =>
  new URL(axeUrl, document.baseURI).pathname.endsWith(".bin") ? unpackedScript(axeUrl) : axeUrl;

/**
 * Adds axe's script to the frame and waits for it to run.
 *
 * @param document - the frame's document.
 * @param axeUrl - the script's address.
 */
const addScript = async (document: Document, axeUrl: string): Promise<void> => {
  const address = await scriptAddress(axeUrl);
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = address;
      script.onload = resolve;
      // a build's copy runs from a blob, which a page's Content-Security-Policy may not allow
      script.onerror = (): void =>
        reject(
          new Error(
            address === axeUrl
              ? `${axeUrl} could not be loaded`
              : `${axeUrl} could not run: does a Content-Security-Policy leave out blob: from script-src?`
          )
        );
      document.head.append(script);
    });
  } finally {
    if (address !== axeUrl) URL.revokeObjectURL(address);
  }
};

/** The script being added to each frame's window: a second check while it loads waits for the same one. */
const loading = new WeakMap<Window, Promise<void>>();

/**
 * axe, from its script: added to the frame once, then read from the window.
 *
 * @param document - the frame's document.
 * @param axeUrl - the script's address.
 */
const loadAxe = async (document: Document, axeUrl: string): Promise<typeof axe> => {
  const view = document.defaultView;
  if (view === null) throw new Error("The frame's document has no window to check");
  const known: unknown = Reflect.get(view, "axe");
  if (isAxe(known)) return known;
  const added = loading.get(view) ?? addScript(document, axeUrl);
  loading.set(view, added);
  try {
    await added;
  } finally {
    loading.delete(view);
  }
  const loaded: unknown = Reflect.get(view, "axe");
  if (!isAxe(loaded)) throw new Error(`${axeUrl} did not set axe`);
  return loaded;
};

/**
 * The rules the document breaks now.
 *
 * @param document - the frame's document.
 * @param rules - the catalogue's accessibility rules: its tags and the rules it turns off.
 * @param axeUrl - the address of axe's script, which the generated page gives; none for a page written by hand that
 *   gives none, which cannot be checked.
 * @returns each broken rule with the elements that break it.
 */
export const checkStory = async (
  document: Document,
  rules: A11ySettings,
  axeUrl: string | undefined
): Promise<Violation[]> => {
  if (axeUrl === undefined)
    throw new Error("This frame was mounted without `axeUrl`, the address of axe's script");
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
