## 0.2.0 (2026-11-04)

### 🚀 Features

- **react:** run Storybook's preview hooks in a React story file ([b051e42](https://github.com/ensiria/forgebook/commit/b051e42))
- **forgebook:** let a story change its own args as the panel would ([dbccf8a](https://github.com/ensiria/forgebook/commit/dbccf8a))
- **forgebook:** notice file edits by polling with dev --poll ([3fd8a0d](https://github.com/ensiria/forgebook/commit/3fd8a0d))
- **forgebook:** let the frame take a renderer that only draws ([71fdd40](https://github.com/ensiria/forgebook/commit/71fdd40))
- **forgebook:** open every prop group, leaving the folding to the reader ([d4fa79c](https://github.com/ensiria/forgebook/commit/d4fa79c))
- **forgebook:** list props by their TSDoc group, and an object prop's members ([f3d0003](https://github.com/ensiria/forgebook/commit/f3d0003))
- **forgebook:** draw an edited story file or preview in place ([9e8e643](https://github.com/ensiria/forgebook/commit/9e8e643))
- **forgebook:** keep answers on disk with the paths they were read from ([dd46223](https://github.com/ensiria/forgebook/commit/dd46223))
- ⚠️  **story-format:** let a source load each language's texts when shown ([22fcb19](https://github.com/ensiria/forgebook/commit/22fcb19))
- **forgebook:** place the stories' frames from the command line ([dc0fab8](https://github.com/ensiria/forgebook/commit/dc0fab8))
- **forgebook:** export the core's path functions to adapters ([8c232d3](https://github.com/ensiria/forgebook/commit/8c232d3))
- **forgebook:** carry Storybook's React Native options over in init ([de88021](https://github.com/ensiria/forgebook/commit/de88021))
- **forgebook:** read React Native projects in init --from storybook ([faedefe](https://github.com/ensiria/forgebook/commit/faedefe))
- **angular:** add the Angular and Analog adapter ([87c9db7](https://github.com/ensiria/forgebook/commit/87c9db7))
- **forgebook:** name a component by its selector, and read Angular's Storybook ([d447928](https://github.com/ensiria/forgebook/commit/d447928))
- **nuxt:** add the Nuxt adapter ([0eccae1](https://github.com/ensiria/forgebook/commit/0eccae1))
- **sveltekit:** add the SvelteKit adapter ([12af331](https://github.com/ensiria/forgebook/commit/12af331))
- **nextjs:** draw a Next.js project's components outside Next.js ([48a171a](https://github.com/ensiria/forgebook/commit/48a171a))
- **forgebook:** read Next.js projects in init --from storybook ([17b3019](https://github.com/ensiria/forgebook/commit/17b3019))
- **forgebook:** list a framework's calls among a story's events ([9d8da0b](https://github.com/ensiria/forgebook/commit/9d8da0b))
- ⚠️  **forgebook:** run the stories' frames on an origin of their own ([f53f3fe](https://github.com/ensiria/forgebook/commit/f53f3fe))
- **forgebook:** list a framework's own calls among a story's events ([604ba20](https://github.com/ensiria/forgebook/commit/604ba20))
- **forgebook:** list a framework's own calls among a story's events ([f70bac9](https://github.com/ensiria/forgebook/commit/f70bac9))
- **html:** add the plain HTML adapter ([ebedf7a](https://github.com/ensiria/forgebook/commit/ebedf7a))
- read Storybook's plain HTML stories in init ([3fd9f4e](https://github.com/ensiria/forgebook/commit/3fd9f4e))
- let a framework keep a shared link's markup from its stories ([15c9429](https://github.com/ensiria/forgebook/commit/15c9429))
- give the device frame its own control, and touch in a device ([133c00f](https://github.com/ensiria/forgebook/commit/133c00f))
- ⚠️  show a story in a drawn device frame ([fdb94e4](https://github.com/ensiria/forgebook/commit/fdb94e4))
- **forgebook:** add docs blocks and a home authors can write ([07675a9](https://github.com/ensiria/forgebook/commit/07675a9))
- **svelte:** add the Svelte 5 adapter ([e78ffae](https://github.com/ensiria/forgebook/commit/e78ffae))
- read a framework's own component files as TypeScript ([44e5de3](https://github.com/ensiria/forgebook/commit/44e5de3))
- **web-components:** add the Web Components adapter ([3707036](https://github.com/ensiria/forgebook/commit/3707036))
- read Storybook's Web Components stories in init ([31d6696](https://github.com/ensiria/forgebook/commit/31d6696))
- **solid:** add the Solid adapter ([fd09f57](https://github.com/ensiria/forgebook/commit/fd09f57))
- share JSX code and function components' docs between adapters ([343d10a](https://github.com/ensiria/forgebook/commit/343d10a))
- ⚠️  **forgebook:** draw a component's page for its audience ([c58b72a](https://github.com/ensiria/forgebook/commit/c58b72a))
- **forgebook:** search docs pages, props and descriptions ([b39a045](https://github.com/ensiria/forgebook/commit/b39a045))
- settle the plugin API after review, and draw docs blocks ([1ac34a4](https://github.com/ensiria/forgebook/commit/1ac34a4))
- add a plugin API, with Figma and MSW as its first plugins ([614b48a](https://github.com/ensiria/forgebook/commit/614b48a))
- open the framework contract beyond React ([350056c](https://github.com/ensiria/forgebook/commit/350056c))
- **shell:** embed a story and turn the branding off ([5d1d8da](https://github.com/ensiria/forgebook/commit/5d1d8da))
- **forgebook:** show a story inline in clients that render MCP Apps ([f16f28b](https://github.com/ensiria/forgebook/commit/f16f28b))
- **forgebook:** add docs pages with live stories ([bac3b59](https://github.com/ensiria/forgebook/commit/bac3b59))
- link components to Figma, with a Design tab and a comparison ([91d3f63](https://github.com/ensiria/forgebook/commit/91d3f63))
- **forgebook:** read tokens from sources, and list them in CATALOG.md ([47e6740](https://github.com/ensiria/forgebook/commit/47e6740))
- **forgebook:** let a model judge what axe cannot see ([fb8c28c](https://github.com/ensiria/forgebook/commit/fb8c28c))
- **forgebook:** compare a story's pictures with stored baselines ([883e41d](https://github.com/ensiria/forgebook/commit/883e41d))
- **forgebook:** let agents read a built catalogue with no server ([0e791a5](https://github.com/ensiria/forgebook/commit/0e791a5))
- **forgebook:** theme the shell from a library's design tokens ([7147693](https://github.com/ensiria/forgebook/commit/7147693))
- **testing:** name a modal that loses the keyboard ([36cdbbb](https://github.com/ensiria/forgebook/commit/36cdbbb))
- **forgebook:** check what a change adds against the design system ([01757cf](https://github.com/ensiria/forgebook/commit/01757cf))
- **testing:** check a real page of the application ([3d32884](https://github.com/ensiria/forgebook/commit/3d32884))
- **forgebook:** check the stories a change touches ([1e2ee90](https://github.com/ensiria/forgebook/commit/1e2ee90))
- **forgebook:** read design tokens and tell agents what to write ([b72ae02](https://github.com/ensiria/forgebook/commit/b72ae02))
- **forgebook:** let a story mock its API with MSW ([0359ddd](https://github.com/ensiria/forgebook/commit/0359ddd))
- **forgebook:** find a component by what it is for ([577c692](https://github.com/ensiria/forgebook/commit/577c692))
- **forgebook:** read when to use a component from its TSDoc ([59e7bfa](https://github.com/ensiria/forgebook/commit/59e7bfa))
- **forgebook:** give a catalogue a preview for every pull request ([2384b77](https://github.com/ensiria/forgebook/commit/2384b77))
- **forgebook:** let the shell follow the story's colour scheme ([40ced9f](https://github.com/ensiria/forgebook/commit/40ced9f))
- **forgebook:** let a catalogue give the shell its own look ([0e42bf8](https://github.com/ensiria/forgebook/commit/0e42bf8))
- **forgebook:** write the agent skill where every agent looks ([acea819](https://github.com/ensiria/forgebook/commit/acea819))
- **forgebook:** Forgebook's own mark ([6c745bc](https://github.com/ensiria/forgebook/commit/6c745bc))

### 🩹 Fixes

- **forgebook:** write a slash in generated code as a Unicode escape ([7a0f6ef](https://github.com/ensiria/forgebook/commit/7a0f6ef))
- **forgebook:** keep the previews' accepted files as plain JSON ([7634871](https://github.com/ensiria/forgebook/commit/7634871))
- **forgebook:** write values into generated code as escaped literals ([535ca0e](https://github.com/ensiria/forgebook/commit/535ca0e))
- **forgebook:** load a component page's demo through the frame queue ([ce1a18d](https://github.com/ensiria/forgebook/commit/ce1a18d))
- **forgebook:** type a placeholder's proxy as its class target ([9fe3a77](https://github.com/ensiria/forgebook/commit/9fe3a77))
- **forgebook:** let a preview compose the addons it cannot load ([8b4be4d](https://github.com/ensiria/forgebook/commit/8b4be4d))
- **shell:** show a play's trace while the component's docs load ([66d53c9](https://github.com/ensiria/forgebook/commit/66d53c9))
- **forgebook:** safer links in pages, and plugin fences in the home's index ([d5d6667](https://github.com/ensiria/forgebook/commit/d5d6667))
- **shell:** load an audience's tokens and usage with its sections ([840c31a](https://github.com/ensiria/forgebook/commit/840c31a))
- **forgebook:** keep a call of a browser-only package's export on the server ([d190c78](https://github.com/ensiria/forgebook/commit/d190c78))
- **forgebook:** read a preview's args on the server past its browser-only packages ([d554028](https://github.com/ensiria/forgebook/commit/d554028))
- check a page's stories on the frames' origin, and keep paths out of tokens ([396ba2c](https://github.com/ensiria/forgebook/commit/396ba2c))
- **forgebook:** leave every other runtime's conditions out of the server's ([c06ed51](https://github.com/ensiria/forgebook/commit/c06ed51))
- **forgebook:** resolve packages on the server under the pages' conditions ([425c89f](https://github.com/ensiria/forgebook/commit/425c89f))
- **forgebook:** end a story file's leading line comment at any line terminator ([0446115](https://github.com/ensiria/forgebook/commit/0446115))
- **forgebook:** keep a story file's JSX pragmas ahead of the hot-update code ([3c4126c](https://github.com/ensiria/forgebook/commit/3c4126c))
- draw a plugin's story frame in the device, and keep embeds unframed ([34b9f61](https://github.com/ensiria/forgebook/commit/34b9f61))
- renew a story's mocks in place, and log each frame's own requests ([ea08850](https://github.com/ensiria/forgebook/commit/ea08850))
- **forgebook:** tell an edited story file in Vite's path form on Windows ([e9db59a](https://github.com/ensiria/forgebook/commit/e9db59a))
- **forgebook:** stamp code changed within a clock tick by its text ([2a9a523](https://github.com/ensiria/forgebook/commit/2a9a523))
- **forgebook:** settle kept answers on every file system's clock ([d948232](https://github.com/ensiria/forgebook/commit/d948232))
- **forgebook:** add a loose story file to its program in TypeScript's form ([632f92c](https://github.com/ensiria/forgebook/commit/632f92c))
- **forgebook:** show, and load again, a frame whose code fails before it starts ([57c12b4](https://github.com/ensiria/forgebook/commit/57c12b4))
- **forgebook:** answer tools when a preview cannot load on Node ([9aff94b](https://github.com/ensiria/forgebook/commit/9aff94b))
- **forgebook:** leave dependencies out of story globs ([7a41f0f](https://github.com/ensiria/forgebook/commit/7a41f0f))
- **forgebook:** read a preview's named exports and the globals it starts from ([99ad9c6](https://github.com/ensiria/forgebook/commit/99ad9c6))
- **forgebook:** read a .js story file that holds JSX ([73a07ec](https://github.com/ensiria/forgebook/commit/73a07ec))
- **shell:** keep the Code tab's place while a story's code loads ([8a511e9](https://github.com/ensiria/forgebook/commit/8a511e9))
- **shell:** keep an embed's address to plain texts for HTML stories ([7b3ea57](https://github.com/ensiria/forgebook/commit/7b3ea57))
- **forgebook:** keep a story's mocks running when it is drawn again ([6328922](https://github.com/ensiria/forgebook/commit/6328922))
- **shell:** keep a tab whose module fails to load from losing the page ([63783aa](https://github.com/ensiria/forgebook/commit/63783aa))
- **forgebook:** keep a command's dev server off the dev server's cache ([d616a08](https://github.com/ensiria/forgebook/commit/d616a08))
- **forgebook:** trim an id's hyphens without a pattern anchored at its end ([7c6f58d](https://github.com/ensiria/forgebook/commit/7c6f58d))
- ⚠️  **forgebook:** give stories Storybook's ids, and merge files with one title ([05e19ad](https://github.com/ensiria/forgebook/commit/05e19ad))
- **forgebook:** read props through the configuration that holds the story ([b4ab2b5](https://github.com/ensiria/forgebook/commit/b4ab2b5))
- **forgebook:** list every export of a story file, as Storybook's indexer does ([350c260](https://github.com/ensiria/forgebook/commit/350c260))
- **forgebook:** name every Storybook React Native option init leaves out ([3f9da1a](https://github.com/ensiria/forgebook/commit/3f9da1a))
- **nuxt:** act on the two reviews of the Nuxt adapter ([e9e625f](https://github.com/ensiria/forgebook/commit/e9e625f))
- **forgebook:** name a framework's call report onEvent, and read a Next.js app's folder ([720800e](https://github.com/ensiria/forgebook/commit/720800e))
- draw a story in a device inside its safe areas ([bc83792](https://github.com/ensiria/forgebook/commit/bc83792))
- keep device and orientation free for a catalogue's own switches ([1e0cffd](https://github.com/ensiria/forgebook/commit/1e0cffd))
- keep the width control as wide as before beside the device toggle ([7baf8a7](https://github.com/ensiria/forgebook/commit/7baf8a7))
- **forgebook:** docs blocks and the written home after review ([4ce05f6](https://github.com/ensiria/forgebook/commit/4ce05f6))
- **forgebook:** check a shared link's args against the story ([1615cd1](https://github.com/ensiria/forgebook/commit/1615cd1))
- **forgebook:** keep a network path's slashes and a key helper private ([68d80bc](https://github.com/ensiria/forgebook/commit/68d80bc))
- **vite:** warm no docs program in a test run ([de77df5](https://github.com/ensiria/forgebook/commit/de77df5))
- **forgebook:** meet TypeScript's file names in Used in on Windows ([ab67700](https://github.com/ensiria/forgebook/commit/ab67700))
- **forgebook:** read story paths with Windows separators in the commands ([f7c4f48](https://github.com/ensiria/forgebook/commit/f7c4f48))
- **forgebook:** name the plugin's modules as Vite does on Windows ([25bcf7f](https://github.com/ensiria/forgebook/commit/25bcf7f))
- **forgebook:** answer each frame from its own story's mocks ([5bc0322](https://github.com/ensiria/forgebook/commit/5bc0322))
- keep plugin code out of the first load, and bound a mount's wait ([ae84cf9](https://github.com/ensiria/forgebook/commit/ae84cf9))
- **forgebook:** harden docs pages after review ([0feface](https://github.com/ensiria/forgebook/commit/0feface))
- **forgebook:** harden the inline preview after review ([97e3701](https://github.com/ensiria/forgebook/commit/97e3701))
- **forgebook:** read the commit a change starts from as a commit ([eae42d9](https://github.com/ensiria/forgebook/commit/eae42d9))
- **forgebook:** read a project with no tsconfig with one program ([a3293b1](https://github.com/ensiria/forgebook/commit/a3293b1))

### 🔥 Performance

- **forgebook:** hear an edit of the files at work without FSEvents' wait ([c730490](https://github.com/ensiria/forgebook/commit/c730490))
- **forgebook:** read a build's story texts while the stories load ([33315b2](https://github.com/ensiria/forgebook/commit/33315b2))
- **forgebook:** ship the plugins' view code only with plugins that have views ([00387f7](https://github.com/ensiria/forgebook/commit/00387f7))
- **forgebook:** write each story file's key once in its group's module ([ab1fa00](https://github.com/ensiria/forgebook/commit/ab1fa00))
- **forgebook:** write a build's story docs, code and pages as data ([a1b9ee1](https://github.com/ensiria/forgebook/commit/a1b9ee1))
- **forgebook:** load the texts of the shell's later parts with them ([24e76e5](https://github.com/ensiria/forgebook/commit/24e76e5))
- **forgebook:** read "Used in"'s usage with the component page ([9aef628](https://github.com/ensiria/forgebook/commit/9aef628))
- **forgebook:** draw the backdrop pictures in the frame alone ([05e53b7](https://github.com/ensiria/forgebook/commit/05e53b7))
- **forgebook:** keep the search's anchors apart from the docs pages' code ([7d1bb5a](https://github.com/ensiria/forgebook/commit/7d1bb5a))
- load the clock's controls and a dropped-args note when shown ([7800411](https://github.com/ensiria/forgebook/commit/7800411))
- load the compare view's cells the first time a view is compared ([d2ffd8f](https://github.com/ensiria/forgebook/commit/d2ffd8f))
- **forgebook:** load the code colouring only for a render to colour ([bf383dc](https://github.com/ensiria/forgebook/commit/bf383dc))
- **forgebook:** name a build's scripts once, and keep "Used in" gzipped ([7f277b9](https://github.com/ensiria/forgebook/commit/7f277b9))
- **forgebook:** load axe as a script, gzipped in a build ([41aef20](https://github.com/ensiria/forgebook/commit/41aef20))
- **forgebook:** build the dev server while the child pre-bundles ([75e97ec](https://github.com/ensiria/forgebook/commit/75e97ec))
- **forgebook:** end a dev server's docs worker when left idle ([b03cc73](https://github.com/ensiria/forgebook/commit/b03cc73))
- **forgebook:** pre-bundle a first start in a process of its own ([3659e88](https://github.com/ensiria/forgebook/commit/3659e88))
- **forgebook:** scan the previews for what to pre-bundle ([18f582f](https://github.com/ensiria/forgebook/commit/18f582f))
- **forgebook:** read a group's usage once when asked twice at once ([7bae10a](https://github.com/ensiria/forgebook/commit/7bae10a))
- **forgebook:** remember the file system's answers in a build ([5699d4a](https://github.com/ensiria/forgebook/commit/5699d4a))
- **forgebook:** read "Used in" one configuration at a time ([f84ac18](https://github.com/ensiria/forgebook/commit/f84ac18))
- **forgebook:** pack "Used in" and read what stories reach apart ([a6a9a32](https://github.com/ensiria/forgebook/commit/a6a9a32))
- **forgebook:** start the docs worker early on a first start only ([36ec283](https://github.com/ensiria/forgebook/commit/36ec283))
- **forgebook:** answer a later start's docs, code and index from the disk ([96f7b17](https://github.com/ensiria/forgebook/commit/96f7b17))
- **forgebook:** read a dev server's docs as asked, with a small young generation ([46aa9e3](https://github.com/ensiria/forgebook/commit/46aa9e3))
- **forgebook:** keep the docs' TypeScript programs small ([0ce4914](https://github.com/ensiria/forgebook/commit/0ce4914))
- **forgebook:** start the command with Node's compile cache ([cb2540d](https://github.com/ensiria/forgebook/commit/cb2540d))
- **forgebook:** keep the compiler, highlight.js and marked off the server's start ([1274050](https://github.com/ensiria/forgebook/commit/1274050))
- **forgebook:** load the home, a component's page and a docs page when opened ([82551df](https://github.com/ensiria/forgebook/commit/82551df))
- **forgebook:** load the touch simulation and measuring tools on use ([c1f69ae](https://github.com/ensiria/forgebook/commit/c1f69ae))
- **shell:** hand the View menu's panel the toolbar's controls ([547682b](https://github.com/ensiria/forgebook/commit/547682b))
- **shell:** load the View menu's panel and the panel's tabs when opened ([1349485](https://github.com/ensiria/forgebook/commit/1349485))
- **forgebook:** check Figma links in the index, not in the pages ([4f96a20](https://github.com/ensiria/forgebook/commit/4f96a20))
- **forgebook:** keep the docs pages' helpers out of the first load ([8b61978](https://github.com/ensiria/forgebook/commit/8b61978))
- **forgebook:** colour documentation code without highlight.js ([b296ec2](https://github.com/ensiria/forgebook/commit/b296ec2))

### ⚠️  Breaking Changes

- **story-format:** let a source load each language's texts when shown  ([22fcb19](https://github.com/ensiria/forgebook/commit/22fcb19))
  StorySource.texts values may be loaders, so code that
  reads a source's texts must handle both forms; shownTexts in
  forgebook/story-texts returns a promise.
- **forgebook:** give stories Storybook's ids, and merge files with one title  ([05e19ad](https://github.com/ensiria/forgebook/commit/05e19ad))
  ids change for titles with a case change inside a word and for
  exports with digits or capitals in a row. The old ids keep working: the shell
  rewrites an address written with one, and a frame, `forgebook story`, `check`,
  `shot`, `diff` and the MCP tools take one and answer with the current id. A
  `forgebook diff` baseline or a Playwright screenshot stored under an old id is
  still the story's baseline until `forgebook shot --update` or
  `--update-snapshots` stores one under its id. Names derived from exports change
  where capitals or digits run together (`Size2X` is "Size 2 X").
- **forgebook:** run the stories' frames on an origin of their own  ([f53f3fe](https://github.com/ensiria/forgebook/commit/f53f3fe))
  `forgebook dev` opens a second port for the frames,
  so their storage, cookies and MSW's service worker live on that
  origin, and a setup that forwards one port only (a container, a
  tunnel) needs `frames: "same-origin"` or `frames.origins`.
- show a story in a drawn device frame  ([fdb94e4](https://github.com/ensiria/forgebook/commit/fdb94e4))
  device and orientation are now parameters of the
  address, so a catalogue's switch may no longer use either id. A
  catalogue with such a switch renames it, and the values its stories
  write in globals, to load.
- **forgebook:** draw a component's page for its audience  ([c58b72a](https://github.com/ensiria/forgebook/commit/c58b72a))
  `audience` is now a parameter of the address, so a switch
  may no longer take that id and a Storybook global of that name is dropped;
  `ViewState`, `ViewCatalogue` and `TreeStory` gain required fields.

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.8 (2026-11-01)

### 🚀 Features

- **forgebook:** show stories about logic by their signature ([fd0de0a](https://github.com/ensiria/forgebook/commit/fd0de0a))
- **react:** document a hook's signature, and type stories about logic ([7dd90db](https://github.com/ensiria/forgebook/commit/7dd90db))
- **testing:** test a story about logic once, without its looks ([4b9aca9](https://github.com/ensiria/forgebook/commit/4b9aca9))
- **story-format:** mark stories about logic with parameters.logic ([b27ed9e](https://github.com/ensiria/forgebook/commit/b27ed9e))

### 🩹 Fixes

- **forgebook:** logic stories from the second self-review ([604682b](https://github.com/ensiria/forgebook/commit/604682b))
- **forgebook:** logic stories from the self-review ([195c3f9](https://github.com/ensiria/forgebook/commit/195c3f9))
- **forgebook:** give the Touch switch its key, m ([0218d0f](https://github.com/ensiria/forgebook/commit/0218d0f))
- **forgebook:** answer the unmeasured heights file without a 404 ([9a71e49](https://github.com/ensiria/forgebook/commit/9a71e49))
- **forgebook:** draw every value in Compare, its default too ([6b250aa](https://github.com/ensiria/forgebook/commit/6b250aa))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.5

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.7 (2026-11-01)

### 🩹 Fixes

- **forgebook:** build style sheets with var() in pointer media rules ([affc2c9](https://github.com/ensiria/forgebook/commit/affc2c9))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.6 (2026-11-01)

### 🚀 Features

- **forgebook:** touch stories with their own Touch toggle ([e363a2e](https://github.com/ensiria/forgebook/commit/e363a2e))
- **forgebook:** show Used in only when another component uses it ([4a248c6](https://github.com/ensiria/forgebook/commit/4a248c6))

### 🩹 Fixes

- **forgebook:** the shell's direction, keys, views and spills ([76c9884](https://github.com/ensiria/forgebook/commit/76c9884))
- **forgebook:** the agent commands, init and Used in, from the self-review ([23c3765](https://github.com/ensiria/forgebook/commit/23c3765))
- **forgebook:** key story files relative to their module again ([5ebc170](https://github.com/ensiria/forgebook/commit/5ebc170))
- **forgebook:** the touch CSS rewrite's nested and negated rules ([ae6256b](https://github.com/ensiria/forgebook/commit/ae6256b))
- **forgebook:** the touch layer's lift, keyboard, stop and scroll ([92f22c2](https://github.com/ensiria/forgebook/commit/92f22c2))
- **forgebook:** keep Shift's second finger mirrored, without a jump ([17d5b1c](https://github.com/ensiria/forgebook/commit/17d5b1c))
- **forgebook:** renew the story files in a catalogue that watches no folder ([8b5cd9a](https://github.com/ensiria/forgebook/commit/8b5cd9a))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.4

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.5 (2026-10-31)

### 🚀 Features

- **forgebook:** touch, simulated in the catalogue and real in Chromium ([ad5f603](https://github.com/ensiria/forgebook/commit/ad5f603))

### 🩹 Fixes

- **testing:** key story files as the catalogue's plugin does ([ffbcc80](https://github.com/ensiria/forgebook/commit/ffbcc80))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.4 (2026-10-31)

### 🚀 Features

- **forgebook:** the catalogue's own theme, keys and named views ([43977e3](https://github.com/ensiria/forgebook/commit/43977e3))
- **forgebook:** forgebook init --from storybook ([01f32a3](https://github.com/ensiria/forgebook/commit/01f32a3))
- **forgebook:** right to left, and the worst case with its spills ([4255c7d](https://github.com/ensiria/forgebook/commit/4255c7d))
- **forgebook:** the agent's loop: instructions, check, live errors, shots ([236b51e](https://github.com/ensiria/forgebook/commit/236b51e))
- **forgebook:** Used in, on a component's page and for agents ([9cff9b8](https://github.com/ensiria/forgebook/commit/9cff9b8))
- **forgebook:** open or fill the page with any example ([a386f5a](https://github.com/ensiria/forgebook/commit/a386f5a))
- **forgebook:** fold the sidebar's groups, animated ([b3f7142](https://github.com/ensiria/forgebook/commit/b3f7142))
- **forgebook:** a toolbar each reader arranges ([f88859c](https://github.com/ensiria/forgebook/commit/f88859c))
- **forgebook:** forgebook new, a component's first stories from its props ([6925a49](https://github.com/ensiria/forgebook/commit/6925a49))
- **forgebook:** forgebook docs, with llms.txt and a story per component ([184c939](https://github.com/ensiria/forgebook/commit/184c939))

### 🩹 Fixes

- **forgebook:** show stories whose glob climbs out of the config's folder ([5bba94d](https://github.com/ensiria/forgebook/commit/5bba94d))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.3

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.3 (2026-10-31)

### 🚀 Features

- **forgebook:** forgebook mcp, the catalogue for agents ([8aa0bbe](https://github.com/ensiria/forgebook/commit/8aa0bbe))
- **forgebook:** forgebook stories and forgebook story ([5e8ae16](https://github.com/ensiria/forgebook/commit/5e8ae16))
- **forgebook:** the dev server answers tools and agents ([7a873af](https://github.com/ensiria/forgebook/commit/7a873af))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.2 (2026-10-31)

### 🩹 Fixes

- point the repository URLs at the ensiria organisation ([8d0b3e2](https://github.com/ensiria/forgebook/commit/8d0b3e2))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.2

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.1 (2026-10-31)

### 🩹 Fixes

- **forgebook:** drop internal decision ids from the published docs ([7005663](https://github.com/ensiria/forgebook/commit/7005663))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.1

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.0 (2026-10-31)

### 🚀 Features

- build the packages for npm ([089d9dc](https://github.com/Ensiria/forgebook/commit/089d9dc))
- read Storybook's story files as they are ([3f765f8](https://github.com/Ensiria/forgebook/commit/3f765f8))
- the lists a catalogue sets ([1dabfac](https://github.com/Ensiria/forgebook/commit/1dabfac))
- a catalogue made from forgebook.config.ts ([5ea09c8](https://github.com/Ensiria/forgebook/commit/5ea09c8))
- switches the catalogue declares ([8cd9cca](https://github.com/Ensiria/forgebook/commit/8cd9cca))

### 🩹 Fixes

- pack the packages with pnpm only ([46762c9](https://github.com/Ensiria/forgebook/commit/46762c9))
- depend on @ensiria/cli-kit from npm ([4a7fa3e](https://github.com/Ensiria/forgebook/commit/4a7fa3e))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta