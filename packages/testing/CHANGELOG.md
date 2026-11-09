## 0.2.7 (2026-11-09)

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.3.2
- Updated forgebook to 0.4.2

## 0.2.6 (2026-11-09)

### 🚀 Features

- **testing:** make a story's missing static file a warning ([8fa0cc14](https://github.com/ensiria/forgebook/commit/8fa0cc14))

### 🩹 Fixes

- **testing:** name the file a story could not load in its problem ([b1b5046f](https://github.com/ensiria/forgebook/commit/b1b5046f))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.3.1
- Updated forgebook to 0.4.1

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.5 (2026-11-08)

### 🚀 Features

- **forgebook:** try a story's states nobody wrote, with no story written ([bc6edcb9](https://github.com/ensiria/forgebook/commit/bc6edcb9))
- **forgebook:** prove a pull request's states from CI, with nothing stored ([67c87151](https://github.com/ensiria/forgebook/commit/67c87151))
- **forgebook:** set up a project's coding agents with init ([784cdd96](https://github.com/ensiria/forgebook/commit/784cdd96))
- **forgebook:** wait for what a story loads before a frame says ready ([a730e02f](https://github.com/ensiria/forgebook/commit/a730e02f))
- ⚠️  **forgebook:** make verify unable to pass on nothing ([05478180](https://github.com/ensiria/forgebook/commit/05478180))

### 🩹 Fixes

- **testing:** wait for a frame whose root a reload took away ([5c901d27](https://github.com/ensiria/forgebook/commit/5c901d27))
- **testing:** retry a failed story test twice in CI ([b198624d](https://github.com/ensiria/forgebook/commit/b198624d))
- **forgebook:** keep other projects' browsers when installing one ([0fb62b7b](https://github.com/ensiria/forgebook/commit/0fb62b7b))
- **testing:** keep Vite a dependency, and say what a plugin's view needs ([9e140371](https://github.com/ensiria/forgebook/commit/9e140371))
- **forgebook:** bring Forgebook's own Vite and React ([56dca767](https://github.com/ensiria/forgebook/commit/56dca767))
- **testing:** remove a model address's trailing slashes without a pattern ([986900a9](https://github.com/ensiria/forgebook/commit/986900a9))
- **forgebook:** keep the catalogue drawing past a broken story file ([4bd1ab5b](https://github.com/ensiria/forgebook/commit/4bd1ab5b))

### ⚠️  Breaking Changes

- **forgebook:** make verify unable to pass on nothing  ([05478180](https://github.com/ensiria/forgebook/commit/05478180))
  verify exits non-zero on a changed UI file with no story
  that ran, and its JSON is schema 2: verdict, summary, skipped, base,
  variants, uiFiles, storyCount, ran, failures, code. reports is gone.

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.3.0
- Updated forgebook to 0.4.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.4 (2026-11-06)

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.4
- Updated forgebook to 0.3.3

## 0.2.3 (2026-11-05)

### 🩹 Fixes

- **forgebook:** require a Vite with the server.fs fixes ([f40739a](https://github.com/ensiria/forgebook/commit/f40739a))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.3
- Updated forgebook to 0.3.2

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.2 (2026-11-05)

### 🩹 Fixes

- **forgebook:** answer a client before the project's modules are read ([275bbb5](https://github.com/ensiria/forgebook/commit/275bbb5))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.2
- Updated forgebook to 0.3.1

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.1 (2026-11-05)

### 🚀 Features

- **forgebook:** let a catalogue turn off its accessibility check and component docs ([62d841b](https://github.com/ensiria/forgebook/commit/62d841b))
- ⚠️  **forgebook:** leave story files out with ! patterns ([0c2aad6](https://github.com/ensiria/forgebook/commit/0c2aad6))
- **forgebook:** list a component's required props first ([f6ab928](https://github.com/ensiria/forgebook/commit/f6ab928))

### ⚠️  Breaking Changes

- **forgebook:** leave story files out with ! patterns  ([0c2aad6](https://github.com/ensiria/forgebook/commit/0c2aad6))
  forgebook/vite/story-files-module takes a group's patterns as
  a list: storyFilesGroupText, indexedStoryFiles, storyFilesModule and
  storyFilesCode take `readonly string[]`, StoryFilesGroup has `patterns` in
  place of `pattern`, and IndexedStoryFile names the `pattern` that lists it.

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.1
- Updated forgebook to 0.3.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.0 (2026-11-04)

### 🚀 Features

- ⚠️  **story-format:** let a source load each language's texts when shown ([22fcb19](https://github.com/ensiria/forgebook/commit/22fcb19))
- **angular:** add the Angular and Analog adapter ([87c9db7](https://github.com/ensiria/forgebook/commit/87c9db7))
- **html:** add the plain HTML adapter ([ebedf7a](https://github.com/ensiria/forgebook/commit/ebedf7a))
- ⚠️  show a story in a drawn device frame ([fdb94e4](https://github.com/ensiria/forgebook/commit/fdb94e4))
- read a framework's own component files as TypeScript ([44e5de3](https://github.com/ensiria/forgebook/commit/44e5de3))
- **web-components:** add the Web Components adapter ([3707036](https://github.com/ensiria/forgebook/commit/3707036))
- share JSX code and function components' docs between adapters ([343d10a](https://github.com/ensiria/forgebook/commit/343d10a))
- ⚠️  **forgebook:** draw a component's page for its audience ([c58b72a](https://github.com/ensiria/forgebook/commit/c58b72a))
- open the framework contract beyond React ([350056c](https://github.com/ensiria/forgebook/commit/350056c))
- link components to Figma, with a Design tab and a comparison ([91d3f63](https://github.com/ensiria/forgebook/commit/91d3f63))
- **forgebook:** let a model judge what axe cannot see ([fb8c28c](https://github.com/ensiria/forgebook/commit/fb8c28c))
- **forgebook:** compare a story's pictures with stored baselines ([883e41d](https://github.com/ensiria/forgebook/commit/883e41d))
- **testing:** give every framework adapter one suite to pass ([e43e4b8](https://github.com/ensiria/forgebook/commit/e43e4b8))
- **testing:** name a modal that loses the keyboard ([36cdbbb](https://github.com/ensiria/forgebook/commit/36cdbbb))
- **testing:** check a real page of the application ([3d32884](https://github.com/ensiria/forgebook/commit/3d32884))

### 🩹 Fixes

- **forgebook:** write values into generated code as escaped literals ([535ca0e](https://github.com/ensiria/forgebook/commit/535ca0e))
- **forgebook:** read a preview's named exports and the globals it starts from ([99ad9c6](https://github.com/ensiria/forgebook/commit/99ad9c6))
- **testing:** give the conformance suite's docs test a program's time ([6cffa3e](https://github.com/ensiria/forgebook/commit/6cffa3e))
- ⚠️  **forgebook:** give stories Storybook's ids, and merge files with one title ([05e19ad](https://github.com/ensiria/forgebook/commit/05e19ad))
- draw a story in a device inside its safe areas ([bc83792](https://github.com/ensiria/forgebook/commit/bc83792))
- keep device and orientation free for a catalogue's own switches ([1e0cffd](https://github.com/ensiria/forgebook/commit/1e0cffd))
- **solid:** report an error once, and never call a story that threw drawn ([f09cdae](https://github.com/ensiria/forgebook/commit/f09cdae))
- **testing:** quote the config's path in the frame server's command ([44992e4](https://github.com/ensiria/forgebook/commit/44992e4))
- **testing:** keep a picture's name quick on a long run of hyphens ([84ea199](https://github.com/ensiria/forgebook/commit/84ea199))

### 🔥 Performance

- **react:** leave React's server renderer out of the frame page ([db0c81b](https://github.com/ensiria/forgebook/commit/db0c81b))

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
- Updated forgebook to 0.2.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.9 (2026-11-01)

### 🚀 Features

- **testing:** test a story about logic once, without its looks ([4b9aca9](https://github.com/ensiria/forgebook/commit/4b9aca9))

### 🩹 Fixes

- **forgebook:** logic stories from the self-review ([195c3f9](https://github.com/ensiria/forgebook/commit/195c3f9))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.5
- Updated forgebook to 0.1.8

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.8 (2026-11-01)

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.7

## 0.1.7 (2026-11-01)

### 🩹 Fixes

- **forgebook:** key story files relative to their module again ([5ebc170](https://github.com/ensiria/forgebook/commit/5ebc170))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.4
- Updated forgebook to 0.1.6

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.6 (2026-10-31)

### 🚀 Features

- **forgebook:** touch, simulated in the catalogue and real in Chromium ([ad5f603](https://github.com/ensiria/forgebook/commit/ad5f603))

### 🩹 Fixes

- **testing:** key story files as the catalogue's plugin does ([ffbcc80](https://github.com/ensiria/forgebook/commit/ffbcc80))

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.5

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.5 (2026-10-31)

### 🚀 Features

- **forgebook:** right to left, and the worst case with its spills ([4255c7d](https://github.com/ensiria/forgebook/commit/4255c7d))
- **testing:** checks as problems, and check and shot runs for the CLI ([fc33305](https://github.com/ensiria/forgebook/commit/fc33305))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.3
- Updated forgebook to 0.1.4

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.4 (2026-10-31)

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.3

## 0.1.3 (2026-10-31)

### 🩹 Fixes

- **testing:** start the frame page with the package manager in use ([44a61bb](https://github.com/ensiria/forgebook/commit/44a61bb))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.2 (2026-10-31)

### 🩹 Fixes

- point the repository URLs at the ensiria organisation ([8d0b3e2](https://github.com/ensiria/forgebook/commit/8d0b3e2))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.2
- Updated forgebook to 0.1.2

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.1 (2026-10-31)

### 🩹 Fixes

- **testing:** drop internal decision ids from the published docs ([5b789db](https://github.com/ensiria/forgebook/commit/5b789db))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.1
- Updated forgebook to 0.1.1

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
- Updated forgebook to 0.1.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta