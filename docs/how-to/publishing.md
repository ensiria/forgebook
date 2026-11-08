---
title: How-to/Publishing a catalogue
order: 6
description: Build static files, serve them under a sub-path, set the headers a host needs, embed a story.
---

# Publishing a catalogue

```sh
npx forgebook build
```

writes the catalogue to `dist/` as static files. Any web server or static host serves them; there is no server side.

| Option | What it does |
|---|---|
| `--out <folder>` | Writes to another folder than `dist` |
| `--base <path>` | Builds for a host that serves the catalogue under a sub-path (`/pr-12/`) |
| `--watch` | Stays running and builds again when a file the catalogue reads changes |
| `--readable-names` | Names each script after its module as well as its hash, to read what a build holds |
| `--agent-index` | Also writes what agents read, so `forgebook mcp --from <address or folder>` serves the built catalogue |

A build ends with a non-zero exit when a story file does not parse or a story pattern matches nothing; see
[troubleshooting](../troubleshooting.md#forgebook-build).

## Headers

A host that sets a `Content-Security-Policy` needs:

- `blob:` in `script-src`, for the accessibility check: the build keeps axe gzipped and runs it from a blob;
- the catalogue's own origin (`'self'`) in `connect-src`: the page fetches the docs, code and pages a build keeps
  gzipped.

Forgebook sets no framing headers. To choose who may frame your catalogue, answer with
`Content-Security-Policy: frame-ancestors` from your server.

## Frames on their own origin

On the dev server the stories run on a second port, so a story's code cannot reach the catalogue's page. In a static
build the frames share the catalogue's origin, unless you serve the same files from a second host and name both:

```ts
frames: { origins: { catalogue: "https://ui.example.com", frames: "https://ui-frames.example.com" } }
```

See [stories on an origin of their own](../../packages/forgebook/README.md#stories-on-an-origin-of-their-own).

## Embedding a story

Add `embed` to a story's address to show it alone, with no sidebar, toolbar or panel:

```html
<iframe src="https://ui.example.com/?embed&story=stories:components-badge--default&theme=dark" title="Badge" width="100%" height="320" style="border: 0"></iframe>
```

The story bar's **Embed** button gives the link and this code for the story and view on screen.
