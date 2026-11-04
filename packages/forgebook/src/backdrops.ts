/**
 * The backdrops Forgebook draws behind a story in place of its page's colour: a checkerboard, a vivid
 * abstract picture, a light and a dark desktop-like picture, a page of content, and a catalogue's own. They show what a translucent
 * surface (a menu's or a popover's glass, its blur) does, which the page's plain colour hides.
 *
 * @remarks
 * What the shell needs of a backdrop lives here: its id, its name and the colour under its picture, which the box a
 * story waits in takes while it loads (`backdropColor`). Forgebook's own pictures are drawn by the frame alone
 * (`backdropPictures.ts`, with the style sheet that puts them behind the story), so the shell's first load carries
 * none of them. The desktop pictures are fixed whatever the theme; the page of content follows the theme, as an app's
 * page would. Pure.
 *
 * @module
 */

/** A value for each colour scheme: the light one's and the dark one's, the same when it does not follow the theme. */
export type SchemePair = {
  /** The value in the light scheme. */
  readonly light: string;
  /** The value in the dark scheme. */
  readonly dark: string;
};

/** The ids of the backdrops Forgebook draws, as the address writes them. */
export type BuiltInBackdropId = "checkerboard" | "gradient" | "lightDesktop" | "darkDesktop" | "content";

/** One of Forgebook's backdrops: the frame draws its picture (`backdropPictures.ts`). */
export type BuiltInBackdrop = {
  /** Forgebook's own. */
  readonly kind: "builtIn";
  /** Its id, as the address writes it (`checkerboard`). */
  readonly id: BuiltInBackdropId;
  /** Its name in the View menu. */
  readonly label: string;
  /** The colour under its picture, in each scheme. */
  readonly colors: SchemePair;
};

/** A catalogue's own backdrop: a colour and the CSS layers over it, in each scheme. */
export type OwnBackdrop = {
  /** The catalogue's. */
  readonly kind: "own";
  /** Its id, as the address writes it. */
  readonly id: string;
  /** Its name in the View menu. */
  readonly label: string;
  /** The colour under its layers, in each scheme. */
  readonly colors: SchemePair;
  /** Its layers, as the `background` shorthand writes them (image, position, size, repeat), top first; `none` for none. */
  readonly layers: SchemePair;
};

/** A backdrop the View menu offers. */
export type Backdrop = BuiltInBackdrop | OwnBackdrop;

/**
 * A catalogue's own backdrop, as its configuration writes it: a colour and, optionally, CSS layers over it, for the
 * light scheme and, when it differs, the dark one.
 */
export type CustomBackdrop = {
  /** Its id, as the address writes it. */
  readonly id: string;
  /** Its name in the View menu. */
  readonly label: string;
  /** Its look in the light scheme (and the dark one without `dark`). */
  readonly light: { readonly color: string; readonly layers?: string };
  /** Its look in the dark scheme; the light one by default. */
  readonly dark?: { readonly color: string; readonly layers?: string };
};

/** The colour under each of Forgebook's pictures: the page of content's follows the theme, the others' do not. */
export const BUILT_IN_COLORS: Readonly<Record<BuiltInBackdropId, SchemePair>> = {
  checkerboard: { light: "#ffffff", dark: "#ffffff" },
  gradient: { light: "#7c3aed", dark: "#7c3aed" },
  lightDesktop: { light: "#e4ecf8", dark: "#e4ecf8" },
  darkDesktop: { light: "#0d1226", dark: "#0d1226" },
  content: { light: "#ffffff", dark: "#16181d" }
};

/**
 * One of Forgebook's backdrops.
 *
 * @param id - its id.
 * @param label - its name in the View menu.
 */
const builtIn = (id: BuiltInBackdropId, label: string): BuiltInBackdrop => ({
  kind: "builtIn",
  id,
  label,
  colors: BUILT_IN_COLORS[id]
});

/** The backdrops Forgebook draws, in the View menu's order: every one but the page's own colour. */
export const BUILT_IN_BACKDROPS: readonly BuiltInBackdrop[] = [
  builtIn("checkerboard", "Checkerboard"),
  builtIn("gradient", "Vivid picture"),
  builtIn("lightDesktop", "Light desktop"),
  builtIn("darkDesktop", "Dark desktop"),
  builtIn("content", "Page of content")
];

/**
 * A catalogue's own backdrop, offered as the built-in ones are.
 *
 * @param custom - the backdrop as the configuration writes it.
 */
export const customBackdrop = (custom: CustomBackdrop): OwnBackdrop => {
  const dark = custom.dark ?? custom.light;
  return {
    kind: "own",
    id: custom.id,
    label: custom.label,
    colors: { light: custom.light.color, dark: dark.color },
    layers: { light: custom.light.layers ?? "none", dark: dark.layers ?? "none" }
  };
};

/**
 * The colour a backdrop is drawn on, which the box of a loading story waits on.
 *
 * @param backdrop - the backdrop; none for the page's own colour.
 * @param isDark - whether the story is drawn in the dark scheme (a backdrop may follow it).
 * @returns the CSS colour; none for the page's own colour.
 */
export const backdropColor = (backdrop: Backdrop | undefined, isDark: boolean): string | undefined =>
  backdrop?.colors[isDark ? "dark" : "light"];
