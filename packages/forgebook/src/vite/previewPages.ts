/**
 * The two pages of a story's preview in a client that renders apps, as text: the app's own (`previewView.ts`), which the
 * MCP server gives as a resource, and the relay (`previewRelay.ts`), which the dev server serves.
 *
 * @remarks
 * Each page's script is the source of a typed function that takes no import, the way `page.evaluate` runs one, so it is
 * checked as the rest of the code is and needs no bundling step: what Node runs and what `dist` holds both print as
 * JavaScript. Loaded only when a preview is asked for.
 *
 * @module
 */
import { previewRelay } from "../previewRelay.ts";
import { PREVIEW_ELEMENTS, type PreviewViewOptions, previewView } from "../previewView.ts";

/** A value as text a script element can hold: nothing in it can close the element. */
const scriptValue = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

/** The class of a frame still loading. */
const LOADING_CLASS = "loading";

/** The app's look: the host's variables, with defaults for a host that gives none, in its appearance. */
const VIEW_STYLE = `
:root { color-scheme: light dark; }
html, body { margin: 0; }
body {
  display: flex; flex-direction: column; min-height: 0;
  color: var(--color-text-primary, CanvasText);
  background: var(--color-background-primary, Canvas);
  font: 14px/1.4 var(--font-sans, system-ui, sans-serif);
}
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; }
#${PREVIEW_ELEMENTS.title} { font-family: var(--font-mono, ui-monospace, monospace); overflow-wrap: anywhere; }
#${PREVIEW_ELEMENTS.status} { margin: 0; padding: 8px 12px; color: var(--color-text-secondary, GrayText); }
#${PREVIEW_ELEMENTS.open} {
  flex: none; padding: 4px 10px; font: inherit; color: inherit; background: transparent;
  border: 1px solid var(--color-border-primary, GrayText); border-radius: var(--border-radius-sm, 6px); cursor: pointer;
}
#${PREVIEW_ELEMENTS.open}:focus-visible { outline: 2px solid var(--color-ring-primary, Highlight); outline-offset: 2px; }
#${PREVIEW_ELEMENTS.frame} { display: block; width: 100%; height: 240px; border: 0; }
#${PREVIEW_ELEMENTS.picture} { display: block; max-width: 100%; height: auto; }
.${LOADING_CLASS} { position: absolute; top: 0; left: 0; visibility: hidden; pointer-events: none; }
[hidden] { display: none !important; }
`;

/**
 * The app's page, one HTML5 document.
 *
 * @param options - what its script is given.
 */
export const previewViewPage = (options: Omit<PreviewViewOptions, "loadingClass">): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Forgebook</title>
<style>${VIEW_STYLE}</style>
</head>
<body>
<header>
<span id="${PREVIEW_ELEMENTS.title}"></span>
<button id="${PREVIEW_ELEMENTS.open}" type="button" hidden></button>
</header>
<p id="${PREVIEW_ELEMENTS.status}" role="status"></p>
<iframe id="${PREVIEW_ELEMENTS.frame}" hidden></iframe>
<img id="${PREVIEW_ELEMENTS.picture}" alt="" hidden>
<script>(${previewView.toString()})(${scriptValue({ ...options, loadingClass: LOADING_CLASS })}, ${scriptValue(PREVIEW_ELEMENTS)});</script>
</body>
</html>
`;

/**
 * The relay's page.
 *
 * @param frameAddress - the story's frame.
 * @param title - the frame's name for a screen reader.
 */
export const previewRelayPage = (frameAddress: string, title: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Forgebook</title>
<style>html, body { margin: 0; background: transparent; }</style>
</head>
<body>
<script>(${previewRelay.toString()})(${scriptValue(frameAddress)}, ${scriptValue(title)});</script>
</body>
</html>
`;
