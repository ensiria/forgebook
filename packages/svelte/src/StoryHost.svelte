<!--
@component
What the renderer mounts in a story's canvas, and renders on the server: the story's tree of components (`storyNode.ts`),
each drawn with its props and the node inside it as its `children`, in an error boundary.

The state lives in the renderer (`svelteRenderer.ts`), in values Svelte follows: new args draw again what read them, and a
component whose node keeps its component keeps its state. A new try after an error draws the story anew. An error in an
event handler is the handler's, as in a page: a boundary does not catch it. On the server a boundary catches nothing, so
an error fails the render. The file imports nothing but types, so it is published as it is.
-->
<script lang="ts">
import type { StoryNode } from "./storyNode.ts";
import type { StoryScene } from "./svelteRenderer.ts";

const { scene }: { readonly scene: StoryScene } = $props();
</script>

{#snippet draw(node: StoryNode)}
  {#if node.inner === undefined}
    <node.component {...node.props} />
  {:else}
    {@const inner = node.inner}
    <node.component {...node.props}>{@render draw(inner)}</node.component>
  {/if}
{/snippet}

{#key scene.attempt}
  {#if !scene.isFailed}
    <svelte:boundary onerror={scene.fail}>
      {@const node = scene.node}
      {@render draw(node)}
    </svelte:boundary>
  {/if}
{/key}
