/**
 * What a Vue story still waits for, read from its canvas: a `Suspense` boundary with a branch still pending, wherever the
 * story or a library put it, the one around every story included.
 *
 * @remarks
 * Vue has no public way to ask this: a boundary's `onPending` and `onResolve` are its own author's, and the frame did not
 * write a story's own boundaries. So this walks the tree Vue keeps on the canvas, in a development and a production build
 * alike. Those fields are private, so a Vue that moved them must not read as nothing pending: `checkedContent` tries the
 * reading on a boundary known to wait and on one known not to, once per page, before it believes a story with nothing
 * pending.
 *
 * @module
 */
import type { ContentState } from "forgebook/renderer";
import { createApp, defineComponent, h, Suspense } from "vue";

/** A story that waits for nothing. */
export const SETTLED: ContentState = { state: "settled" };

/** Why this Vue cannot be read, in a sentence. */
const UNREADABLE: ContentState = {
  state: "unknown",
  reason:
    "Forgebook cannot read this version of Vue, so it cannot tell whether a Suspense boundary is still pending: update @forgebook/vue, or set parameters.suspense.expected in the preview to accept that"
};

/**
 * A field of one of Vue's private objects.
 *
 * @param value - the object, if it is one.
 * @param name - the field.
 */
const fieldOf = (value: unknown, name: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined;

/**
 * How many boundaries under a node are pending: what a pending branch holds is not looked into, since it is not shown.
 *
 * @param root - the node.
 */
const pendingBoundaries = (root: unknown): number => {
  let pending = 0;
  const nodes: unknown[] = [root];
  while (nodes.length > 0) {
    const node = nodes.pop();
    const suspense = fieldOf(node, "suspense");
    if (typeof suspense === "object" && suspense !== null) {
      if (fieldOf(suspense, "pendingBranch") !== null) pending += 1;
      else nodes.push(fieldOf(suspense, "activeBranch"));
      continue;
    }
    const subTree = fieldOf(fieldOf(node, "component"), "subTree");
    if (subTree !== undefined) nodes.push(subTree);
    const children = fieldOf(node, "children");
    if (Array.isArray(children)) nodes.push(...children);
  }
  return pending;
};

/**
 * What the story in a canvas waits for now.
 *
 * @param canvas - the element a Vue app is mounted on.
 */
export const contentOfCanvas = (canvas: HTMLElement): ContentState => {
  const root: unknown = Reflect.get(canvas, "_vnode");
  if (typeof root !== "object" || root === null) return UNREADABLE;
  const pending = pendingBoundaries(root);
  return pending === 0
    ? SETTLED
    : {
        state: "waiting",
        reason: `${pending} Vue Suspense ${pending === 1 ? "boundary is" : "boundaries are"} still pending`
      };
};

/** Never comes: what a boundary known to be pending waits for. */
const Never = defineComponent({ setup: () => new Promise<() => null>(() => undefined) });

/**
 * Whether a reading sees what is in a canvas: a boundary that waits as pending, and one that does not as settled.
 *
 * @param read - the reading.
 */
export const isReadingSound = (read: (canvas: HTMLElement) => ContentState): boolean => {
  const canvasOf = (
    child: () => unknown
  ): { readonly state: ContentState["state"]; readonly end: () => void } => {
    const canvas = document.createElement("div");
    const app = createApp({ render: () => h(Suspense, null, { default: child }) });
    app.mount(canvas);
    return { state: read(canvas).state, end: () => app.unmount() };
  };
  try {
    const pending = canvasOf(() => h(Never));
    const plain = canvasOf(() => h("i"));
    pending.end();
    plain.end();
    return pending.state === "waiting" && plain.state === "settled";
  } catch {
    return false;
  }
};

/** Whether the reading held on this page: it takes one try, and Vue does not change while a page lives. */
let isSound: boolean | undefined;

/**
 * A reading, believed only once it was shown to work: what it finds pending needs no proof, since waiting for it cannot
 * report a story ready too early, while a reading that went blind would find nothing pending in every story.
 *
 * @param content - what the reading found.
 * @param isGone - whether the story was taken away meanwhile: nothing is asked of a page being left.
 */
export const checkedContent = (content: ContentState, isGone: boolean): ContentState => {
  if (content.state !== "settled" || isGone) return content;
  isSound ??= isReadingSound(contentOfCanvas);
  return isSound ? content : UNREADABLE;
};
