/**
 * A counter as a plain custom element: it draws its own button, in its light DOM, and counts its clicks.
 *
 * @module
 */

/** A counter of its own clicks, labelled by its `label` attribute. */
export class FixtureCounter extends HTMLElement {
  static readonly observedAttributes = ["label"];
  #clicks = 0;

  connectedCallback(): void {
    this.#draw();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#draw();
  }

  #draw(): void {
    let button = this.querySelector("button");
    if (button === null) {
      button = this.ownerDocument.createElement("button");
      button.type = "button";
      button.dataset["testid"] = "counter";
      button.addEventListener("click", () => {
        this.#clicks += 1;
        this.#draw();
      });
      this.append(button);
    }
    button.textContent = `${this.getAttribute("label") ?? ""}: ${this.#clicks}`;
  }
}

if (customElements.get("fixture-counter") === undefined)
  customElements.define("fixture-counter", FixtureCounter);
