/**
 * Forgebook's renderer for a Nuxt project: Vue's renderer, each story's app given its Nuxt (`nuxtStore.ts`): its router
 * at the story's route, its data, state and config, Nuxt's components and the project's.
 *
 * @remarks
 * A story's Nuxt is made when its app is, so a story drawn again with other args keeps where its links took it, and
 * one drawn anew starts over at its own route. Its calls go to the catalogue's Events tab. The project's components are
 * registered on the app too, loaded when first drawn, so a story's own template (`template: "<BaseButton />"`) finds
 * them as a Nuxt page's does; a component file finds them through the plugin, which imports what its template names.
 *
 * @module
 */
import { createVueRenderer } from "@forgebook/vue/renderer";
import type { StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { type App, defineAsyncComponent } from "vue";

import { BUILT_IN_COMPONENTS } from "./app/components.ts";
import { createNuxtStore, setCurrentStore } from "./nuxtStore.ts";
import type { NuxtProject } from "./project.ts";

/**
 * Forgebook's renderer for a Nuxt project.
 *
 * @param project - what the page knows of the project: its routes, config and components.
 * @returns the renderer.
 */
export const createNuxtRenderer = (project: NuxtProject): StoryRenderer =>
  createVueRenderer({
    prepareApp: (app: App, drawing: StoryDrawing, place: "page" | "server"): void => {
      const store = createNuxtStore(project, drawing.story.parameters, drawing.report, place);
      setCurrentStore(store);
      store.install(app);
      for (const [name, component] of Object.entries(BUILT_IN_COMPONENTS)) app.component(name, component);
      for (const [name, load] of Object.entries(project.components)) {
        const component = defineAsyncComponent(load);
        app.component(name, component);
        app.component(`Lazy${name}`, component);
      }
    }
  });
