## 0.2.6 (2026-11-09)

### 🚀 Features

- **forgebook:** let presets register controls matched by prop type ([3d3fb973](https://github.com/ensiria/forgebook/commit/3d3fb973))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.3.1
- Updated forgebook to 0.4.1
- Updated @forgebook/testing to 0.2.6

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.5 (2026-11-08)

### 🚀 Features

- **forgebook:** bind generic props to the component, and mark omitted discriminants ([c9c24bc1](https://github.com/ensiria/forgebook/commit/c9c24bc1))
- **forgebook:** draw projects that write JSX in .js files ([d052543c](https://github.com/ensiria/forgebook/commit/d052543c))
- **forgebook:** take forgebook new's values from where the application draws a component ([4f25e4e5](https://github.com/ensiria/forgebook/commit/4f25e4e5))
- **forgebook:** wait for what a story loads before a frame says ready ([a730e02f](https://github.com/ensiria/forgebook/commit/a730e02f))

### 🩹 Fixes

- **react:** render on the server with the web streams entry React 18 has ([52c2f78e](https://github.com/ensiria/forgebook/commit/52c2f78e))
- **forgebook:** compile only the catalogue's own .js modules' JSX ([426f0598](https://github.com/ensiria/forgebook/commit/426f0598))
- **forgebook:** read every variant's props, and say why a type is unread ([ddf08ea5](https://github.com/ensiria/forgebook/commit/ddf08ea5))
- **testing:** keep Vite a dependency, and say what a plugin's view needs ([9e140371](https://github.com/ensiria/forgebook/commit/9e140371))
- **forgebook:** bring Forgebook's own Vite and React ([56dca767](https://github.com/ensiria/forgebook/commit/56dca767))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.3.0
- Updated forgebook to 0.4.0
- Updated @forgebook/testing to 0.2.5

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.4 (2026-11-06)

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.4
- Updated forgebook to 0.3.3
- Updated @forgebook/testing to 0.2.4

## 0.2.3 (2026-11-05)

### 🩹 Fixes

- **forgebook:** require a Vite with the server.fs fixes ([f40739a](https://github.com/ensiria/forgebook/commit/f40739a))
- **nextjs:** answer a server component's fetch with the story's mocks ([1e36ff7](https://github.com/ensiria/forgebook/commit/1e36ff7))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.3
- Updated forgebook to 0.3.2
- Updated @forgebook/testing to 0.2.3

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.2 (2026-11-05)

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.2
- Updated forgebook to 0.3.1
- Updated @forgebook/testing to 0.2.2

## 0.2.1 (2026-11-05)

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.1
- Updated forgebook to 0.3.0
- Updated @forgebook/testing to 0.2.1

## 0.2.0 (2026-11-04)

### 🚀 Features

- **react:** run Storybook's preview hooks in a React story file ([b051e42](https://github.com/ensiria/forgebook/commit/b051e42))
- **forgebook:** list props by their TSDoc group, and an object prop's members ([f3d0003](https://github.com/ensiria/forgebook/commit/f3d0003))
- **react-native-web:** take Storybook's Babel, JSX source and file options ([a27a96d](https://github.com/ensiria/forgebook/commit/a27a96d))
- **react-native-web:** draw React Native components through react-native-web ([a4e758f](https://github.com/ensiria/forgebook/commit/a4e758f))
- share JSX code and function components' docs between adapters ([343d10a](https://github.com/ensiria/forgebook/commit/343d10a))
- open the framework contract beyond React ([350056c](https://github.com/ensiria/forgebook/commit/350056c))
- **forgebook:** read tokens from sources, and list them in CATALOG.md ([47e6740](https://github.com/ensiria/forgebook/commit/47e6740))
- **testing:** give every framework adapter one suite to pass ([e43e4b8](https://github.com/ensiria/forgebook/commit/e43e4b8))
- **forgebook:** read when to use a component from its TSDoc ([59e7bfa](https://github.com/ensiria/forgebook/commit/59e7bfa))

### 🩹 Fixes

- **forgebook:** write values into generated code as escaped literals ([535ca0e](https://github.com/ensiria/forgebook/commit/535ca0e))
- **react:** run a story's render and decorators as components ([0723312](https://github.com/ensiria/forgebook/commit/0723312))
- **forgebook:** read a .js story file that holds JSX ([73a07ec](https://github.com/ensiria/forgebook/commit/73a07ec))
- ⚠️  **forgebook:** give stories Storybook's ids, and merge files with one title ([05e19ad](https://github.com/ensiria/forgebook/commit/05e19ad))

### 🔥 Performance

- **react:** leave React's server renderer out of the frame page ([db0c81b](https://github.com/ensiria/forgebook/commit/db0c81b))
- **react:** redraw an edited component as soon as its update ran ([71ed135](https://github.com/ensiria/forgebook/commit/71ed135))
- **react:** load React's server renderer only for a server render ([317ebaa](https://github.com/ensiria/forgebook/commit/317ebaa))

### ⚠️  Breaking Changes

- **forgebook:** give stories Storybook's ids, and merge files with one title  ([05e19ad](https://github.com/ensiria/forgebook/commit/05e19ad))
  ids change for titles with a case change inside a word and for
  exports with digits or capitals in a row. The old ids keep working: the shell
  rewrites an address written with one, and a frame, `forgebook story`, `check`,
  `shot`, `diff` and the MCP tools take one and answer with the current id. A
  `forgebook diff` baseline or a Playwright screenshot stored under an old id is
  still the story's baseline until `forgebook shot --update` or
  `--update-snapshots` stores one under its id. Names derived from exports change
  where capitals or digits run together (`Size2X` is "Size 2 X").

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.2.0
- Updated forgebook to 0.2.0
- Updated @forgebook/testing to 0.2.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.8 (2026-11-01)

### 🚀 Features

- **react:** document a hook's signature, and type stories about logic ([7dd90db](https://github.com/ensiria/forgebook/commit/7dd90db))

### 🩹 Fixes

- **forgebook:** logic stories from the second self-review ([604682b](https://github.com/ensiria/forgebook/commit/604682b))
- **forgebook:** logic stories from the self-review ([195c3f9](https://github.com/ensiria/forgebook/commit/195c3f9))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.5
- Updated forgebook to 0.1.8

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.7 (2026-11-01)

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.7

## 0.1.6 (2026-11-01)

### 🩹 Fixes

- **react:** write a list arg as an array literal in a story's code ([32e82d6](https://github.com/ensiria/forgebook/commit/32e82d6))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.4
- Updated forgebook to 0.1.6

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.5 (2026-10-31)

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.5

## 0.1.4 (2026-10-31)

### 🚀 Features

- **forgebook:** forgebook new, a component's first stories from its props ([6925a49](https://github.com/ensiria/forgebook/commit/6925a49))
- **forgebook:** forgebook docs, with llms.txt and a story per component ([184c939](https://github.com/ensiria/forgebook/commit/184c939))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.3
- Updated forgebook to 0.1.4

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.3 (2026-10-31)

### 🧱 Updated Dependencies

- Updated forgebook to 0.1.3

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

- **react:** drop internal decision ids from the published docs ([6a77ecb](https://github.com/ensiria/forgebook/commit/6a77ecb))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.1
- Updated forgebook to 0.1.1

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.0 (2026-10-31)

### 🚀 Features

- build the packages for npm ([089d9dc](https://github.com/Ensiria/forgebook/commit/089d9dc))
- read Storybook's story files as they are ([3f765f8](https://github.com/Ensiria/forgebook/commit/3f765f8))
- a catalogue made from forgebook.config.ts ([5ea09c8](https://github.com/Ensiria/forgebook/commit/5ea09c8))
- switches the catalogue declares ([8cd9cca](https://github.com/Ensiria/forgebook/commit/8cd9cca))

### 🩹 Fixes

- pack the packages with pnpm only ([46762c9](https://github.com/Ensiria/forgebook/commit/46762c9))

### 🧱 Updated Dependencies

- Updated @forgebook/story-format to 0.1.0
- Updated forgebook to 0.1.0

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta