## 0.3.0 (2026-11-08)

### 🚀 Features

- **forgebook:** show a component's status as a badge ([ba41f8ee](https://github.com/ensiria/forgebook/commit/ba41f8ee))
- ⚠️  **story-format:** carry a story's written args in its file's code ([614a0df7](https://github.com/ensiria/forgebook/commit/614a0df7))
- **forgebook:** show the code a story file writes in Show code ([cc4c8d4e](https://github.com/ensiria/forgebook/commit/cc4c8d4e))
- **forgebook:** wait for what a story loads before a frame says ready ([a730e02f](https://github.com/ensiria/forgebook/commit/a730e02f))
- **forgebook:** offer a switch's values as a gallery of previews ([82a9578c](https://github.com/ensiria/forgebook/commit/82a9578c))
- **forgebook:** let a catalogue register its own panel controls ([e2417284](https://github.com/ensiria/forgebook/commit/e2417284))
- **forgebook:** edit objects, lists and mixed unions in the panel ([5033c6d2](https://github.com/ensiria/forgebook/commit/5033c6d2))

### 🩹 Fixes

- **forgebook:** stop on a configuration or link that cannot be read ([cf3ce801](https://github.com/ensiria/forgebook/commit/cf3ce801))
- **forgebook:** keep the catalogue drawing past a broken story file ([4bd1ab5b](https://github.com/ensiria/forgebook/commit/4bd1ab5b))

### ⚠️  Breaking Changes

- **story-format:** carry a story's written args in its file's code  ([614a0df7](https://github.com/ensiria/forgebook/commit/614a0df7))
  `StoryFileCode` entries are `StoryCode | StoryArgsCode`.
  Code that read `.text` of every entry, or took any entry for a render,
  narrows first with `"text" in entry`.

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.4 (2026-11-06)

This was a version bump only for @forgebook/story-format to align it with other projects, there were no code changes.

## 0.2.3 (2026-11-05)

This was a version bump only for @forgebook/story-format to align it with other projects, there were no code changes.

## 0.2.2 (2026-11-05)

This was a version bump only for @forgebook/story-format to align it with other projects, there were no code changes.

## 0.2.1 (2026-11-05)

### 🚀 Features

- **story-format:** a requiredFirst parameter and its place in the index ([06888b2](https://github.com/ensiria/forgebook/commit/06888b2))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.2.0 (2026-11-04)

### 🚀 Features

- **forgebook:** list props by their TSDoc group, and an object prop's members ([f3d0003](https://github.com/ensiria/forgebook/commit/f3d0003))
- ⚠️  **story-format:** let a source load each language's texts when shown ([22fcb19](https://github.com/ensiria/forgebook/commit/22fcb19))
- **story-format:** type a story's MSW handlers ([1670092](https://github.com/ensiria/forgebook/commit/1670092))
- give the device frame its own control, and touch in a device ([133c00f](https://github.com/ensiria/forgebook/commit/133c00f))
- ⚠️  show a story in a drawn device frame ([fdb94e4](https://github.com/ensiria/forgebook/commit/fdb94e4))
- ⚠️  **forgebook:** draw a component's page for its audience ([c58b72a](https://github.com/ensiria/forgebook/commit/c58b72a))
- **forgebook:** search docs pages, props and descriptions ([b39a045](https://github.com/ensiria/forgebook/commit/b39a045))
- open the framework contract beyond React ([350056c](https://github.com/ensiria/forgebook/commit/350056c))
- **forgebook:** add docs pages with live stories ([bac3b59](https://github.com/ensiria/forgebook/commit/bac3b59))
- link components to Figma, with a Design tab and a comparison ([91d3f63](https://github.com/ensiria/forgebook/commit/91d3f63))
- **story-format:** let a source name its design tokens ([aef8648](https://github.com/ensiria/forgebook/commit/aef8648))
- **forgebook:** check the stories a change touches ([1e2ee90](https://github.com/ensiria/forgebook/commit/1e2ee90))

### 🩹 Fixes

- renew a story's mocks in place, and log each frame's own requests ([ea08850](https://github.com/ensiria/forgebook/commit/ea08850))
- **forgebook:** read a preview's named exports and the globals it starts from ([99ad9c6](https://github.com/ensiria/forgebook/commit/99ad9c6))
- **forgebook:** list every export of a story file, as Storybook's indexer does ([350c260](https://github.com/ensiria/forgebook/commit/350c260))
- draw a story in a device inside its safe areas ([bc83792](https://github.com/ensiria/forgebook/commit/bc83792))
- **forgebook:** harden docs pages after review ([0feface](https://github.com/ensiria/forgebook/commit/0feface))

### 🔥 Performance

- **forgebook:** check Figma links in the index, not in the pages ([4f96a20](https://github.com/ensiria/forgebook/commit/4f96a20))

### ⚠️  Breaking Changes

- **story-format:** let a source load each language's texts when shown  ([22fcb19](https://github.com/ensiria/forgebook/commit/22fcb19))
  StorySource.texts values may be loaders, so code that
  reads a source's texts must handle both forms; shownTexts in
  forgebook/story-texts returns a promise.
- show a story in a drawn device frame  ([fdb94e4](https://github.com/ensiria/forgebook/commit/fdb94e4))
  device and orientation are now parameters of the
  address, so a catalogue's switch may no longer use either id. A
  catalogue with such a switch renames it, and the values its stories
  write in globals, to load.
- **forgebook:** draw a component's page for its audience  ([c58b72a](https://github.com/ensiria/forgebook/commit/c58b72a))
  `audience` is now a parameter of the address, so a switch
  may no longer take that id and a Storybook global of that name is dropped;
  `ViewState`, `ViewCatalogue` and `TreeStory` gain required fields.

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.5 (2026-11-01)

### 🚀 Features

- **story-format:** mark stories about logic with parameters.logic ([b27ed9e](https://github.com/ensiria/forgebook/commit/b27ed9e))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.4 (2026-11-01)

### 🚀 Features

- **forgebook:** touch stories with their own Touch toggle ([e363a2e](https://github.com/ensiria/forgebook/commit/e363a2e))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.3 (2026-10-31)

### 🚀 Features

- **story-format:** a language that reads right to left ([b12e5c8](https://github.com/ensiria/forgebook/commit/b12e5c8))
- **story-format:** a files group's usage loader ([99d1e35](https://github.com/ensiria/forgebook/commit/99d1e35))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.2 (2026-10-31)

### 🩹 Fixes

- point the repository URLs at the ensiria organisation ([8d0b3e2](https://github.com/ensiria/forgebook/commit/8d0b3e2))

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta

## 0.1.1 (2026-10-31)

### 🩹 Fixes

- **story-format:** drop internal decision ids from the published docs ([2d01b96](https://github.com/ensiria/forgebook/commit/2d01b96))

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

### ❤️ Thank You

- JasonScoppetta @JasonScoppetta