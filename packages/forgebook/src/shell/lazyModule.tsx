/**
 * A part of the shell whose module loads the first time it is drawn: a page other than a story's (the home, a
 * component's page, a docs page), a tab of the story's panel. What a first screen does not show stays out of the first
 * load.
 *
 * @remarks
 * The load is watched here rather than through `React.lazy` and `Suspense`, for two reasons. Once a Suspense boundary
 * has shown its fallback, React holds the content back for 300 ms so a page does not flash, which would put that delay
 * on every first visit to a page or a tab; here the content replaces its fallback the moment its code arrives. And the
 * shell has no error boundary: a module that is gone (a page left open across a new build) must cost that part, not
 * the whole page. Once loaded, the part draws at once wherever it is drawn again.
 *
 * @module
 */
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

import type { Loaded } from "./useLoaded.ts";

/** A part's module: how to load its component, and the component once loaded. */
export type LazyModule<TProps> = {
  /** Loads the part's component. */
  readonly load: () => Promise<ComponentType<TProps>>;
  /** The component, once a load gave it. */
  loaded: ComponentType<TProps> | undefined;
};

/**
 * A part's module, not loaded yet.
 *
 * @param load - loads the part's component.
 */
export const lazyModule = <TProps,>(load: () => Promise<ComponentType<TProps>>): LazyModule<TProps> => ({
  load,
  loaded: undefined
});

/**
 * A part's state as its module first gives it: drawn at once when an earlier draw loaded it.
 *
 * @param module - the part's module.
 */
const initialState = <TProps,>(module: LazyModule<TProps>): Loaded<ComponentType<TProps>> =>
  module.loaded === undefined ? { status: "loading" } : { status: "ready", value: module.loaded };

/** The props of a part drawn from its module. */
export type LazyViewProps<TProps> = {
  /** The part's module. */
  readonly module: LazyModule<TProps>;
  /** The part's own props. */
  readonly props: TProps;
  /** What is drawn while it loads. */
  readonly loading: ReactNode;
  /** What is drawn when it cannot load, from the reason. */
  readonly failed: (message: string) => ReactNode;
};

/**
 * A part drawn once its module is there.
 *
 * @remarks
 * One place may be given another part's module (the dock draws each chosen tab in the same place): its state is that
 * module's, never the last one's.
 *
 * @param props - the part's module, its own props, and what to draw until it is there.
 */
export const LazyView = <TProps extends object>({
  module,
  props,
  loading,
  failed
}: LazyViewProps<TProps>): ReactNode => {
  const [state, setState] = useState(() => ({ module, part: initialState(module) }));
  if (state.module !== module) setState({ module, part: initialState(module) });
  const part = state.module === module ? state.part : initialState(module);
  useEffect(() => {
    if (part.status !== "loading") return;
    let isCurrent = true;
    module
      .load()
      .then((value) => {
        module.loaded = value;
        if (isCurrent) setState({ module, part: { status: "ready", value } });
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          const message = error instanceof Error ? error.message : String(error);
          setState({ module, part: { status: "error", message } });
        }
      });
    return (): void => {
      isCurrent = false;
    };
  }, [module, part.status]);
  if (part.status === "ready") {
    const Part = part.value;
    return <Part {...props} />;
  }
  return part.status === "error" ? failed(part.message) : loading;
};
