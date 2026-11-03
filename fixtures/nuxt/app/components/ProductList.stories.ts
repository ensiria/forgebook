/**
 * The shop's products in a story: `useFetch` answered by MSW, or given by the story under its URL.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/nuxt";
import { HttpResponse, http } from "msw";

import ProductList from "./ProductList.vue";

export default { title: "Shop/ProductList", component: ProductList } satisfies Meta<typeof ProductList>;

/** The products the request gets, from the story's MSW handler. */
export const FromRequest: Story<typeof ProductList> = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/products", () =>
          HttpResponse.json([
            { id: 1, name: "Anvil", cents: 12900 },
            { id: 2, name: "Hammer", cents: 2450 }
          ])
        )
      ]
    }
  },
  play: async ({ canvas }) => {
    await canvas.findByText("Anvil: €129.00");
  }
};

/** The products the story gives `useFetch` under its URL, the runtime config's API base before it. */
export const FromStoryData: Story<typeof ProductList> = {
  parameters: { nuxt: { data: { "/api/products": [{ id: 3, name: "Tongs", cents: 1500 }] } } }
};

/** Another API base, from the story's runtime config. */
export const OtherApi: Story<typeof ProductList> = {
  parameters: {
    nuxt: {
      runtimeConfig: { public: { apiBase: "/v2" } },
      data: { "/v2/products": [{ id: 4, name: "Bellows", cents: 8000 }] }
    }
  }
};
