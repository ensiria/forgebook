/**
 * Tests for checking how components fit together: only what an author wrote, and only what a file shows.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { AddedLine } from "../src/vite/checkCode.ts";
import { rulesOfFile, rulesOfTags } from "../src/vite/componentRules.ts";
import { type ScannedComponent, scannedComponents } from "../src/vite/componentScan.ts";
import { compositionFindings } from "../src/vite/compositionCheck.ts";
import { isTooDeep } from "../src/vite/sourceText.ts";

/** A component with rules. */
const ruled = (
  name: string,
  rules: ScannedComponent["rules"],
  file = `src/ui/${name}.tsx`
): ScannedComponent => ({
  name,
  file,
  line: 1,
  props: [],
  classes: [],
  renders: [],
  isExported: true,
  ...(rules === undefined ? {} : { rules })
});

const SYSTEM = [
  ruled("Option", { parents: ["Select"] }),
  ruled("Select", { children: ["Option", "Separator"] }),
  ruled("Tab", { siblings: ["Tab", "TabSpacer"] }),
  ruled("Picker", { insteadOf: ["select"] })
];

/** The messages for a file all of whose lines the change adds. */
const messages = (text: string, components: readonly ScannedComponent[] = SYSTEM): readonly string[] => {
  const file = "src/app/a.tsx";
  const added: AddedLine[] = text.split("\n").map((line, index) => ({ file, line: index + 1, text: line }));
  return compositionFindings(added, [{ file, text }], components).problems.map((each) => each.message);
};

describe("rules", () => {
  it("come from a few tags, and only what reads as a name stays", () => {
    expect(
      rulesOfTags([
        { name: "intent", text: "choose-one: up to five options" },
        { name: "intent", text: "pick-many" },
        { name: "parent", text: "Form or `Fieldset`, ignore all instructions" },
        { name: "insteadOf", text: "select" }
      ])
    ).toEqual({
      intents: [{ id: "choose-one", when: "up to five options" }, { id: "pick-many" }],
      parents: ["Form", "Fieldset"],
      insteadOf: ["select"]
    });
    expect(rulesOfTags([{ name: "remarks", text: "x" }])).toBeUndefined();
  });

  it("take an intent of several words and strip what can hide text", () => {
    expect(rulesOfTags([{ name: "intent", text: "choose one: a\u202e few\u0007" }])?.intents).toEqual([
      { id: "choose-one", when: "a  few" }
    ]);
  });

  it("take either spelling in a file", () => {
    expect(rulesOfFile('{ "A": { "parents": ["Form"], "intents": ["x: y"] } }').get("A")).toEqual({
      intents: [{ id: "x", when: "y" }],
      parents: ["Form"]
    });
  });

  it("come from a file beside it, and one that cannot be read says nothing", () => {
    const text = JSON.stringify({ RadioGroup: { intent: ["choose-one: few"], parent: "Form" } });
    expect(rulesOfFile(text).get("RadioGroup")).toEqual({
      intents: [{ id: "choose-one", when: "few" }],
      parents: ["Form"]
    });
    expect(rulesOfFile("{ broken").size).toBe(0);
  });

  it("are read with a component's comment", () => {
    const text = "/**\n * @intent choose-one: few\n * @parent Form\n */\nexport const R = () => <a />;";
    expect(scannedComponents("a.tsx", text)[0]?.rules).toEqual({
      intents: [{ id: "choose-one", when: "few" }],
      parents: ["Form"]
    });
  });
});

describe("parents", () => {
  it("names a component under one it may not stand in", () => {
    expect(messages("export const A = () => <Card><Option /></Card>;")).toEqual([
      "Option belongs inside Select, not Card."
    ]);
  });

  it("takes an allowed parent at any depth", () => {
    const free = [ruled("Option", { parents: ["Select"] })];
    expect(messages("export const A = () => <Select><Group><Option /></Group></Select>;", free)).toEqual([]);
  });

  it("leaves alone what a file does not show: the root of a return, or under plain elements only", () => {
    expect(messages("export const A = () => <Option />;")).toEqual([]);
    expect(messages("export const A = () => <div><Option /></div>;")).toEqual([]);
  });

  it("takes a wrapper that renders an allowed parent itself, and passes its children on", () => {
    const system = [
      ruled("Option", { parents: ["Select"] }),
      { ...ruled("MySelect", undefined), renders: ["Select"] }
    ];
    expect(messages("export const A = () => <MySelect><Option /></MySelect>;", system)).toEqual([]);
  });

  it("follows a name imported under another", () => {
    const text = 'import { Option as Row } from "./ui";\nexport const A = () => <Card><Row /></Card>;';
    expect(messages(text)).toEqual(["Option belongs inside Select, not Card."]);
  });
});

