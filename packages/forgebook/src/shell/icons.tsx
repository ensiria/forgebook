/**
 * The shell's icons: small stroke drawings, decorative (the control around each carries the name).
 *
 * @module
 */
import type { ReactNode } from "react";

/** The icons, by name. */
const PATHS = {
  sun: "M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1M8 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z",
  moon: "M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z",
  monitor: "M2 3h12v8H2zM6 14h4M8 11v3",
  contrast: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 0v12",
  sliders: "M3 4h6M12 4h1M3 8h1M7 8h6M3 12h7M13 12h0M10 2.5v3M5.5 6.5v3M11.5 10.5v3",
  chevronDown: "m4 6 4 4 4-4",
  chevronRight: "m6 4 4 4-4 4",
  compare: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
  replay: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5",
  restart: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.5H11",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  play: "M5 3.5v9l7.5-4.5Z",
  search: "M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9ZM10.5 10.5l3 3",
  panel: "M2 3h12v10H2zM2 9.5h12",
  outline: "M2.5 2.5h11v11h-11zM5 5h6v6H5z",
  grid: "M2 2h12v12H2zM6 2v12M10 2v12M2 6h12M2 10h12",
  ruler: "M2 10.5 10.5 2l3.5 3.5L5.5 14zM5 8l1.5 1.5M7 6l1 1M9 4l1.5 1.5",
  sidebar: "M2 3h12v10H2zM6 3v10",
  close: "M4 4l8 8M12 4l-8 8",
  external: "M9 2.5h4.5V7M13.5 2.5 8 8M11.5 9.5v4h-9v-9h4",
  width: "M2 4v8M14 4v8M4.5 8h7M6 6.5 4.5 8 6 9.5M10 6.5l1.5 1.5-1.5 1.5",
  device: "M5.5 1.5h5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM7.25 3.5h1.5",
  plus: "M8 3.5v9M3.5 8h9",
  minus: "M3.5 8h9",
  hash: "M6 2.5 5 13.5M11 2.5l-1 11M3 6h10.5M2.5 10H13",
  check: "m3.5 8.5 3 3 6-7",
  expand: "M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9",
  collapse: "M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14",
  grip: "M6 4h0M10 4h0M6 8h0M10 8h0M6 12h0M10 12h0",
  pin: "M6 2.5h4M7 2.5V6.5L4.5 9.5h7L9 6.5V2.5M8 9.5v4",
  eye: "M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4ZM8 6.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3Z",
  function: "M10.5 2.5c-1.6 0-2.3.9-2.6 2.6L6.6 11c-.3 1.7-1 2.5-2.6 2.5M5 6.5h5",
  info: "M8 1.75a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 0 0 0-12.5ZM8 7.25v4M8 4.9v.1",
  eyeOff: "M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4ZM8 6.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3ZM3 13 13 3"
} as const;

/** An icon's name. */
export type IconName = keyof typeof PATHS;

/**
 * One icon, 16 px by default, in the current colour.
 *
 * @param props - the icon and its size in px.
 */
export const Icon = ({ name, size = 16 }: { readonly name: IconName; readonly size?: number }): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[name]} />
  </svg>
);
