/**
 * Loads a plugin view's host the first time it is needed, so a catalogue pays nothing for it until then; a host that
 * cannot load is said in place, and leaves the page standing.
 *
 * @module
 */
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

import { LATER_STRINGS } from "./laterStrings.ts";
import type { Loaded } from "./useLoaded.ts";

/**
 * A host, once its module is there.
 *
 * @param props - how it loads, and its own props.
 */
export const LazyHost = <TProps extends object>({
  loadHost,
  props
}: {
  readonly loadHost: () => Promise<ComponentType<TProps>>;
  readonly props: TProps;
}): ReactNode => {
  const [host, setHost] = useState<Loaded<{ readonly component: ComponentType<TProps> }>>({
    status: "loading"
  });
  useEffect(() => {
    let isCurrent = true;
    loadHost()
      .then((component) => {
        if (isCurrent) setHost({ status: "ready", value: { component } });
      })
      .catch((error: unknown) => {
        if (isCurrent)
          setHost({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [loadHost]);
  if (host.status === "ready") {
    const Host = host.value.component;
    return <Host {...props} />;
  }
  if (host.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {LATER_STRINGS.pluginError}: {host.message}
      </p>
    );
  }
  return <p className="forgebook-tab-note">{LATER_STRINGS.pluginLoading}</p>;
};
