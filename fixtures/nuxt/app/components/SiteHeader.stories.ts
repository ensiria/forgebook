/**
 * The site's header in a story: the project's app and runtime config, or the story's over them.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nuxt";

import SiteHeader from "./SiteHeader.vue";

export default { title: "Layout/SiteHeader", component: SiteHeader } satisfies Meta<typeof SiteHeader>;

/** As the project configures it. */
export const Default: Story<typeof SiteHeader> = {};

/** Another site: the story's runtime and app config over the project's. */
export const OtherSite: Story<typeof SiteHeader> = {
  parameters: {
    nuxt: { runtimeConfig: { public: { siteName: "Forge Outlet" } }, appConfig: { title: "Forge Outlet" } }
  }
};
