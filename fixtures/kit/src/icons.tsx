/**
 * The fixture kit's icons: a component each, drawn as a small picture with its name for a screen reader, and the
 * `IconComponent` type every prop that takes one is written with.
 *
 * @module
 */
import type { ComponentType, ReactNode } from "react";

/** What an icon takes. */
export type IconProps = {
  /** Its side, in CSS px. @defaultValue `16` */
  readonly size?: number;
};

/** An icon: a component that draws one. */
export type IconComponent = ComponentType<IconProps>;

/** What draws every icon: its name, its picture and its side. */
type GlyphProps = IconProps & {
  /** Its name, as the kit exports it, so a test can find it. */
  readonly name: string;
  /** Its picture, on a 16 by 16 grid. */
  readonly path: string;
};

/**
 * An icon drawn from one path, marked with its name.
 *
 * @param props - its name, its picture and its side.
 */
const Glyph = ({ name, path, size = 16 }: GlyphProps): ReactNode => (
  <svg
    data-icon={name}
    role="img"
    aria-label={name}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path d={path} />
  </svg>
);

/** A magnifying glass. */
export const IconSearch = (props: IconProps): ReactNode => (
  <Glyph {...props} name="IconSearch" path="M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2zm3.5 8.5L14 14" />
);

/** A star. */
export const IconStar = (props: IconProps): ReactNode => (
  <Glyph
    {...props}
    name="IconStar"
    path="M8 1.5l2 4.2 4.5.6-3.3 3.1.8 4.5L8 11.7l-4 2.2.8-4.5L1.5 6.3l4.5-.6z"
  />
);

/** A heart. */
export const IconHeart = (props: IconProps): ReactNode => (
  <Glyph {...props} name="IconHeart" path="M8 14S2 10 2 5.5A3 3 0 0 1 8 4a3 3 0 0 1 6 1.5C14 10 8 14 8 14z" />
);

/** A bell. */
export const IconBell = (props: IconProps): ReactNode => (
  <Glyph {...props} name="IconBell" path="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11zM6.5 14h3" />
);

/** A house. */
export const IconHome = (props: IconProps): ReactNode => (
  <Glyph {...props} name="IconHome" path="M2 7.5L8 2l6 5.5V14H10v-4H6v4H2z" />
);

/** A tick. */
export const IconCheck = (props: IconProps): ReactNode => (
  <Glyph {...props} name="IconCheck" path="M2.5 8.5l3.5 3.5 7.5-8" />
);

/** Every icon of the kit, by its name: what a catalogue's icon picker offers. */
export const ICONS: Readonly<Record<string, IconComponent>> = {
  IconSearch,
  IconStar,
  IconHeart,
  IconBell,
  IconHome,
  IconCheck
};
