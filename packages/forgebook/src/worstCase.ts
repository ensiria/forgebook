/**
 * The worst-case values a story can give a component: a long text with spaces, a word too long to break, scripts and
 * emoji that change a line's height and width, a huge number. One set, for the stories `forgebook new` writes and for
 * the catalogue's worst-case data, so both test the same edges.
 *
 * @module
 */

/** A text long enough to wrap several times in any box. */
export const WORST_TEXT =
  "A label long enough to wrap onto several lines in any box it is given, with words of every length in it";

/** A word with no place to break, for a box that must cut or scroll it. */
export const WORST_WORD = "Supercalifragilisticexpialidocious_with_no_place_to_break_it_at_all_1234567890";

/** Scripts and emoji that change a line's height and width. */
export const WORST_SCRIPTS = "Ünïcödé 名前 مرحبا 👩🏽‍💻";

/** A number with more digits than a box usually holds. */
export const WORST_NUMBER = 123_456_789_012;

/** The worst text: a long one, with a word that cannot break. */
export const WORST_ARG_TEXT = `${WORST_TEXT} ${WORST_WORD}`;
