/**
 * Loads the Design tab the first time it opens, so a catalogue pays nothing for it until then: the dock renders a tab's
 * content only while that tab is chosen.
 *
 * @module
 */
import { type ReactNode, useEffect, useState } from "react";

import type { DesignTab, DesignTabProps } from "./DesignTab.tsx";
import { STRINGS } from "./strings.ts";
import type { Loaded } from "./useLoaded.ts";

/**
 * The Design tab, once its module is there.
 *
 * @param props - the tab's own props.
 */
export const DesignTabLoader = (props: DesignTabProps): ReactNode => {
  const [tab, setTab] = useState<Loaded<typeof DesignTab>>({ status: "loading" });
  useEffect(() => {
    let isCurrent = true;
    import("./DesignTab.tsx")
      .then((module) => {
        if (isCurrent) setTab({ status: "ready", value: module.DesignTab });
      })
      .catch((error: unknown) => {
        if (isCurrent)
          setTab({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, []);
  if (tab.status === "ready") {
    const Tab = tab.value;
    return <Tab {...props} />;
  }
  if (tab.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.designError}: {tab.message}
      </p>
    );
  }
  return <p className="forgebook-tab-note">{STRINGS.designLoading}</p>;
};
