/**
 * HTML drawn over what a canvas already shows, keeping every node that stays: the renderer's way of drawing a story's
 * text again with new args.
 *
 * @remarks
 * Writing the text anew would make every element anew: a focused field would lose its focus and what was typed in it,
 * a custom element its own state, a scrolled list its place. So the new HTML is parsed apart, then laid over the
 * current nodes in order: a node of the same kind and name is kept, its attributes and text brought to the new ones,
 * any other replaced; nodes left over are removed. As in a page that sets an attribute, a field's typed value stays and
 * an element's properties are its own.
 *
 * A custom element (a name with a hyphen) draws its own children, so when the HTML gives it none, the ones it drew are
 * left to it; when the HTML gives it some (its slotted content), they are laid over like any other. Shadow roots are
 * never touched: they belong to their element. The parsed HTML is inert until it is placed, so a `<script>` in it does
 * not run, as with `innerHTML`.
 *
 * @module
 */

/**
 * Whether two nodes are of the same kind, so the one shown can be kept: the same type and, for elements, the same name
 * in the same namespace.
 *
 * @param shown - the node in the canvas.
 * @param next - the node of the new HTML.
 */
const isSameKind = (shown: Node, next: Node): boolean => {
  if (shown.nodeType !== next.nodeType) return false;
  if (!(shown instanceof Element) || !(next instanceof Element)) return true;
  return shown.localName === next.localName && shown.namespaceURI === next.namespaceURI;
};

/**
 * Brings an element's attributes to another's: removes those the new one lacks, sets those it changes.
 *
 * @param shown - the element in the canvas.
 * @param next - the element of the new HTML.
 */
const morphAttributes = (shown: Element, next: Element): void => {
  for (const attribute of [...shown.attributes]) {
    if (!next.hasAttributeNS(attribute.namespaceURI, attribute.localName))
      shown.removeAttributeNS(attribute.namespaceURI, attribute.localName);
  }
  for (const attribute of next.attributes) {
    if (shown.getAttributeNS(attribute.namespaceURI, attribute.localName) !== attribute.value)
      shown.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
  }
};

/**
 * Whether the HTML gives an element no content of its own: no child but blank text.
 *
 * @param next - the element of the new HTML.
 */
const isEmpty = (next: Element): boolean =>
  [...next.childNodes].every(
    (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim() === ""
  );

/**
 * Brings a kept node to the new one: a text's or a comment's data, an element's attributes and children.
 *
 * @param shown - the node in the canvas.
 * @param next - the node of the new HTML, of the same kind.
 */
const morphNode = (shown: Node, next: Node): void => {
  if (!(shown instanceof Element) || !(next instanceof Element)) {
    if (shown.nodeValue !== next.nodeValue) shown.nodeValue = next.nodeValue;
    return;
  }
  morphAttributes(shown, next);
  // a template's content is a fragment of its own, not its children: replaced whole when it changed
  if (shown instanceof HTMLTemplateElement && next instanceof HTMLTemplateElement) {
    if (shown.innerHTML !== next.innerHTML) shown.content.replaceChildren(next.content);
    return;
  }
  if (shown.localName.includes("-") && isEmpty(next)) return;
  morphChildren(shown, next);
};

/**
 * Lays one parent's children over another's, in order.
 *
 * @param shown - the parent in the canvas.
 * @param next - the parent of the new HTML; its children move into `shown` where they are new.
 */
const morphChildren = (shown: ParentNode, next: ParentNode): void => {
  // a copy: a new node placed in the canvas leaves `next`
  const nextChildren = [...next.childNodes];
  nextChildren.forEach((nextChild, index) => {
    const shownChild = shown.childNodes[index];
    if (shownChild === undefined) shown.append(nextChild);
    else if (isSameKind(shownChild, nextChild)) morphNode(shownChild, nextChild);
    else shownChild.replaceWith(nextChild);
  });
  while (shown.childNodes.length > nextChildren.length) shown.lastChild?.remove();
};

/**
 * Draws HTML in an element over what it shows.
 *
 * @param target - the element, the story's canvas.
 * @param html - the HTML.
 */
export const morphHtml = (target: Element, html: string): void => {
  const template = target.ownerDocument.createElement("template");
  template.innerHTML = html;
  morphChildren(target, template.content);
};
