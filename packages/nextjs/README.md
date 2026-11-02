# @forgebook/nextjs

A Next.js project's components in [Forgebook](https://www.npmjs.com/package/forgebook), drawn outside Next.js:
`next/image`, `next/font`, `next/link`, both routers with a route per story, `next/headers`, and async server
components. Next.js is React, so this is React's adapter ([`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react))
with what Next.js's modules need in a browser; the catalogue stays on Vite, and Next.js's own bundler is not run.

**Requirements:** Next.js 15 or 16 · React 19 · `forgebook` · Vite 8 ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/nextjs/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/nextjs
```

```ts
// forgebook.config.ts, beside next.config
import { nextjs } from "@forgebook/nextjs/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: nextjs(), title: "Web", stories: ["{app,components}/**/*.stories.tsx"] });
```

A project on Storybook's Next.js framework (`@storybook/nextjs-vite`, or `@storybook/nextjs` on webpack) moves with
`npx forgebook init --from storybook`: it writes this configuration, and the stories keep their `parameters.nextjs`.

## A story's route and request

Both routers read one route, so a component of the App Router (`next/navigation`) or of the Pages Router
(`next/router`) draws in any story. A story says where it is, as Storybook's Next.js framework writes it, and what its
server code reads:

```tsx
import type { Meta, Story } from "@forgebook/nextjs";
import { storyRoute } from "@forgebook/nextjs/route";

import { PostPage } from "./PostPage";

export default {
  title: "Blog/Post page",
  component: PostPage,
  parameters: { nextjs: { navigation: { pathname: "/blog/hello", params: { slug: "hello" }, query: { tab: "comments" } } } }
} satisfies Meta<typeof PostPage>;

/** A reader the cookie names. */
export const ReturningReader: Story<typeof PostPage> = { parameters: { nextjs: { cookies: { reader: "Ada" } } } };
```

| `parameters.nextjs` | What it sets |
|---|---|
| `navigation` | The App Router's route: `pathname` (`usePathname`), `query` (`useSearchParams`), `params` (`useParams`), Storybook's `segments` (`useSelectedLayoutSegments`, a `[name, value]` pair also a param) |
| `router` | The Pages Router's: `pathname` as the route (`/blog/[slug]`), `asPath`, `query` (the route's params among them), `locale`, `locales`, `defaultLocale`, `isFallback`, `isPreview` |
| `headers`, `cookies`, `draftMode` | What `headers()`, `cookies()` and `draftMode()` return |
| `appDirectory` | Storybook's switch between the routers: read and not needed |

The route moves: a link clicked, a `Form` sent or a router call (`push`, `replace`, `back`) changes what the hooks
return, so a navigation's current item follows, and the frame's own address never changes. Each call is listed in the
panel's Events tab (`router.push("/about")`, `cache.revalidatePath("/blog")`, `cookies.set`), and a `play` function reads
the route and the calls with `storyRoute()`. `redirect()` and `notFound()` stop the story with what Next.js would have
done instead.

## What draws, and how

| Next.js | In a story |
|---|---|
| `next/image`, `next/legacy/image` | Next.js's own component, drawn as it is (`unoptimized`: there is no image server), or through `next.config`'s `images.loaderFile` |
| Image imports | `import hero from "./hero.png"` is `{ src, width, height, blurDataURL }`, as in Next.js |
| `next/font/google` | Downloaded once into Vite's cache and served by the catalogue, as Next.js self-hosts it; `nextjs({ googleFonts: "none" })` never asks Google, and the fallbacks show |
| `next/font/local` | The app's files, served by the catalogue |
| `next/link`, `next/form` | An anchor and a form that move the story's route |
| `next/navigation`, `next/router` | Every hook and the router, reading and moving the story's route |
| `next/headers`, `next/cache` | The story's request; revalidation recorded |
| `next/head`, `next/dynamic`, `next/script`, `next/config` | Tags in the frame's head; a lazy component the story waits for; Next.js's own `Script`; `publicRuntimeConfig` |
| Variables | `NEXT_PUBLIC_` ones (environment and `.env` files) in the page's `process.env`; `next.config`'s `env` written into the code that reads it, as Next.js does; nothing else of the environment reaches the page |
| `tsconfig.json` paths, CSS Modules, Sass, PostCSS | `@/…` resolved; CSS Modules and Sass (with `next.config`'s `sassOptions`) as Vite has them; the project's PostCSS, Tailwind CSS among it, run first |
| `server-only`, `client-only` | Empty: a story draws server code in the browser on purpose |

## Server components

An async server component is awaited before the story counts as drawn, its async children too, as the server awaits
them before it sends the page: a story can show a page, a layout or any server component with its props. What is
honestly out of reach in a browser:

- What server code reaches on a server is not there: a database, the file system, secrets. Data fetched with `fetch`
  is mocked per story with `parameters.msw` (Forgebook's MSW support); other modules need a story of the component
  that takes the data as props.
- A server action runs in the browser as the async function it is (React 19 calls a form's function action there);
  what it calls on the server is not there either. `cookies().set` and the `next/cache` calls it makes are recorded.
- There is no RSC stream: no streaming of `Suspense` boundaries from a server, no `"use cache"`, no route segment
  config, no middleware, no `generateMetadata` (a story draws a component, not a route).
- An async component created inside a client component's own render is drawn by React 19 itself, which warns about it.
- The generated server-render tests (`@forgebook/testing/server`) render synchronously, so a story with a server
  component fails there.

## Not supported

Webpack and Turbopack configuration, Babel and SWC plugins (`styled-jsx` included: a component that uses
`<style jsx>` draws without its styles), `next.config`'s `compiler` options, and anything Next.js does on its server.
Storybook's `@storybook/nextjs-vite/*.mock` modules are not provided: a story asserts on `storyRoute()` instead.

The package's `./next/*` exports are the modules the plugin resolves Next.js's to: a story imports `next/link`, never
them.

The rest is the catalogue's: [Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
