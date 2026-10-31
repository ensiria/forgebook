# Security

## Reporting a vulnerability

Report it privately, never in a public issue: on GitHub, **Security** › **Report a vulnerability**
(<https://github.com/Ensiria/forgebook/security/advisories/new>). A fix is released as soon as it is ready, and you are
credited unless you ask not to be.

## Supported versions

The latest release. While the package is 0.x, fixes go into the next release only.

## What the packages do to keep you safe

- They are built and staged from GitHub Actions through npm's trusted publishing, with a provenance statement, and a
  version goes public only when a maintainer approves it with 2FA: the workflow alone cannot publish. `npm view
  forgebook --json` shows the provenance, and `npm audit signatures` verifies it.
- The catalogue runs on your machine through Vite's dev server, bound to `localhost` unless you pass `--host`; a built
  catalogue is static files.
- Heavy tools (Playwright, Testing Library, Sass) are optional peers your project installs, not dependencies of the
  core.
