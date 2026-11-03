/**
 * A tab of the story's panel whose module loads the first time it is drawn (`lazyModule.tsx`), with a note until it is
 * there and the reason when it cannot load.
 *
 * @module
 */
import type { ReactNode } from "react";

import { type LazyModule, LazyView } from "./lazyModule.tsx";
import { STRINGS } from "./strings.ts";

/** The props of a tab drawn from its module. */
export type LazyTabProps<TProps> = {
  /** The tab's module. */
  readonly module: LazyModule<TProps>;
  /** The tab's own props. */
  readonly tabProps: TProps;
};

/**
 * A tab drawn once its module is there.
 *
 * @param props - the tab's module and its own props.
 */
export const LazyTab = <TProps extends object>({ module, tabProps }: LazyTabProps<TProps>): ReactNode => (
  <LazyView
    module={module}
    props={tabProps}
    loading={<p className="forgebook-tab-note">{STRINGS.tabLoading}</p>}
    failed={(message: string): ReactNode => (
      <p className="forgebook-problems" role="alert">
        {STRINGS.tabError}: {message}
      </p>
    )}
  />
);
