<!--
@component
The site's header, as a SvelteKit 2 app writes it: its name from `$env/static/public`, its links under the app's base
path, the one of the page shown marked current through the `page` store, and the app's version.
-->
<script lang="ts">
import { version } from "$app/environment";
import { base } from "$app/paths";
import { page } from "$app/stores";
import { PUBLIC_SITE_NAME } from "$env/static/public";

const links = [
  { href: `${base}/`, label: "Home" },
  { href: `${base}/about`, label: "About" },
  { href: `${base}/blog/hello-world`, label: "First post" }
];
</script>

<header>
  <strong data-testid="site-name">{PUBLIC_SITE_NAME}</strong>
  <nav aria-label="Main">
    {#each links as link (link.href)}
      <a href={link.href} aria-current={$page.url.pathname === link.href ? "page" : undefined}>{link.label}</a>
    {/each}
  </nav>
  <small data-testid="version">v{version}</small>
</header>