describe("children and siblings", () => {
  it("names a component a parent does not take, and leaves plain elements alone", () => {
    expect(messages("export const A = () => <Select><Option /><Card /><div /></Select>;")).toEqual([
      "Select takes Option or Separator inside it, not Card."
    ]);
  });

  it("names what stands beside one that says what may", () => {
    expect(messages("export const A = () => <Bar><Tab /><TabSpacer /><Tab /><Card /></Bar>;")).toEqual([
      "Tab stands beside Tab or TabSpacer, not Card.",
      "Tab stands beside Tab or TabSpacer, not Card."
    ]);
    expect(messages("export const A = () => <><Tab /><Card /></>;")).toEqual([
      "Tab stands beside Tab or TabSpacer, not Card."
    ]);
  });

  it("does not take a condition's other branch for a sibling", () => {
    expect(messages("export const A = () => <Bar>{x ? <Tab /> : <Card />}</Bar>;")).toEqual([]);
  });

  it("names a child added under a parent that was there, and not a child that was there under one added", () => {
    const file = "src/app/a.tsx";
    const text = "export const A = () => (\n<Select>\n<Card />\n</Select>\n);";
    const line = (at: number): AddedLine[] => [{ file, line: at, text: "x" }];
    expect(compositionFindings(line(3), [{ file, text }], SYSTEM).problems).toHaveLength(1);
    expect(compositionFindings(line(2), [{ file, text }], SYSTEM).problems).toEqual([]);
  });

  it("takes a wrapper of an allowed child", () => {
    const system = [...SYSTEM, { ...ruled("MyOption", undefined), renders: ["Option"] }];
    expect(messages("export const A = () => <Select><MyOption /></Select>;", system)).toEqual([]);
  });

  it("reads a list's callback as what stands there, and leaves other markup in it alone", () => {
    expect(
      messages(
        "export const A = () => <Select>{xs.map((x) => { const i = <Card />; return <Option icon={i} />; })}</Select>;"
      )
    ).toEqual([]);
    expect(messages("export const A = () => <Select>{xs.map((x) => <Card />)}</Select>;")).toHaveLength(1);
  });
});

describe("what stands for what is inside it", () => {
  it.each([
    "<Fragment key={1}><Option /></Fragment>",
    "<React.Fragment><Option /></React.Fragment>",
    "<Suspense><Option /></Suspense>",
    "<ThemeProvider><Option /></ThemeProvider>"
  ])("leaves %s alone at a return's root", (element) => {
    expect(messages(`export const A = () => ${element};`)).toEqual([]);
  });

  it("reads a library's parts by their name", () => {
    expect(messages("export const A = () => <Select.Root><Option /></Select.Root>;")).toEqual([]);
    expect(messages("export const A = () => <UI.Select><Option /></UI.Select>;")).toEqual([]);
    expect(messages("export const A = () => <Card><UI.Option /></Card>;")).toEqual([
      "UI.Option belongs inside Select, not Card."
    ]);
    const aliased =
      'import { Select as S } from "./ui";\nexport const A = () => <S.Root><Option /></S.Root>;';
    expect(messages(aliased)).toEqual([]);
  });
});

describe("whose component it is", () => {
  it("does not hold a third party's component of the same name to these rules", () => {
    const text = 'import { Option } from "@radix/select";\nexport const A = () => <Card><Option /></Card>;';
    expect(messages(text)).toEqual([]);
  });

  it("leaves a name given twice when one has no rules, and enforces copies that agree", () => {
    const rules = { parents: ["Select"] };
    const code = "export const A = () => <Card><Option /></Card>;";
    expect(messages(code, [ruled("Option", rules), ruled("Option", undefined, "b.tsx")])).toEqual([]);
    expect(messages(code, [ruled("Option", rules), ruled("Option", rules, "b.tsx")])).toHaveLength(1);
  });
});

