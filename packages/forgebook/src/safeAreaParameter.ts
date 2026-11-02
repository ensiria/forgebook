/**
 * The safe areas a story drawn edge to edge in a device is told, in its frame's address: the parameter that carries
 * them (`forgebook.safe-area=59,0,34,0`, top, right, bottom and left in CSS px) and the custom properties the frame
 * writes from it on its root, which such a story pads itself with.
 *
 * @remarks
 * A page in a frame cannot be given `env(safe-area-inset-*)`: browsers keep them at zero there, and only a browser's
 * own protocol can change them. So the frame writes `--forgebook-safe-area-top`, `-right`, `-bottom` and `-left`
 * instead, and a story reads them with the real insets as the fallback, for the page it ships in:
 * `padding-top: var(--forgebook-safe-area-top, env(safe-area-inset-top))`. A story that is not drawn edge to edge
 * sits inside the safe area and is told nothing. Read by the frame, written by the shell and `forgebook shot`, so
 * every side reads one format. Pure.
 *
 * @module
 */

/** The frame's address parameter of the safe areas. */
export const SAFE_AREA_PARAMETER = "forgebook.safe-area";

/** The sides of the safe areas, in the parameter's order and the custom properties' names. */
const SIDES = ["top", "right", "bottom", "left"] as const;

/** The safe areas on each side, in CSS px. */
export type SafeArea = Readonly<Record<(typeof SIDES)[number], number>>;

/**
 * A frame's address with the safe areas a story drawn edge to edge is told.
 *
 * @param address - the frame's address.
 * @param safeArea - the safe areas.
 */
export const withSafeArea = (address: string, safeArea: SafeArea): string => {
  const value = SIDES.map((side) => String(Math.round(safeArea[side]))).join(",");
  return `${address}${address.includes("?") ? "&" : "?"}${SAFE_AREA_PARAMETER}=${value}`;
};

/**
 * The custom properties a frame's address asks for: none when it carries no safe areas, or carries them wrongly.
 *
 * @param search - the frame's query.
 */
export const safeAreaProperties = (search: string): readonly (readonly [string, string])[] => {
  const values = (new URLSearchParams(search).get(SAFE_AREA_PARAMETER) ?? "").split(",").map(Number);
  if (values.length !== SIDES.length || values.some((value) => !Number.isFinite(value) || value < 0))
    return [];
  return SIDES.map((side, index) => [`--forgebook-safe-area-${side}`, `${values[index] ?? 0}px`]);
};
