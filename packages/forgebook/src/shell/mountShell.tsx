/**
 * The entry of the catalogue's page: renders the shell in an element.
 *
 * @module
 */
import "./shell.scss";

import { createRoot } from "react-dom/client";

import { Shell, type ShellConfig } from "./Shell";

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
 * @param config - the catalogue's name, its logo, its sources and its frame page.
 */
export const mountShell = (container: HTMLElement, config: ShellConfig): void => {
  if (config.logo !== undefined) setPageIcon(config.logo);
  createRoot(container).render(<Shell {...config} />);
};
