<!-- @component A component written without TypeScript. -->
<script>
/**
 * @typedef {object} Props
 * @property {string} [text] - What it shows.
 * @property {() => void} [onclick] - Called on a click.
 */

/** @type {Props} */
let { text = "Plain", onclick } = $props();
</script>

<button type="button" {onclick}>{text}</button>
