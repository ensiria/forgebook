/**
 * HTML a package wrote as Markdown, rendered by the catalogue's plugin at build time: a component's documentation
 * file, a source's introduction on the home.
 *
 * @module
 */
import type { ReactNode } from "react";

/**
 * The package's HTML, as trusted as its stories' code: it comes from the package's own files, read at build time.
 *
 * @param props - the element's class and the HTML.
 */
export const PackageHtml = ({
  className,
  html
}: {
  readonly className: string;
  readonly html: string;
}): ReactNode => {
  // biome-ignore lint/style/useNamingConvention: React's own name for markup set as HTML
  const markup = { __html: html };
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the package's own Markdown, rendered by the plugin
  return <div className={className} dangerouslySetInnerHTML={markup} />;
};
