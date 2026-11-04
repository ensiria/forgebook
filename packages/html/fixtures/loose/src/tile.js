/**
 * A tile with a text.
 *
 * @param {{ text: string, wide?: boolean }} args - what the tile shows.
 * @returns {string} the tile's HTML.
 */
export const tile = (args) => `<div class="tile${args.wide ? " tile--wide" : ""}">${args.text}</div>`;
