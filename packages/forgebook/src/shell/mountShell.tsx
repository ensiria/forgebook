/**
 * The entry of the catalogue's page: renders the shell in an element. Called by the page the plugin generates from
 * the catalogue's configuration (`vite/pages.ts`), not by an app.
 *
 * @module
 */
import "./shell.scss";

import { createRoot } from "react-dom/client";

import type { StoryCodeWriter } from "../frame/renderer.ts";
import { CodeWriterContext } from "./codeWriter.ts";
import { Shell, type ShellConfig } from "./Shell.tsx";
import { configureStrings } from "./strings.ts";

/** What an app passes to the shell: the catalogue's configuration and the framework's code writer. */
export type MountShellConfig = ShellConfig & {
  /** Writes a story drawn from its args in the framework's code (`storyJsx` of `@forgebook/react`). */
  readonly codeOf: StoryCodeWriter;
};

/**
 * The page's icon: the catalogue's logo, replacing any the page declares.
 *
 * @param logo - the logo's URL.
 */
const setPageIcon = (logo: string): void => {
  for (const link of document.querySelectorAll('link[rel~="icon"]')) link.remove();
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = logo;
  document.head.append(icon);
};

/**
 * Shows the catalogue in the given element.
 *
 * @param container - the element the page renders into.
 * @param config - the catalogue's name, its logo, its sources, its frame page and the framework's code writer.
 */
export const mountShell = (container: HTMLElement, config: MountShellConfig): void => {
  if (config.logo !== undefined) setPageIcon(config.logo);
  configureStrings(config.lists?.strings ?? {});
  const { codeOf, ...shell } = config;
  createRoot(container).render(
    <CodeWriterContext.Provider value={codeOf}>
      <Shell {...shell} />
    </CodeWriterContext.Provider>
  );
};
