/**
 * The fixture's environment variables, declared as SvelteKit 3 declares them: `$app/env/public` gives the public one to
 * the browser, `$app/env/private` the rest to the server only.
 *
 * @module
 */
import { defineEnvVars } from "@sveltejs/kit/env";

/** The variables, by name. */
export const variables = defineEnvVars({
  PUBLIC_SITE_NAME: { public: true, static: true, description: "The name the header shows" },
  SECRET_API_TOKEN: { description: "A token only the server reads" }
});
