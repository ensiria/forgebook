/**
 * A page of the shell other than a story's (the home, a component's page, a docs page), loaded the first time it is
 * opened (`lazyModule.tsx`): most visits open a story, so their first load leaves these pages out. The workspace and
 * its header show while the page's code arrives, and the reason when it cannot, with a way to load the page again.
 *
 * @module
 */
import type { ReactNode } from "react";

import { type LazyModule, LazyView } from "./lazyModule.tsx";
import { STRINGS } from "./strings.ts";

/** The props of a page drawn from its module. */
export type LazyPageProps<TProps> = {
  /** The page's module. */
  readonly module: LazyModule<TProps>;
  /** The page's own props. */
  readonly pageProps: TProps;
  /** The workspace's header, drawn until the page draws its own. */
  readonly header: ReactNode;
};

/** Loads the page again, with the build the host serves now. */
const reload = (): void => {
  window.location.reload();
};

/**
 * A page drawn once its module is there.
 *
 * @param props - the page's module, its own props and the header.
 */
export const LazyPage = <TProps extends object>({
  module,
  pageProps,
  header
}: LazyPageProps<TProps>): ReactNode => (
  <LazyView
    module={module}
    props={pageProps}
    loading={
      <div className="forgebook-workspace" aria-busy="true">
        {header}
      </div>
    }
    failed={(message: string): ReactNode => (
      <div className="forgebook-workspace">
        {header}
        <p className="forgebook-problems" role="alert">
          {STRINGS.pageLoadError}: {message}{" "}
          {/* a page left open across a new build asks for code the host no longer has: a reload gets the new one */}
          <button type="button" className="forgebook-text-button" onClick={reload}>
            {STRINGS.pageReload}
          </button>
        </p>
      </div>
    )}
  />
);
