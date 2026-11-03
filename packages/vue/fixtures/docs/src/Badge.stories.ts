/**
 * The stories the extractor reads a single-file component from.
 *
 * @module
 */

import Badge from "./Badge.vue";
import { Plain } from "./Plain.ts";
import Item from "@/Item.vue";

export default {
  title: "Docs/Badge",
  component: Badge,
  subcomponents: { Item, Plain }
};

/** A badge. */
export const Default = { args: { label: "New" } };
