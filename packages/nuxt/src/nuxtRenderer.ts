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
import { createNuxtStore, type NuxtStore, setCurrentStore } from "./nuxtStore.ts";
import type { NuxtProject } from "./project.ts";

/** A story's store, and how many of its apps are mounted. */
type SharedStore = {
  /** The store. */
  readonly store: NuxtStore;
  /** The story's apps that use it: one, or a cell each in a matrix. */
  apps: number;
};

/**
 * Forgebook's renderer for a Nuxt project.
 *
 * @remarks
 * The apps of one story drawn at once (the cells of a matrix) share its store, so an event handler, which has no
 * component to find its store by, moves the same router whichever cell it is in; once the last of them is taken away,
 * the story drawn anew starts over with a store of its own.
 *
 * @param project - what the page knows of the project: its routes, config and components.
 * @returns the renderer.
 */
export const createNuxtRenderer = (project: NuxtProject): StoryRenderer => {
  const shared = new Map<string, SharedStore>();
  const storeFor = (drawing: StoryDrawing, place: "page" | "server"): SharedStore => {
    // a server render is never taken away, so each has a store of its own
    if (place === "server")
      return { store: createNuxtStore(project, drawing.story.parameters, drawing.report, place), apps: 0 };
    const id = drawing.identity.id;
    const known = shared.get(id);
    if (known !== undefined) return known;
    const created: SharedStore = {
      store: createNuxtStore(project, drawing.story.parameters, drawing.report, place),
      apps: 0
    };
    shared.set(id, created);
    return created;
  };
  return createVueRenderer({
    prepareApp: (app: App, drawing: StoryDrawing, place: "page" | "server"): void => {
      const entry = storeFor(drawing, place);
      entry.apps += 1;
      const { unmount } = app;
      app.unmount = (): void => {
        unmount();
        entry.apps -= 1;
        if (entry.apps === 0 && shared.get(drawing.identity.id) === entry) shared.delete(drawing.identity.id);
      };
      setCurrentStore(entry.store);
      entry.store.install(app);
      for (const [name, component] of Object.entries(BUILT_IN_COMPONENTS)) app.component(name, component);
      for (const [name, load] of Object.entries(project.components)) {
        const component = defineAsyncComponent(load);
        app.component(name, component);
        app.component(`Lazy${name}`, component);
      }
    }
  });
};
