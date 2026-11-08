/**
 * The entry of the catalogue's page: renders the shell in an element. Called by the page the plugin generates from
 * the catalogue's configuration (`vite/pages.ts`), not by an app.
 *
 * @module
 */
import "./shell.scss";

import { createRoot, type Root } from "react-dom/client";

import { isEmbedAddress } from "../embed.ts";
import type { StoryCodeWriter } from "../frame/renderer.ts";
import { type FramesPlacement, framePageAddress, pageOrigins, SAME_ORIGIN } from "../frameOrigins.ts";
import { CodeWriterContext } from "./codeWriter.ts";
import { HAS_REFS, setShellRefs } from "./composition.ts";
import { FORGEBOOK_MARK_URL } from "./forgebookMark.ts";
import { setFramesOrigin } from "./framesOrigin.ts";
import { Shell, type ShellConfig } from "./Shell.tsx";
import { configureStrings, STRINGS } from "./strings.ts";

/** What the generated page passes to the shell: the catalogue's configuration and the framework's code writer. */
export type MountShellConfig = ShellConfig & {
  /** Writes a story drawn from its args in the framework's code (`storyJsx` of `@forgebook/react`). */
  readonly codeOf: StoryCodeWriter;
  /** Where the frames run: on the catalogue's own origin by default. */
  readonly frames?: FramesPlacement;
};

/**
 * The page's icon: the catalogue's logo, replacing any the page declares; without a logo, Forgebook's mark, unless the
 * page declares an icon of its own or the catalogue turned the branding off.
 *
 * @param logo - the logo's URL; none for Forgebook's mark.
 * @param hasBranding - whether Forgebook's mark may stand in for a logo.
 */
const setPageIcon = (logo: string | undefined, hasBranding: boolean): void => {
  const declared = document.querySelectorAll('link[rel~="icon"]');
  if (logo === undefined && (declared.length > 0 || !hasBranding)) return;
  for (const link of declared) link.remove();
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = logo ?? FORGEBOOK_MARK_URL;
  document.head.append(icon);
};

/**
 * Shows one story alone in the given element, what `?embed` asks for; the shell is not drawn at all.
 *
 * @param root - the page's root.
 * @param shell - the catalogue's configuration.
 */
const mountEmbed = (root: Root, shell: ShellConfig): void => {
  import("./EmbedPage.tsx")
    .then(({ EmbedPage }) => root.render(<EmbedPage {...shell} />))
    // a stale page after a new deployment: a text, since a blank box in someone's wiki says nothing
    .catch(() => root.render(<p role="alert">{STRINGS.embedFailed}</p>));
};

/**
 * Shows the catalogue in the given element, or one story alone when the address asks for it.
 *
 * @param container - the element the page renders into.
 * @param config - the catalogue's name, its logo, its sources, its frame page and the framework's code writer.
 */
export const mountShell = (container: HTMLElement, config: MountShellConfig): void => {
  setPageIcon(config.logo, config.hasBranding ?? true);
  configureStrings(config.lists?.strings ?? {});
  const { codeOf, frames = SAME_ORIGIN, ...page } = config;
  // set before anything renders, the embed included: its story's frame runs on the frames' origin too
  const origins = pageOrigins(frames, window.location, "catalogue");
  setFramesOrigin(origins.frames);
  if (HAS_REFS) setShellRefs(config.refs);
  const shell: ShellConfig = {
    ...page,
    frameUrl: framePageAddress(page.frameUrl, origins.frames, window.location.pathname)
  };
  const root = createRoot(container);
  if (isEmbedAddress(window.location.search)) {
    mountEmbed(root, shell);
    return;
  }
  root.render(
    <CodeWriterContext.Provider value={codeOf}>
      <Shell {...shell} />
    </CodeWriterContext.Provider>
  );
};
