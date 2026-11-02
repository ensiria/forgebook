/**
 * The shape of a catalogue's theme of the shell, as its configuration writes it.
 *
 * @remarks
 * These roles are public API: renaming or removing one is a breaking change, so they are the few a library's look is
 * made of, and adding one later breaks nobody. Edges, fills and shadows stay the shell's own: they are built from these
 * on translucency, and freezing them would freeze how the shell draws a card.
 *
 * @module
 */

/** The colour roles a catalogue can set, each in both appearances. A CSS colour. */
export type ShellPalette = {
  /** The page behind everything. */
  readonly window: string;
  /** The sidebar. */
  readonly sidebar: string;
  /** Cards and panels. */
  readonly surface: string;
  /** Lines between sections. */
  readonly separator: string;
  /** A row under the pointer. */
  readonly hover: string;
  /** The main text. */
  readonly text: string;
  /** Secondary text. */
  readonly "text-secondary": string;
  /** The quietest text. */
  readonly "text-tertiary": string;
  /** The accent: selection, checked controls and the keyboard's focus ring. */
  readonly accent: string;
  /** The accent as text. */
  readonly "accent-text": string;
  /** Errors, as text. */
  readonly "danger-text": string;
  /** Keywords in code. */
  readonly "code-keyword": string;
  /** Types in code. */
  readonly "code-type": string;
  /** Strings in code. */
  readonly "code-string": string;
  /** Numbers in code. */
  readonly "code-number": string;
  /** Punctuation in code. */
  readonly "code-punctuation": string;
  /** Names in code. */
  readonly "code-name": string;
};

/** The fonts of the shell: a CSS `font-family` value. */
export type ShellFonts = {
  /** The interface. */
  readonly sans?: string;
  /** Code. */
  readonly mono?: string;
};

/** The corners of the shell: a CSS length. */
export type ShellRadius = {
  /** Buttons, fields and rows. */
  readonly control?: string;
  /** Cards and panels. */
  readonly card?: string;
};

/** A theme of the shell; everything left out keeps the shell's own. */
export type ShellTheme = {
  /** Colours of the light appearance. */
  readonly light?: Partial<ShellPalette>;
  /** Colours of the dark appearance. */
  readonly dark?: Partial<ShellPalette>;
  /**
   * Roles taken from the catalogue's design tokens (`tokens` in its configuration), by token name: each role gets the
   * token's value in both appearances, its `light` and `dark` themes first. `light` and `dark` above win over it.
   */
  readonly fromTokens?: Partial<ShellPalette>;
  /** The fonts. Forgebook ships none: a web font is loaded with `@font-face` in `css`. */
  readonly fonts?: ShellFonts;
  /** The corners. */
  readonly radius?: ShellRadius;
};

/** The shell's look, a catalogue's or a preset's. */
export type ShellOptions = {
  /** The theme: written into the shell's page at build, with no script. */
  readonly theme?: ShellTheme;
  /**
   * A style sheet loaded after the shell's: by path from the configuration's folder, absolute in a preset. An escape
   * hatch: it reaches the shell's class names, which are not public API and may change in any release.
   */
  readonly css?: string;
};
