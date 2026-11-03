/**
 * The cart's button in a story: its state and cookie given by the story, a checkout recorded as a navigation.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/nuxt";
import { storyNuxt } from "@forgebook/nuxt/story";

import CartButton from "./CartButton.vue";

export default { title: "Shop/CartButton", component: CartButton } satisfies Meta<typeof CartButton>;

/** An empty cart, its currency the cookie's default. */
export const Empty: Story<typeof CartButton> = {};

/** A cart with items, in the story's currency. */
export const WithItems: Story<typeof CartButton> = {
  parameters: { nuxt: { state: { cart: 3 }, cookies: { currency: "EUR" } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add to cart (3)" }));
    await canvas.findByRole("button", { name: "Add to cart (4)" });
    await userEvent.click(canvas.getByRole("button", { name: "Checkout" }));
    await canvas.findByText("EUR");
    const { route, state } = storyNuxt();
    if (route.fullPath !== "/checkout?items=4") throw new Error(`The route is ${route.fullPath}`);
    if (state["cart"] !== 4) throw new Error(`The cart holds ${String(state["cart"])}`);
  }
};
