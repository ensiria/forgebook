/**
 * A SvelteKit 3 project's variables: one public, checked by its schema; one private.
 *
 * @module
 */
/** The variables, by name. */
export const variables = {
  PUBLIC_RETRIES: { public: true, schema: (value: string | undefined): number => Number(value ?? "1") },
  PUBLIC_TITLE: { public: true },
  SECRET_KEY: {}
};
