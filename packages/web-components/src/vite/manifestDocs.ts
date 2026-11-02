/**
 * A custom element's docs from its Custom Elements Manifest entry: what the props panel, the component page and the
 * agents read, named the way a story's args set each part (`../argNames.ts`).
 *
 * @remarks
 * An attribute is listed by its own name (`max-length`), with its field's type, description and default where the
 * attribute's own are missing; a public field no attribute sets is listed as a property (`.items`), unless it can only
 * be read; then the slots (`#default`, `#icon`), and the events as the listeners a story records (`@change`), each
 * passing its event. A manifest has no notion of a required attribute, so none is required. CSS parts are the
 * component's parts. The element's own description, or its summary, is its description; its module's is the page's
 * lead. Pure: a manifest's entry in, docs out.
 *
 * @module
 */
import type { ComponentDocs, PropDocs, UsageGuidance } from "forgebook/component-docs";

import { eventArg, propertyArg, slotArg } from "../argNames.ts";
import type { ManifestElement, ManifestEvent, ManifestField, ManifestModule } from "./manifest.ts";
import { typeTextDocs } from "./typeText.ts";

/** A text's first paragraph, on one line: what a description in the catalogue shows. */
const firstParagraph = (text: string): string => (text.split(/\n\s*\n/)[0] ?? "").replace(/\s+/g, " ").trim();

/**
 * One prop, from its name, type, description and default.
 *
 * @param name - the arg's name.
 * @param type - the type as written.
 * @param description - its description.
 * @param defaultValue - its default, as code.
 */
const propOf = (
  name: string,
  type: string | undefined,
  description: string,
  defaultValue: string | undefined
): PropDocs => ({
  name,
  ...typeTextDocs(type),
  description: firstParagraph(description),
  isRequired: false,
  ...(defaultValue === undefined ? {} : { defaultValue })
});

/**
 * An event, as the listener a story records.
 *
 * @param event - the event.
 */
const eventDocs = (event: ManifestEvent): PropDocs => {
  const passed = event.type?.text ?? "Event";
  const signature = { parameters: [{ name: "event", type: passed }], returns: "void" };
  return {
    name: eventArg(event.name),
    kind: "event",
    type: `(event: ${passed}) => void`,
    description: firstParagraph(event.description),
    isRequired: false,
    signature
  };
};

/**
 * The props of an element: its attributes, its fields no attribute sets, its slots and its events.
 *
 * @param element - the element.
 */
export const manifestProps = (element: ManifestElement): PropDocs[] => {
  const fields = new Map<string, ManifestField>(element.fields.map((field) => [field.name, field]));
  const attributes = element.attributes.map((attribute) => {
    const field = attribute.fieldName === undefined ? undefined : fields.get(attribute.fieldName);
    return propOf(
      attribute.name,
      attribute.type?.text ?? field?.type?.text,
      attribute.description === "" ? (field?.description ?? "") : attribute.description,
      attribute.default ?? field?.default
    );
  });
  const setByAttribute = new Set(element.attributes.flatMap((attribute) => attribute.fieldName ?? []));
  const properties = element.fields
    .filter((field) => !field.isReadonly && field.attribute === undefined && !setByAttribute.has(field.name))
    .map((field) => propOf(propertyArg(field.name), field.type?.text, field.description, field.default));
  const slots = element.slots.map(
    (slot): PropDocs => ({
      name: slotArg(slot.name),
      kind: "other",
      type: "Slot",
      description: firstParagraph(slot.description),
      isRequired: false,
      canTakeText: true
    })
  );
  return [...attributes, ...properties, ...slots, ...element.events.map(eventDocs)];
};

/** What the manifest says of when not to use an element. */
const guidanceOf = (element: ManifestElement): { readonly guidance?: UsageGuidance } => {
  if (element.deprecated === undefined) return {};
  return { guidance: { deprecated: element.deprecated === true ? "Deprecated." : element.deprecated } };
};

/**
 * An element's docs.
 *
 * @param element - the element's entry.
 * @param module - the module that declares it.
 * @param name - the name the docs give it: its tag in a story, its class for `forgebook new`.
 */
export const manifestDocs = (
  element: ManifestElement,
  module: ManifestModule,
  name: string
): ComponentDocs => ({
  name,
  description: firstParagraph(element.description === "" ? element.summary : element.description),
  summary: firstParagraph(module.description),
  props: manifestProps(element),
  parts: element.cssParts.map((part) => part.name),
  subcomponents: [],
  ...guidanceOf(element)
});
