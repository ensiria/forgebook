/**
 * The account page's form, enhanced by `$app/forms`: submitted to no server, the story's `forms.result` is what the
 * action answers.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/sveltekit";

import Account from "./+page.svelte";

export default {
  title: "Pages/Account",
  component: Account,
  parameters: { sveltekit: { page: { url: "/account" } } }
} satisfies Meta<typeof Account>;

/** A sign-in the action accepts. */
export const SignsIn: Story<typeof Account> = {
  parameters: {
    sveltekit: {
      forms: { result: { type: "success", status: 200, data: { message: "Signed in as ada@example.com" } } }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
  }
};

/** A sign-in the action refuses. */
export const Refused: Story<typeof Account> = {
  parameters: {
    sveltekit: {
      forms: { result: { type: "failure", status: 400, data: { message: "An email is needed" } } }
    }
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
  }
};
