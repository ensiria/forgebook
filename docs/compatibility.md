# Compatibility

<!-- Written by `node tools/compat/compat.mts table` from docs/compatibility.json, itself written by the compat workflow: edit tools/compat/, not this page. -->

Which versions of the tools around it each package is tested with. Every week, and when a maintainer asks, the `compat` workflow takes each line the package claims (the newest release of each major its range allows) and the tool's next prerelease (the newest dist-tag ahead of its latest release, or for React its canary), installs that version alone over the lockfile, and runs the package's tests (its conformance suite among them) and its fixture catalogue's tests and static build, where each exists: every section lists the commands its cells ran.

A version this page does not list is not tested. One marked ✗ is known to break; a prerelease that breaks is a warning of work to do, not a supported setup.

No run has written results yet: nothing below is claimed as tested. The page changes only when a result does; every run is in the repository's Actions, under `compat`.

## forgebook

Not tested yet: React, Vite.

React here is the catalogue's own interface, which every adapter's catalogue loads.

## @forgebook/react

Not tested yet: React, Vite.

## @forgebook/vue

Not tested yet: Vue, Vite.

## @forgebook/svelte

Not tested yet: Svelte, Vite.

## @forgebook/solid

Not tested yet: Solid, Vite.

## @forgebook/preact

Not tested yet: Preact, Vite.

## @forgebook/web-components

Not tested yet: Lit, Vite.

## @forgebook/html

Not tested yet: Vite.

## @forgebook/angular

Not tested yet: Angular, Vite.

## @forgebook/nextjs

Not tested yet: Next.js, Vite.

## @forgebook/nuxt

Not tested yet: Vue, vue-router, Vite.

Nuxt itself is not installed: the package gives a component what Nuxt would (auto-imports, aliases, its router and data composables), so what is tested is that on Vue, vue-router and Vite.

## @forgebook/sveltekit

Not tested yet: SvelteKit, Vite.

## @forgebook/react-native-web

Not tested yet: React Native Web, React, Vite.

