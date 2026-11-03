/**
 * The compare view of a story's stage, whose module (`CompareGrid.tsx`) loads the first time a view is compared: a
 * first screen seldom compares, so its code stays out of the first load.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { CompareGridProps } from "./CompareGrid.tsx";
import { LazyView, lazyModule } from "./lazyModule.tsx";
import { STRINGS } from "./strings.ts";

/** The compare view's module, loaded when a view is first compared. */
const COMPARE_GRID = lazyModule(() => import("./CompareGrid.tsx").then((module) => module.CompareGrid));

/**
 * The compare view, once its module is there.
 *
 * @param props - the story, the view, the device and the frames' reports.
 */
export const StageCompare = (props: CompareGridProps): ReactNode => (
  <LazyView
    module={COMPARE_GRID}
    props={props}
    loading={null}
    failed={(message: string): ReactNode => (
      <p className="forgebook-problems" role="alert">
        {STRINGS.compareError}: {message}
      </p>
    )}
  />
);
