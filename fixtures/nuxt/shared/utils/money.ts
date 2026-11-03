/**
 * Prices, shared by the app and its server, as Nuxt 4's `shared/utils` holds them: auto-imported in both.
 *
 * @module
 */

/**
 * A price in euros, as the shop writes it.
 *
 * @param cents - the price, in cents.
 */
export const formatPrice = (cents: number): string => `€${(cents / 100).toFixed(2)}`;