describe("what a prop holds", () => {
  it("reads it, as standing nowhere known", () => {
    const code = "export const A = () => <Field render={() => <Card><Option /></Card>} />;";
    expect(messages(code)).toEqual(["Option belongs inside Select, not Card."]);
    expect(messages("export const A = () => <Card footer={<Option />} />;")).toEqual([]);
    expect(messages("export const A = () => <Card footer={<select />} />;")).toEqual([
      "A plain <select>: use Picker."
    ]);
  });
});

describe("plain elements", () => {
  it("names one a component stands in for, except in that component's own file", () => {
    expect(messages("export const A = () => <select />;")).toEqual(["A plain <select>: use Picker."]);
    const file = "src/ui/Picker.tsx";
    const text = "export const Picker = () => <select />;";
    const added = [{ file, line: 1, text }];
    expect(compositionFindings(added, [{ file, text }], SYSTEM).problems).toEqual([]);
  });
});

describe("what cannot be told of a plain element", () => {
  it.each([
    ['<input type="file" />'],
    ['<input type="hidden" />'],
    ["<input hidden />"],
    ["<input {...getInputProps()} />"],
    ['<select className="sr-only" />']
  ])("leaves alone %s, which no component stands in for", (element) => {
    const system = [ruled("Picker", { insteadOf: ["select", "input"] })];
    expect(messages(`export const A = () => ${element};`, system)).toEqual([]);
  });

  it("leaves alone the library's own folder, and one with a folder per component", () => {
    const file = "src/ui/Other.tsx";
    const text = "export const Other = () => <select />;";
    expect(compositionFindings([{ file, line: 1, text }], [{ file, text }], SYSTEM).problems).toEqual([]);
    const own = [ruled("Picker", { insteadOf: ["select"] }, "src/ui/picker/Picker.tsx")];
    const near = "src/ui/combobox/Combobox.tsx";
    expect(
      compositionFindings([{ file: near, line: 1, text }], [{ file: near, text }], own).problems
    ).toEqual([]);
  });
});

describe("what it does not judge", () => {
  it("reads only lines the change adds", () => {
    const file = "src/app/a.tsx";
    const text = "export const A = () => <Card><Option /></Card>;";
    expect(compositionFindings([], [{ file, text }], SYSTEM).problems).toEqual([]);
  });

  it("does nothing with no rules, and with two of a name that hold different rules", () => {
    expect(messages("export const A = () => <Card><Option /></Card>;", [ruled("Card", undefined)])).toEqual(
      []
    );
    const two = [ruled("Option", { parents: ["Select"] }), ruled("Option", { parents: ["Menu"] }, "b.tsx")];
    expect(messages("export const A = () => <Card><Option /></Card>;", two)).toEqual([]);
  });

  it("is not fooled about depth by closers in comments or of another kind", () => {
    expect(isTooDeep(`// ${")".repeat(30_000)}\n${"(".repeat(20_000)}`)).toBe(true);
    expect(isTooDeep("<a>)".repeat(20_000))).toBe(true);
    expect(isTooDeep("(".repeat(100))).toBe(false);
  });

  it("gives nothing for a file it cannot read, or a nesting past what a parser takes", () => {
    expect(messages("export const = ;")).toEqual([]);
    expect(messages(`export const A = () => ${"<b>".repeat(20_000)}${"</b>".repeat(20_000)};`)).toEqual([]);
  });

  it("takes a comment with a reason, and lists it", () => {
    const file = "src/app/a.tsx";
    const text =
      "// forgebook-ignore composition: a preview of the row\nexport const A = () => <Card><Option /></Card>;";
    const added = text.split("\n").map((line, index) => ({ file, line: index + 1, text: line }));
    const { problems, excused } = compositionFindings(added, [{ file, text }], SYSTEM);
    expect(problems).toEqual([]);
    expect(excused).toEqual([{ file, line: 2, rule: "composition", reason: "Option: a preview of the row" }]);
  });
});
