<!--
@component
The site's header: its name from the public environment, a link per page, the one of the page shown marked current,
and the app's version.
-->
<script lang="ts">
import { ARROW } from "#lib/icons/arrow.ts";
import { TAGLINE } from "#lib/site.ts";
import { version } from "$app/env";
import { PUBLIC_SITE_NAME } from "$app/env/public";
import { resolve } from "$app/paths";
import { page } from "$app/state";

const links = [
  { href: resolve("/"), label: "Home" },
  { href: resolve("/about"), label: "About" },
  { href: resolve("/blog/[slug]", { slug: "hello-world" }), label: "First post" }
];
</script>

<header>
  <strong data-testid="site-name">{PUBLIC_SITE_NAME}</strong>
  <span>{TAGLINE}</span>
  <nav aria-label="Main">
    {#each links as link (link.href)}
      <a href={link.href} aria-current={page.url.pathname === link.href ? "page" : undefined}>
        {link.label} {ARROW}
      </a>
    {/each}
  </nav>
  <small data-testid="version">v{version}</small>
</header>

<style>
  header {
    display: flex;
    gap: 1rem;
    align-items: baseline;
  }

  nav {
    display: flex;
    gap: 0.75rem;
  }

  a[aria-current="page"] {
    font-weight: 700;
    text-decoration: underline;
  }
</style>
