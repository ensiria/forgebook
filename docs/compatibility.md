# Compatibility

<!-- Written by `node tools/compat/compat.mts table` from docs/compatibility.json, itself written by the compat workflow: edit tools/compat/, not this page. -->

Which versions of the tools around it each package is tested with. Every week, and when a maintainer asks, the `compat` workflow takes each line the package claims (the newest release of each major its range allows) and the tool's next prerelease (the newest dist-tag ahead of its latest release, or for React its canary), installs that version alone over the lockfile, and runs the package's tests (its conformance suite among them) and its fixture catalogue's tests and static build, where each exists: every section lists the commands its cells ran.

A version this page does not list is not tested. One marked ✗ is known to break; a prerelease that breaks is a warning of work to do, not a supported setup.

Results of 2026-11-08, on Node 24.22.2, [the run](https://github.com/ensiria/forgebook/actions/runs/42441596442). The page changes only when a result does; every run is in the repository's Actions, under `compat`.

## forgebook

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| React | `^18.2.0 \|\| ^19.0.0` | 18 | `18.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | 19 | `19.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | next (canary) | `19.3.0-canary-5b610964-20261106` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter forgebook test`, `pnpm --filter @fixture/app build`.

React here is the catalogue's own interface, which every adapter's catalogue loads.

## @forgebook/react

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| React | `^18.2.0 \|\| ^19.0.0` | 18 | `18.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | 19 | `19.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | next (canary) | `19.3.0-canary-5b610964-20261106` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/react test`, `pnpm --filter @fixture/app build`.

## @forgebook/vue

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Vue | `^3.5.0` | 3 | `3.5.45` | ✓ passes |
| Vue | `^3.5.0` | next (rc) | `3.6.0-rc.14` | ✗ fails (failed: pnpm --filter @forgebook/vue test; pnpm --filter @fixture/vue test) |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/vue test`, `pnpm --filter @fixture/vue test`, `pnpm --filter @fixture/vue build`.

## @forgebook/svelte

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Svelte | `^5.46.4` | 5 | `5.57.3` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/svelte test`, `pnpm --filter @fixture/svelte test`, `pnpm --filter @fixture/svelte build`.

## @forgebook/solid

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Solid | `^1.9.0` | 1 | `1.9.18` | ✓ passes |
| Solid | `^1.9.0` | next (next) | `2.0.0-rc.21` | ✗ fails (failed: pnpm --filter @forgebook/solid test; pnpm --filter @fixture/solid test; pnpm --filter @fixture/solid build) |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/solid test`, `pnpm --filter @fixture/solid test`, `pnpm --filter @fixture/solid build`.

## @forgebook/preact

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Preact | `^10.19.0 \|\| ^11.0.0` | 10 | `10.29.8` | ✓ passes |
| Preact | `^10.19.0 \|\| ^11.0.0` | 11 | `11.2.0` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/preact test`, `pnpm --filter @fixture/preact test`, `pnpm --filter @fixture/preact build`.

## @forgebook/web-components

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Lit | `^3.2.0` | 3 | `3.3.3` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/web-components test`, `pnpm --filter @fixture/web-components test`, `pnpm --filter @fixture/web-components build`.

## @forgebook/html

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/html test`, `pnpm --filter @fixture/html test`, `pnpm --filter @fixture/html build`.

## @forgebook/angular

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Angular | `^20.0.0 \|\| ^21.0.0 \|\| ^22.0.0` | 20 | `20.3.35` with `typescript 5.9.3` | ✓ passes |
| Angular | `^20.0.0 \|\| ^21.0.0 \|\| ^22.0.0` | 21 | `21.2.26` | ✓ passes |
| Angular | `^20.0.0 \|\| ^21.0.0 \|\| ^22.0.0` | 22 | `22.2.5` | ✓ passes |
| Angular | `^20.0.0 \|\| ^21.0.0 \|\| ^22.0.0` | next (next) | `22.3.0-next.4` | ✗ fails (failed: pnpm --filter @fixture/angular build) |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/angular test`, `pnpm --filter @fixture/angular test`, `pnpm --filter @fixture/angular build`.

## @forgebook/nextjs

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Next.js | `^15.0.0 \|\| ^16.0.0` | 15 | `15.5.29` | ✓ passes |
| Next.js | `^15.0.0 \|\| ^16.0.0` | 16 | `16.4.5` | ✓ passes |
| Next.js | `^15.0.0 \|\| ^16.0.0` | next (canary) | `16.5.0-canary.44` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/nextjs test`, `pnpm --filter @fixture/nextjs test`, `pnpm --filter @fixture/nextjs build`.

## @forgebook/nuxt

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| Vue | `^3.5.0` | 3 | `3.5.45` | ✓ passes |
| Vue | `^3.5.0` | next (rc) | `3.6.0-rc.14` | ✗ fails (failed: pnpm --filter @forgebook/nuxt test; pnpm --filter @fixture/nuxt test) |
| vue-router | `^4.5.0 \|\| ^5.0.0` | 4 | `4.6.4` | ✓ passes |
| vue-router | `^4.5.0 \|\| ^5.0.0` | 5 | `5.4.0` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/nuxt test`, `pnpm --filter @fixture/nuxt test`, `pnpm --filter @fixture/nuxt build`.

Nuxt itself is not installed: the package gives a component what Nuxt would (auto-imports, aliases, its router and data composables), so what is tested is that on Vue, vue-router and Vite.

## @forgebook/sveltekit

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| SvelteKit | `^2.0.0 \|\| ^3.0.0` | 2 | `2.70.4` | ✓ passes |
| SvelteKit | `^2.0.0 \|\| ^3.0.0` | 3 | `3.1.1` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

The SvelteKit 2 cell runs `pnpm --filter @forgebook/sveltekit test`, `pnpm --filter @fixture/sveltekit2 test`, `pnpm --filter @fixture/sveltekit2 build`.

Every other cell runs `pnpm --filter @forgebook/sveltekit test`, `pnpm --filter @fixture/sveltekit test`, `pnpm --filter @fixture/sveltekit build`.

## @forgebook/react-native-web

| Tool | Range it claims | Line | Version tested | Result |
|---|---|---|---|---|
| React Native Web | `^0.21.0` | 0.21 | `0.21.4` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | 18 | `18.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | 19 | `19.3.1` | ✓ passes |
| React | `^18.2.0 \|\| ^19.0.0` | next (canary) | `19.3.0-canary-5b610964-20261106` | ✓ passes |
| Vite | `^8.3.4` | 8 | `8.3.6` | ✓ passes |

Each cell runs `pnpm --filter @forgebook/react-native-web test`, `pnpm --filter @fixture/react-native build`.

