/**
 * The account page's actions: the sign-in, which answers with a message.
 *
 * @module
 */
import { fail } from "@sveltejs/kit";

import type { Actions } from "./$types";

/** The page's actions, by name. */
export const actions: Actions = {
  signIn: async ({ request }) => {
    const email = (await request.formData()).get("email");
    if (typeof email !== "string" || email === "") return fail(400, { message: "An email is needed" });
    return { message: `Signed in as ${email}` };
  }
};
