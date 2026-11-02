<img src="assets/forgebook-logo.svg" alt="" width="64" height="64">

# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions.

This repository holds Forgebook's packages; each has its own README, which is also its npm page.

| Package | What it is |
|---|---|
| [`forgebook`](packages/forgebook) | The catalogue: the shell, one frame per story, the Vite plugin and the commands. **Start here.** |
| [`@forgebook/react`](packages/react) | React's story types, renderer and props reader |
| [`@forgebook/react-native-web`](packages/react-native-web) | React Native's components in the browser, through react-native-web |
| [`@forgebook/story-format`](packages/story-format) | The story format, for a library whose stories must not depend on a catalogue |
| [`@forgebook/testing`](packages/testing) | Tests generated from the stories: browser, visual and server render |

Requirements: Node 22.18 or later and Vite 8; React 19 today, React Native through react-native-web. [MIT licence](LICENSE).

Bugs, proposals and pull requests: [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: [SECURITY.md](SECURITY.md).
