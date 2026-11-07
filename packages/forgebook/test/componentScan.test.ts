/**
 * Tests for reading components from their text and telling which look like one: a name alone must not be enough.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type ScannedComponent, scannedComponents } from "../src/vite/componentScan.ts";
import { lookAlikes, stemOf } from "../src/vite/lookAlikes.ts";

/** A component. */
const component = (name: string, file: string, fields: Partial<ScannedComponent> = {}): ScannedComponent => ({
  name,
  file,
  line: 1,
  props: [],
  classes: [],
  renders: [],
  isExported: true,
  ...fields
});

const LOOK = ["inline-flex", "items-center", "rounded-md", "px-4", "py-2", "font-medium"];

describe("scannedComponents", () => {
  it("reads a component's root, props and classes, in the forms code writes them", () => {
    const text = `
      type Props = { label: string; onPress: () => void };
      export const Plain = ({ size, tone }: { size: string; tone: string }) => <button className="a b" />;
      export function Named({ label, onPress }: Props) { return <a className={cn("c d", label)}><Icon /></a>; }
      export const Wrapped = forwardRef<HTMLInputElement, Props>((props, ref) => <input ref={ref} />);
      const helper = () => 1;
      const CONSTANT = 3;
      export const NoMarkup = () => null;
    `;
    expect(scannedComponents("a.tsx", text)).toMatchObject([
      { name: "Plain", root: "button", props: ["size", "tone"], classes: ["a", "b"], line: 3 },
      { name: "Named", root: "a", props: ["label", "onPress"], classes: ["c", "d"], renders: ["Icon"] },
      { name: "Wrapped", root: "input" }
    ]);
  });

  it("reads the root from what it returns last, not from markup on the way", () => {
    const text = `
      export const List = ({ loading }) => {
        const icon = <svg />;
        const items = useMemo(() => [1].map(() => <li />), []);
        if (loading) return <Spinner />;
        return (<><ul className="a b">{items}{icon}</ul></>);
      };
      export const Toggle = ({ on }) => (on ? <span /> : <button />);
    `;
    expect(scannedComponents("a.tsx", text)).toMatchObject([
      { name: "List", root: "ul", classes: ["a", "b"], renders: ["Spinner"] },
      { name: "Toggle", root: "button" }
    ]);
  });

  it("reads a class, a default export with no name, and props written in a type from outside", () => {
    const text = `
      type P = { size: string; tone: string };
      export class Old extends React.Component { render() { return <a />; } }
      export const Fc: React.FC<P> = (props) => <i />;
      export const Fr = forwardRef<HTMLButtonElement, P>((props, ref) => <button />);
      export default forwardRef((props, ref) => <b />);
    `;
    expect(scannedComponents("src/my-thing.tsx", text)).toMatchObject([
      { name: "Old", root: "a" },
      { name: "Fc", props: ["size", "tone"] },
      { name: "Fr", root: "button", props: ["size", "tone"] },
      { name: "MyThing", root: "b" }
    ]);
  });

  it("takes the longest string of a helper's call for the classes, and no binding for them", () => {
    const [one] = scannedComponents(
      "a.tsx",
      'export const A = () => <p className={cn(on && "on", "a b c")} />;'
    );
    expect(one?.classes).toEqual(["a", "b", "c"]);
    const [vue] = scannedComponents("a.vue", '<template><p :class="x" /></template>');
    expect(vue?.classes).toEqual([]);
  });

  it("gives nothing for a file it cannot parse", () => {
    expect(scannedComponents("a.tsx", "export const = ;")).toEqual([]);
  });

  it("reads a single-file component from its name and template", () => {
    const vue = `<script setup lang="ts">defineProps<{ title: string; open?: boolean }>()</script>
      <template><button class="a b"><Icon /></button></template>`;
    expect(scannedComponents("src/my-button.vue", vue)).toMatchObject([
      {
        name: "MyButton",
        file: "src/my-button.vue",
        line: 1,
        root: "button",
        props: ["title", "open"],
        classes: ["a", "b"],
        renders: ["Icon"]
      }
    ]);
    const svelte = '<script>export let label;</script>\n<a class="x">{label}</a>';
    expect(scannedComponents("Link.svelte", svelte)).toMatchObject([
      { name: "Link", root: "a", props: ["label"] }
    ]);
  });
});

