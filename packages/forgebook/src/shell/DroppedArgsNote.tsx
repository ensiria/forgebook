/**
 * The note above a story whose address names values it does not take. Such a link is rare, so the note's module
 * (`DroppedArgsList.tsx`) loads only when one is opened: the first screen carries this check alone.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { DroppedArgsListProps } from "./DroppedArgsList.tsx";
import { LazyView, lazyModule } from "./lazyModule.tsx";

/** The note's module, loaded for the first link that names values its story does not take. */
const DROPPED_ARGS_LIST = lazyModule(() =>
  import("./DroppedArgsList.tsx").then((module) => module.DroppedArgsList)
);

/**
 * The note; nothing when no value was left out, nor when its module cannot load.
 *
 * @param props - the values left out and the remover.
 */
export const DroppedArgsNote = (props: DroppedArgsListProps): ReactNode =>
  props.dropped.length === 0 ? null : (
    <LazyView module={DROPPED_ARGS_LIST} props={props} loading={null} failed={(): null => null} />
  );
