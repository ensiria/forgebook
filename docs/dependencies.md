# Dependencies

<!-- Written by `node tools/dependencies/dependencies.mts table` from docs/dependencies.json, itself written by the dependencies workflow: edit tools/dependencies/, not this page. -->

What each published package brings into a project, and what `npm audit` says about it. Every week the `dependencies` workflow takes the version of each package npm's `latest` names, installs it alone in an empty project as `npm install <package>` would, writing only the lockfile and running no install script, counts what the lockfile holds and runs `npm audit` on it.

Results of 2026-11-08, with npm 11.9.0. The page changes only when a result does; every run is in the repository's Actions, under `dependencies`.

| Package | Version | Direct | Installed | Of which per platform | Through peers | npm audit |
|---|---|---:|---:|---:|---:|---|
| `@forgebook/angular` | `0.2.4` | 3 | 34 | 22 | 328 | none |
| `@forgebook/html` | `0.2.4` | 2 | 2 | 0 | 47 | none |
| `@forgebook/nextjs` | `0.2.4` | 2 | 4 | 0 | 94 | none |
| `@forgebook/nuxt` | `0.2.4` | 4 | 59 | 0 | 72 | none |
| `@forgebook/plugin-figma` | `0.2.4` | 1 | 1 | 0 | 48 | none |
| `@forgebook/plugin-msw` | `0.2.4` | 0 | 0 | 0 | 98 | none |
| `@forgebook/preact` | `0.2.4` | 3 | 38 | 22 | 49 | none |
| `@forgebook/react` | `0.2.4` | 2 | 3 | 0 | 47 | none |
| `@forgebook/react-native-web` | `0.2.4` | 4 | 16 | 0 | 269 | none |
| `@forgebook/solid` | `0.2.4` | 2 | 57 | 0 | 51 | none |
| `@forgebook/story-format` | `0.2.4` | 0 | 0 | 0 | 0 | none |
| `@forgebook/svelte` | `0.2.4` | 4 | 11 | 0 | 66 | 1 low |
| `@forgebook/sveltekit` | `0.2.4` | 2 | 12 | 0 | 66 | 1 low |
| `@forgebook/testing` | `0.2.4` | 3 | 4 | 0 | 69 | none |
| `@forgebook/vue` | `0.2.4` | 5 | 29 | 0 | 54 | none |
| `@forgebook/web-components` | `0.2.4` | 2 | 2 | 0 | 53 | none |
| `forgebook` | `0.3.3` | 6 | 18 | 11 | 30 | none |

- **Direct**: the dependencies the package's own `package.json` lists.
- **Installed**: every package npm adds with it, the package itself and its peers left out. Each platform's binaries count, so a machine installs fewer.
- **Of which per platform**: the optional packages among them, one per operating system and processor, of which a machine installs only its own.
- **Through peers**: what npm adds for its peer dependencies (React, Vite, a framework) when the project has none. A project that draws stories usually has them already.
- **npm audit**: the advisories in the whole tree, peers included. A fresh install resolves the newest versions the ranges allow, so `npm audit` in your own project stays the final word for it.

## Advisories

- `@forgebook/svelte`: low, [deepmerge mergeObject\(\) allows prototype poisoning of returned objects](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), in `deepmerge >=4.2.0 <=4.3.1`.
- `@forgebook/sveltekit`: low, [deepmerge mergeObject\(\) allows prototype poisoning of returned objects](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), in `deepmerge >=4.2.0 <=4.3.1`.