describe("what a crafted file costs", () => {
  it("leaves out a script nested past what a parser can take, and keeps going", () => {
    const deep = `export const A = () => ${"<b>".repeat(20_000)}${"</b>".repeat(20_000)};`;
    expect(scannedComponents("a.tsx", deep)).toEqual([]);
  });

  it("reads a large single-file component in linear time", () => {
    const text = `${"<script ".repeat(50_000)}<template><a class="x" /></template>`;
    const started = performance.now();
    expect(scannedComponents("a.vue", text)[0]?.root).toBe("a");
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("groups thousands of alike components quickly", () => {
    const many = Array.from({ length: 1000 }, (_, index) =>
      component("Save", `f${index}.tsx`, { root: "button", classes: LOOK, props: ["size", "tone"] })
    );
    const started = performance.now();
    lookAlikes(many);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("stemOf", () => {
  it.each([
    ["PrimaryButton", "Button"],
    ["ButtonPrimary", "Button"],
    ["Btn", "Button"],
    ["MyBtn", "Button"],
    ["IconButton", "IconButton"],
    ["Modal", "Dialog"],
    ["TextField", "Input"],
    ["App", "App"]
  ])("reads %s as %s", (name, stem) => {
    expect(stemOf(name)).toBe(stem);
  });
});

describe("lookAlikes", () => {
  it("calls two alike on a name and a sign, and surer on two signs", () => {
    const [group] = lookAlikes([
      component("Button", "a.tsx", { root: "button", props: ["size", "tone"], classes: LOOK }),
      component("Btn", "b.tsx", { root: "button", props: ["size", "tone"], classes: LOOK })
    ]);
    expect(group).toMatchObject({ confidence: "high", members: [{ name: "Button" }, { name: "Btn" }] });
    expect(group?.why).toContain("both render button");
    expect(
      lookAlikes([
        component("Button", "a.tsx", { root: "button" }),
        component("Btn", "b.tsx", { root: "button" })
      ])[0]
    ).toMatchObject({ confidence: "medium" });
  });

  it("compares every member, not only the first, and keeps all it joins", () => {
    const signs = { root: "button", props: ["size", "tone"] };
    const [group] = lookAlikes([
      component("Button", "x.tsx", { root: "div" }),
      component("Button", "a.tsx", signs),
      component("PrimaryButton", "b.tsx", signs),
      component("SecondaryButton", "c.tsx", signs)
    ]);
    expect(group?.members.map(({ file }) => file).toSorted()).toEqual(["a.tsx", "b.tsx", "c.tsx"]);
  });

  it("does not call two alike on a name alone", () => {
    expect(lookAlikes([component("Card", "a.tsx"), component("Card", "b.tsx")])).toEqual([]);
    expect(
      lookAlikes([component("Card", "a.tsx", { root: "div" }), component("Card", "b.tsx", { root: "div" })])
    ).toEqual([]);
  });

  it("takes rendering one's own component for reuse, not a copy", () => {
    expect(
      lookAlikes([
        component("Button", "a.tsx", { root: "button", props: ["size", "tone"] }),
        component("PrimaryButton", "b.tsx", { root: "button", props: ["size", "tone"], renders: ["Button"] })
      ])
    ).toEqual([]);
    expect(
      lookAlikes([
        component("Crumb", "a.tsx", { root: "NavCrumb" }),
        component("Crumb", "b.tsx", { root: "NavCrumb" })
      ])
    ).toEqual([]);
  });

  it("needs two signs for a general name", () => {
    expect(
      lookAlikes([
        component("Header", "a.tsx", { root: "nav" }),
        component("Header", "b.tsx", { root: "nav" })
      ])
    ).toEqual([]);
  });

  it("leaves out screens, however alike", () => {
    const signs = { root: "button", props: ["size", "tone"], classes: LOOK };
    expect(
      lookAlikes([
        component("Users", "src/routes/a.tsx", signs),
        component("Users", "src/routes/b.tsx", signs),
        component("SettingsPage", "a.tsx", signs),
        component("SettingsPage", "b.tsx", signs),
        component("Thing", "app/x/page.tsx", signs),
        component("Thing", "app/y/page.tsx", signs)
      ])
    ).toEqual([]);
  });

  it("finds controls of one look under different names, and only those", () => {
    const [group, ...rest] = lookAlikes([
      component("SaveAction", "a.tsx", { root: "button", classes: LOOK }),
      component("CancelThing", "b.tsx", { root: "button", classes: LOOK }),
      component("Other", "c.tsx", { root: "button", classes: LOOK }),
      component("Panel", "d.tsx", { root: "div", classes: LOOK }),
      component("Box", "e.tsx", { root: "div", classes: LOOK }),
      component("Field", "f.tsx", { root: "input", classes: LOOK }),
      component("Area", "g.tsx", { root: "textarea", classes: LOOK })
    ]);
    expect(group?.members.map(({ name }) => name).toSorted()).toEqual(["CancelThing", "Other", "SaveAction"]);
    expect(rest).toEqual([]);
  });
});
