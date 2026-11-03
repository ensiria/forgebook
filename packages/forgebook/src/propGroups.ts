/**
 * A component's props in their groups, as its TSDoc names them (`@group Selection`): the API reference and the Props
 * tab list them the same way.
 *
 * @remarks
 * The props that name no group come first: they are the ones an author left out of every group, most often the few
 * every use of the component sets (`value`, `onChange`). Then each group, in the order a configuration names them
 * (the component's meta, then the catalogue), the others in the order they first appear among the props. A component
 * whose props name no group is one list, as it always was. Pure.
 *
 * @module
 */

/** A group of props: its name, none for the props that name no group, and its props in their order. */
export type PropGroup<TProp> = {
  /** The group's name, as `@group` writes it; none for the props that name no group. */
  readonly name: string | undefined;
  /** Its props, in their order among the component's. */
  readonly props: readonly TProp[];
};

/**
 * The most props a group shows open when the page draws it; a longer one starts folded. Twelve rows of the API
 * reference fill about one laptop screen, so a group past it would push every group after it out of sight, while a
 * folded one still shows its name and count.
 */
export const LONG_GROUP = 12;

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
 * Whether a group starts folded: a named one longer than `LONG_GROUP`, unless it is the first listed, so a page never
 * opens on nothing but folded groups.
 *
 * @param group - the group.
 * @param index - its place among the groups listed, from 0.
 */
export const startsFolded = (group: PropGroup<unknown>, index: number): boolean =>
  group.name !== undefined && index > 0 && group.props.length > LONG_GROUP;

/**
 * Whether any of the props names a group: when none does, the props are listed as one list, as before groups.
 *
 * @param props - the props.
 */
export const hasPropGroups = (props: readonly { readonly group?: string | undefined }[]): boolean =>
  props.some((prop) => prop.group !== undefined);
