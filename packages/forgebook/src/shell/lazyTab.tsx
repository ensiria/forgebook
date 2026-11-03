/**
 * A tab of the story's panel whose module loads the first time it is drawn, with a note until it is there and the
 * reason when it cannot load.
 *
 * @remarks
 * The load is watched here rather than through a suspending component: the shell has no error boundary, and a tab
 * whose module is gone (a page left open across a new build) must cost that tab, not the whole page. Once loaded, the
 * tab draws at once wherever it is drawn again.
 *
 * @module
 */
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

import { STRINGS } from "./strings.ts";
import type { Loaded } from "./useLoaded.ts";

/** A tab's module: how to load its component, and the component once loaded. */
export type TabModule<TProps> = {
  /** Loads the tab's component. */
  readonly load: () => Promise<ComponentType<TProps>>;
  /** The component, once a load gave it. */
  loaded: ComponentType<TProps> | undefined;
};

/**
 * A tab's module, not loaded yet.
 *
 * @param load - loads the tab's component.
 */
export const tabModule = <TProps,>(load: () => Promise<ComponentType<TProps>>): TabModule<TProps> => ({
  load,
  loaded: undefined
});

/**
 * A tab's state as its module first gives it: drawn at once when an earlier tab loaded it.
 *
 * @param module - the tab's module.
 */
const initialTab = <TProps,>(module: TabModule<TProps>): Loaded<ComponentType<TProps>> =>
  module.loaded === undefined ? { status: "loading" } : { status: "ready", value: module.loaded };

/** The props of a tab drawn from its module. */
export type LazyTabProps<TProps> = {
  /** The tab's module. */
  readonly module: TabModule<TProps>;
  /** The tab's own props. */
  readonly tabProps: TProps;
};

/**
 * A tab drawn once its module is there.
 *
 * @remarks
 * The dock draws each chosen tab in the same place, so one `LazyTab` may be given another tab's module: its state is
 * that module's, never the last one's.
 *
 * @param props - the tab's module and its own props.
 */
export const LazyTab = <TProps extends object>({ module, tabProps }: LazyTabProps<TProps>): ReactNode => {
  const [state, setState] = useState(() => ({ module, tab: initialTab(module) }));
  if (state.module !== module) setState({ module, tab: initialTab(module) });
  const tab = state.module === module ? state.tab : initialTab(module);
  useEffect(() => {
    if (tab.status !== "loading") return;
    let isCurrent = true;
    module
      .load()
      .then((value) => {
        module.loaded = value;
        if (isCurrent) setState({ module, tab: { status: "ready", value } });
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          const message = error instanceof Error ? error.message : String(error);
          setState({ module, tab: { status: "error", message } });
        }
      });
    return (): void => {
      isCurrent = false;
    };
  }, [module, tab.status]);
  if (tab.status === "ready") {
    const Tab = tab.value;
    return <Tab {...tabProps} />;
  }
  if (tab.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.tabError}: {tab.message}
      </p>
    );
  }
  return <p className="forgebook-tab-note">{STRINGS.tabLoading}</p>;
};
