/**
 * The entry of the catalogue's page: renders the shell in an element. Called by the page the plugin generates from
 * the catalogue's configuration (`vite/pages.ts`), not by an app.
 *
 * @module
 */
import "./shell.scss";

import { createRoot } from "react-dom/client";

import type { StoryCodeWriter } from "../frame/renderer.ts";
import { type FramesPlacement, framePageAddress, pageOrigins, SAME_ORIGIN } from "../frameOrigins.ts";
import { CodeWriterContext } from "./codeWriter.ts";
import { FORGEBOOK_MARK_URL } from "./forgebookMark.ts";
import { setFramesOrigin } from "./framesOrigin.ts";
import { Shell, type ShellConfig } from "./Shell.tsx";
import { configureStrings } from "./strings.ts";

/** What an app passes to the shell: the catalogue's configuration and the framework's code writer. */
export type MountShellConfig = ShellConfig & {
  /** Writes a story drawn from its args in the framework's code (`storyJsx` of `@forgebook/react`). */
  readonly codeOf: StoryCodeWriter;
  /** Where the frames run: on the catalogue's own origin by default. */
  readonly frames?: FramesPlacement;
};

/**
 * The page's icon: the catalogue's logo, replacing any the page declares; without a logo, Forgebook's mark, unless the
 * page declares an icon of its own.
 *
 * @param logo - the logo's URL; none for Forgebook's mark.
 */
const setPageIcon = (logo: string | undefined): void => {
  const declared = document.querySelectorAll('link[rel~="icon"]');
  if (logo === undefined && declared.length > 0) return;
  for (const link of declared) link.remove();
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = logo ?? FORGEBOOK_MARK_URL;
  document.head.append(icon);
};

/**
 * Shows the catalogue in the given element.
 *
 * @param container - the element the page renders into.
 * @param config - the catalogue's name, its logo, its sources, its frame page and the framework's code writer.
 */
export const mountShell = (container: HTMLElement, config: MountShellConfig): void => {
  setPageIcon(config.logo);
  configureStrings(config.lists?.strings ?? {});
  const { codeOf, frames = SAME_ORIGIN, ...shell } = config;
  const origins = pageOrigins(frames, window.location, "catalogue");
  setFramesOrigin(origins.frames);
  const frameUrl = framePageAddress(shell.frameUrl, origins.frames, window.location.pathname);
  createRoot(container).render(
    <CodeWriterContext.Provider value={codeOf}>
      <Shell {...shell} frameUrl={frameUrl} />
    </CodeWriterContext.Provider>
  );
};
