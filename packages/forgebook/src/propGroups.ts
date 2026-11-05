/**
 * A component's props in their groups, as its TSDoc names them (`@group Selection`), with its required props where the
 * catalogue, the component or the story asks (`requiredFirst`): the API reference and the Props tab list them the same
 * way.
 *
 * @remarks
 * The props that name no group come first: they are the ones an author left out of every group, most often the few
 * every use of the component sets (`value`, `onChange`). Then each group, in the order a configuration names them
 * (the component's meta, then the catalogue), the others in the order they first appear among the props. A component
 * whose props name no group is one list, as it always was. Every group starts open: a reader folds one away, never the
 * catalogue.
 *
 * The required props come first inside each group by default, the others keeping the order of the source, so a reader
 * sees at once what every use must set. A `section` layout gathers them in one section before the groups instead,
 * which only means something when there are groups: without, it is the same single list. The narrowest setting wins
 * (the story's, the component's, the catalogue's), and a reader's switch turns the ordering on or off over them,
 * never choosing the layout, which stays the developer's. Pure.
 *
 * @module
 */
import type { RequiredFirst } from "@forgebook/story-format/csf";

/** A group of props: its name, none for the props that name no group, and its props in their order. */
export type PropGroup<TProp> = {
  /** The group's name, as `@group` writes it; none for the props that name no group. */
  readonly name: string | undefined;
  /** Its props, in their order among the component's. */
  readonly props: readonly TProp[];
};

/**
 * The order of the groups named first: the component's own (its meta's `parameters.propGroups`), then the
 * catalogue's (`propGroups` in its configuration) not already named, each once.
 *
 * @param componentOrder - the groups the component names first; none by default.
 * @param catalogueOrder - the groups the catalogue names first; none by default.
 */
export const propGroupOrder = (
  componentOrder: readonly string[] = [],
  catalogueOrder: readonly string[] = []
): readonly string[] => [...new Set([...componentOrder, ...catalogueOrder])];

/**
 * Props in their groups: those naming no group first, then the groups named in `order`, in its order, then the others
 * in the order they first appear. A group with no props is never listed, even when `order` names it.
 *
 * @param props - the props, in their order.
 * @param order - the groups to show first, in this order (`propGroupOrder`).
 */
export const groupedProps = <TProp extends { readonly group?: string | undefined }>(
  props: readonly TProp[],
  order: readonly string[]
): PropGroup<TProp>[] => {
  const ungrouped: TProp[] = [];
  // a map keeps its keys in the order they were first set: the order the groups first appear
  const named = new Map<string, TProp[]>();
  for (const prop of props) {
    if (prop.group === undefined) {
      ungrouped.push(prop);
      continue;
    }
    const group = named.get(prop.group);
    if (group === undefined) named.set(prop.group, [prop]);
    else group.push(prop);
  }
  const rank = (name: string): number => {
    const index = order.indexOf(name);
    return index === -1 ? order.length : index;
  };
  const groups = [...named.entries()]
    .map(([name, grouped]): PropGroup<TProp> => ({ name, props: grouped }))
    // a stable sort: the groups `order` does not name keep the order they appear in
    .sort((left, right) => rank(left.name ?? "") - rank(right.name ?? ""));
  return ungrouped.length === 0 ? groups : [{ name: undefined, props: ungrouped }, ...groups];
};

/**
 * Whether any of the props names a group: when none does, the props are listed as one list, as before groups.
 *
 * @param props - the props.
 */
export const hasPropGroups = (props: readonly { readonly group?: string | undefined }[]): boolean =>
  props.some((prop) => prop.group !== undefined);

/** The layouts the required props can take, as a configuration and `parameters.requiredFirst` write them. */
export const REQUIRED_FIRST_LAYOUTS: readonly RequiredFirst[] = ["in-groups", "section", false];

/**
 * The layout a reader sees: the narrowest the developer set (the story's or the component's, else the catalogue's),
 * with the reader's switch over it. Turned off, the source's order; turned on where the developer chose the source's
 * order, the catalogue's layout, else `in-groups`.
 *
 * @param own - the story's or the component's setting; none leaves it to the catalogue.
 * @param catalogue - the catalogue's setting.
 * @param isReaderOn - the reader's switch; none when the reader never turned it.
 */
export const requiredFirstLayout = (
  own: RequiredFirst | undefined,
  catalogue: RequiredFirst,
  isReaderOn: boolean | undefined
): RequiredFirst => {
  const chosen = own ?? catalogue;
  if (isReaderOn === undefined) return chosen;
  if (!isReaderOn) return false;
  if (chosen !== false) return chosen;
  return catalogue === false ? "in-groups" : catalogue;
};

/** A prop as the layout reads it: its group, whether it is required, and whether it is an event. */
type LaidOutProp = {
  readonly group?: string | undefined;
  readonly isRequired: boolean;
  readonly kind?: string;
};

/** Props laid out for reading: the "Required" section, the groups, the events. */
export type PropLayout<TProp> = {
  /**
   * The "Required" section's props, those naming no group first, then each group's in the groups' order, then the
   * events; empty unless the layout is `section` and the props name a group.
   */
  readonly required: readonly TProp[];
  /** The props but the events in their groups (`groupedProps`), without those in `required`; no group left empty. */
  readonly groups: readonly PropGroup<TProp>[];
  /** The events, without those in `required`. */
  readonly events: readonly TProp[];
};

/**
 * Whether putting the required props first changes anything: a required prop and one that is not. A table without
 * shows no "Required first" switch.
 *
 * @param props - the props shown.
 */
export const canOrderRequired = (props: readonly { readonly isRequired: boolean }[]): boolean =>
  props.some((prop) => prop.isRequired) && props.some((prop) => !prop.isRequired);

/**
 * Props with the required ones first, the rest in their order.
 *
 * @param props - the props, in their order.
 */
export const requiredPropsFirst = <TProp extends LaidOutProp>(props: readonly TProp[]): TProp[] => [
  ...props.filter((prop) => prop.isRequired),
  ...props.filter((prop) => !prop.isRequired)
];

/**
 * Props laid out for reading: in their groups (`groupedProps`), the events apart, the required ones where the layout
 * puts them.
 *
 * @param props - the props, events among them (`kind: "event"`), in the order of the source.
 * @param order - the groups to show first, in this order (`propGroupOrder`).
 * @param layout - where the required props go (`requiredFirstLayout`).
 */
export const laidOutProps = <TProp extends LaidOutProp>(
  props: readonly TProp[],
  order: readonly string[],
  layout: RequiredFirst
): PropLayout<TProp> => {
  const isEvent = (prop: TProp): boolean => prop.kind === "event";
  const listed = props.filter((prop) => !isEvent(prop));
  const groups = groupedProps(listed, order);
  const events = props.filter(isEvent);
  if (layout === false) return { required: [], groups, events };
  if (layout === "in-groups" || !hasPropGroups(listed)) {
    return {
      required: [],
      groups: groups.map((group) => ({ name: group.name, props: requiredPropsFirst(group.props) })),
      events: requiredPropsFirst(events)
    };
  }
  return {
    required: [...groups.flatMap((group) => group.props), ...events].filter((prop) => prop.isRequired),
    groups: groups
      .map((group) => ({ name: group.name, props: group.props.filter((prop) => !prop.isRequired) }))
      .filter((group) => group.props.length > 0),
    events: events.filter((prop) => !prop.isRequired)
  };
};
