/**
 * The panel's controls beyond a text or a number, on a real page: nested fields from the types, a list's add, remove and
 * reorder by keyboard, mixed unions, the "no value" state and a reset per field, a search among options, tokens, named
 * values, and every value through the address and back.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** The address of a story of the fixture's component with props of every kind. */
const story = (name: string, query = ""): string =>
  `/?story=sb:storybook-value-props--${name}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** What the story received, as it writes it. */
const received = async (page: Page): Promise<Record<string, unknown>> => {
  const text = await frameOf(page).getByTestId("value-props").textContent();
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
};

/** Waits until the story received this. */
const expectReceived = async (page: Page, expected: Record<string, unknown>): Promise<void> => {
  await expect.poll(() => received(page)).toMatchObject(expected);
};

/** The panel's values, as the address writes them. */
const addressArgs = (page: Page): unknown => {
  const args = new URL(page.url()).searchParams.get("args");
  return args === null ? undefined : JSON.parse(args);
};

/** Opens a story with its frame ready. */
const open = async (page: Page, address: string): Promise<void> => {
  await page.goto(address);
  await expect(frameOf(page).getByTestId("value-props")).toBeVisible();
};

test.describe("the panel's controls for values of any shape", () => {
  test("draws a readonly list and an object from their types, and sends what is edited", async ({ page }) => {
    await open(page, story("filled"));
    await expect(page.getByRole("textbox", { name: "tags 2", exact: true })).toHaveValue("due");
    await page.getByRole("textbox", { name: "tags 2", exact: true }).fill("döi");
    await expectReceived(page, { tags: ["uno", "döi", "tre"] });
    await page.getByRole("textbox", { name: "address city" }).fill("Roma");
    await expectReceived(page, { address: { street: "Via Roma", city: "Roma" } });
    await page.getByRole("spinbutton", { name: "address floor" }).fill("2");
    await expectReceived(page, { address: { street: "Via Roma", city: "Roma", floor: 2 } });
    // an optional field can go away again
    await page.getByRole("button", { name: "address city: no value" }).click();
    await expect
      .poll(() => received(page))
      .toEqual(expect.objectContaining({ address: { street: "Via Roma", floor: 2 } }));
  });

  test("adds, removes and moves a list's items with the keyboard, the focus following", async ({ page }) => {
    await open(page, story("filled"));
    const down = page.getByRole("button", { name: "Move tags 1 down" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expectReceived(page, { tags: ["due", "uno", "tre"] });
    // the same item, one place down: another Enter goes on moving it
    await expect(page.getByRole("button", { name: "Move tags 2 down" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expectReceived(page, { tags: ["due", "tre", "uno"] });
    await expect(page.getByRole("status").filter({ hasText: "now 3 of 3" })).toBeAttached();
    await page.getByRole("button", { name: "Remove tags 2" }).focus();
    await page.keyboard.press("Enter");
    await expectReceived(page, { tags: ["due", "uno"] });
    await expect(page.getByRole("button", { name: "Remove tags 2" })).toBeFocused();
    await page.getByRole("button", { name: "Add to tags" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "tags 3", exact: true }).fill("nuovo");
    await expectReceived(page, { tags: ["due", "uno", "nuovo"] });
  });

  test("an item of a list of objects starts with what its required fields must hold", async ({ page }) => {
    await open(page, story("filled"));
    await page.getByRole("button", { name: "Add to rows" }).click();
    await expectReceived(page, { rows: [{ id: 0, label: "" }] });
    await page.getByRole("textbox", { name: "rows 1 label" }).fill("primo");
    await page.getByRole("checkbox", { name: "rows 1 isDone" }).check();
    await expectReceived(page, { rows: [{ id: 0, label: "primo", isDone: true }] });
  });

  test("a mixed union chooses its type, then its value", async ({ page }) => {
    await open(page, story("filled"));
    await page.getByRole("group", { name: "size: type" }).getByText("Number").click();
    await expectReceived(page, { size: 0 });
    await page.getByRole("spinbutton", { name: "size", exact: true }).fill("24");
    await expectReceived(page, { size: 24 });
    await page.getByRole("group", { name: "size: type" }).getByText("Choice").click();
    await expectReceived(page, { size: "sm" });
    await page.getByRole("combobox", { name: "size", exact: true }).selectOption("md");
    await expectReceived(page, { size: "md" });
  });

  test("every kind of value comes back from the address: non-ASCII, nested and in lists", async ({
    page
  }) => {
    await open(page, story("empty"));
    await page.getByRole("button", { name: "Add to tags" }).click();
    await page.getByRole("textbox", { name: "tags 1", exact: true }).fill("日本語 ü 👩🏽‍💻 & = ? #");
    await page.getByRole("textbox", { name: "address street" }).fill('Città "nuova" 名前');
    await page.getByRole("group", { name: "size: type" }).getByText("Number").click();
    await page.getByRole("spinbutton", { name: "bounds 1" }).fill("-1.5");
    await page.getByRole("button", { name: "Add to rows" }).click();
    await page.getByRole("textbox", { name: "note" }).fill("una\nriga\n二");
    const expected = {
      tags: ["日本語 ü 👩🏽‍💻 & = ? #"],
      address: { street: 'Città "nuova" 名前' },
      size: 0,
      bounds: [-1.5, 0],
      rows: [{ id: 0, label: "" }],
      note: "una\nriga\n二"
    };
    await expectReceived(page, expected);
    expect(addressArgs(page)).toEqual(expected);
    await page.reload();
    await expect(frameOf(page).getByTestId("value-props")).toBeVisible();
    await expectReceived(page, expected);
    await expect(page.getByRole("textbox", { name: "note" })).toHaveValue("una\nriga\n二");
    await expect(page.getByRole("textbox", { name: "tags 1", exact: true })).toHaveValue(
      "日本語 ü 👩🏽‍💻 & = ? #"
    );
  });

  test("a link's object naming a field its type does not declare is left out and said", async ({ page }) => {
    const args = encodeURIComponent(
      JSON.stringify({ address: { street: "x", onclick: "alert(1)" }, tags: ["ok"] })
    );
    await open(page, story("empty", `args=${args}`));
    await expectReceived(page, { tags: ["ok"] });
    expect((await received(page))["address"]).toBeUndefined();
    await expect(page.getByText("address", { exact: false }).first()).toBeVisible();
  });

  test("a value with a prototype's name or nesting too deep is not read at all", async ({ page }) => {
    const deep = `${"[".repeat(40)}${"]".repeat(40)}`;
    await open(page, story("empty", `args=${encodeURIComponent(`{"tags":["ok"],"payload":${deep}}`)}`));
    await expectReceived(page, { tags: ["ok"] });
    expect((await received(page))["payload"]).toBeUndefined();
  });

  test("no value, an empty text and the story's own value are three states", async ({ page }) => {
    await open(page, story("filled"));
    const title = page.getByRole("textbox", { name: "title" });
    // emptied, the text is an empty text: not the story's own, not nothing
    await title.fill("");
    await expectReceived(page, { title: "" });
    await expect(page.locator(".forgebook-prop", { has: title }).getByText("empty text")).toBeVisible();
    // no value: the story receives nothing, and the address says so
    await page.getByRole("button", { name: "title: leave without a value" }).click();
    await expect.poll(async () => Object.keys(await received(page))).not.toContain("title");
    expect(new URL(page.url()).searchParams.get("args")).toBe('{"title":{"forgebookUnset":true}}');
    await page.reload();
    await expect(frameOf(page).getByTestId("value-props")).toBeVisible();
    await expect.poll(async () => Object.keys(await received(page))).not.toContain("title");
    // the field's own reset: back to the story's, the other props untouched
    await page.getByRole("spinbutton", { name: "count" }).fill("7");
    await expectReceived(page, { count: 7 });
    await page.getByRole("button", { name: "title: back to the story's value" }).click();
    await expectReceived(page, { title: "Città del Vaticano", count: 7 });
    // Reset takes them all
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expectReceived(page, { title: "Città del Vaticano", count: 3 });
    expect(addressArgs(page)).toBeUndefined();
  });

  test("a number can be cleared", async ({ page }) => {
    await open(page, story("filled"));
    await page.getByRole("spinbutton", { name: "count" }).fill("");
    await expect.poll(async () => Object.keys(await received(page))).not.toContain("count");
    await expect(page.getByRole("spinbutton", { name: "count" })).toHaveValue("");
  });

  test("a long choice is searched, with the keyboard", async ({ page }) => {
    await open(page, story("empty"));
    const country = page.getByRole("combobox", { name: "country" });
    await country.click();
    await expect(page.getByRole("listbox", { name: "country: options" }).getByRole("option")).toHaveCount(16);
    await country.fill("ita");
    await expect(page.getByRole("option", { name: "Italy" })).toBeVisible();
    await expect(page.getByRole("option", { name: "France" })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expectReceived(page, { country: "Italy" });
    await expect(country).toHaveValue("Italy");
  });

  test("an icon and a slot are picked among the source's named values", async ({ page }) => {
    await open(page, story("empty"));
    const icon = page.getByRole("combobox", { name: "icon" });
    await icon.click();
    await page.getByRole("option", { name: "Heart" }).click();
    await expect(frameOf(page).getByTestId("value-icon")).toHaveText("♥");
    const slot = page.locator(".forgebook-prop", { has: page.getByRole("group", { name: "slot: type" }) });
    await slot.getByText("Text", { exact: true }).click();
    await slot.getByRole("textbox", { name: "slot" }).fill("una scritta");
    await expect(frameOf(page).getByTestId("value-slot")).toHaveText("una scritta");
    await slot.getByText("Named", { exact: true }).click();
    await expect(frameOf(page).getByTestId("value-slot")).toHaveText("A named node");
    await page.reload();
    await expect(frameOf(page).getByTestId("value-icon")).toHaveText("♥");
    await expect(frameOf(page).getByTestId("value-slot")).toHaveText("A named node");
  });

  test("a prop that asks for tokens offers the catalogue's", async ({ page }) => {
    await open(page, story("empty"));
    const accent = page.getByRole("combobox", { name: "accent" });
    await accent.click();
    await expect(page.getByRole("option", { name: /color\.accent/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /space\./ })).toHaveCount(0);
    await page.getByRole("option", { name: /color\.accent/ }).click();
    await expectReceived(page, { accent: "#5a2aa0" });
  });

  test("a token control offers a name's part, and writes the format it gives", async ({ page }) => {
    await open(page, story("with-tokens"));
    const space = page.getByRole("combobox", { name: "title" });
    await space.click();
    await page.getByRole("option", { name: /space\.large/ }).click();
    await expectReceived(page, { title: "16px" });
    const radius = page.getByRole("combobox", { name: "note" });
    await radius.click();
    await page.getByRole("option", { name: /radius\.card/ }).click();
    await expectReceived(page, { note: "var(--radius-card)" });
  });

  test("JSON takes what fields cannot show, and says why it refuses", async ({ page }) => {
    await open(page, story("empty"));
    const payload = page.getByRole("textbox", { name: "payload" });
    await payload.fill('{"deep": [1, {"two": null}], "名": "値"}');
    await expectReceived(page, {
      payload: { deep: [1, { two: null }], ...Object.fromEntries([["名", "値"]]) }
    });
    await payload.fill("{nope");
    await expect(page.getByRole("alert").filter({ hasText: "Not valid JSON" })).toBeVisible();
    await expectReceived(page, {
      payload: { deep: [1, { two: null }], ...Object.fromEntries([["名", "値"]]) }
    });
    await page.getByRole("button", { name: "Edit address as JSON" }).click();
    const address = page.getByRole("textbox", { name: "address", exact: true });
    await address.fill('{"street": 3}');
    await expect(page.getByRole("alert").filter({ hasText: "not what this prop takes" })).toBeVisible();
    await address.fill('{"street": "Via Po"}');
    await expectReceived(page, { address: { street: "Via Po" } });
  });

  test("a file is kept as a small data address, and a large one is refused", async ({ page }) => {
    await open(page, story("named-controls"));
    const input = page.getByLabel("payload: choose files", { exact: true });
    await input.setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: Buffer.from("tiny") });
    await expect.poll(() => received(page)).toMatchObject({ payload: ["data:image/png;base64,dGlueQ=="] });
    await page.reload();
    await expect.poll(() => received(page)).toMatchObject({ payload: ["data:image/png;base64,dGlueQ=="] });
    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(20_000) });
    await expect(page.getByRole("alert").filter({ hasText: "big.png is too large" })).toBeVisible();
  });

  test("the worst case fills nested fields and lists, and Compare's frames all receive them", async ({
    page
  }) => {
    await page.goto(story("filled", "compare=theme"));
    // a list's worst case comes with the module that reads its shape, with the fields
    await expect(page.getByRole("button", { name: "Add to tags" })).toBeVisible();
    // the story's `argTypes` and the module that reads a shape each add to it as they arrive: the button comes back for them
    const worst = page.getByRole("button", { name: "Worst case" });
    await expect(async () => {
      if (await worst.isEnabled()) await worst.click();
      expect(addressArgs(page)).toMatchObject({ address: { street: expect.stringContaining("Supercali") } });
    }).toPass();
    await expect(page.getByRole("button", { name: "Worst case" })).toBeDisabled();
    const frames = page.locator("iframe.forgebook-frame-view");
    await expect.poll(() => frames.count()).toBeGreaterThan(1);
    for (const index of [0, 1]) {
      await expect(
        page.frameLocator("iframe.forgebook-frame-view").nth(index).getByTestId("value-props")
      ).toContainText("Supercali");
    }
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByRole("button", { name: "Worst case" })).toBeEnabled();
  });

  test("a Date prop is set as a moment, reaches the story as a Date, and comes back from the link", async ({
    page
  }) => {
    await open(page, story("empty"));
    await page.getByRole("textbox", { name: "startsAt" }).fill("2026-03-04T05:06");
    await expect(frameOf(page).getByTestId("value-date")).toHaveText("a Date");
    await expect.poll(() => addressArgs(page)).toHaveProperty("startsAt.forgebookDate");
    await page.reload();
    await expect(frameOf(page).getByTestId("value-date")).toHaveText("a Date");
    await expect(page.getByRole("textbox", { name: "startsAt" })).toHaveValue("2026-03-04T05:06");
  });

  test("an embed checks a link's values as the page does", async ({ page }) => {
    const args = JSON.stringify({ tags: ["ü"], address: { street: "x", onclick: "y" }, innerHTML: "<b>" });
    await page.goto(`/?embed&story=sb:storybook-value-props--filled&args=${encodeURIComponent(args)}`);
    await expect.poll(() => received(page)).toMatchObject({ tags: ["ü"], address: { street: "Via Roma" } });
    expect(await received(page)).not.toHaveProperty("innerHTML");
    await expect(page.locator(".forgebook-dropped-args")).toContainText("innerHTML");
    await expect(page.locator(".forgebook-dropped-args")).toContainText("address");
  });

  test("a plain catalogue page loads no editor", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/?story=sb:components-button--primary");
    await expect(frameOf(page).locator("button").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Props" })).toBeVisible();
    expect(requests.filter((url) => /valueEditors|shapeValues/.test(url))).toEqual([]);
  });
});

test.describe("the panel's order", () => {
  test("lists the props as the source declares them, whatever their control", async ({ page }) => {
    await page.goto("/?story=sb:components-button--primary&tab=props");
    const tab = page.locator(".forgebook-tab-props");
    await tab.getByRole("switch", { name: "Required first" }).uncheck();
    // a text, two choices, a text: grouped by control, the choices would lead
    await expect(tab.locator(".forgebook-prop__name")).toHaveText([
      "label*",
      "variant",
      "size",
      "backgroundColor"
    ]);
  });
});

test.describe("the panel's actions", () => {
  test("Reset and Worst case stay at the bottom of the panel while the props scroll, the last prop above them", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await open(page, story("filled", "tab=props"));
    const body = page.locator(".forgebook-dock__body");
    const foot = page.locator(".forgebook-tab-foot");
    const lastGroup = page.locator(".forgebook-tab-props > :nth-last-child(2)");
    await expect(foot.getByRole("button", { name: "Reset" })).toBeVisible();
    // the story's props must be more than the panel holds, or nothing here scrolls
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    /** How far the bar's bottom is from the panel's visible bottom, in pixels. */
    const gapBelowFoot = (): Promise<number> =>
      page.evaluate(() => {
        const scroller = document.querySelector(".forgebook-dock__body");
        const bar = document.querySelector(".forgebook-tab-foot");
        if (scroller === null || bar === null) return Number.NaN;
        return Math.abs(scroller.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom);
      });
    await expect(foot).toBeInViewport({ ratio: 1 });
    expect(await gapBelowFoot()).toBeLessThan(1);
    await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(foot).toBeInViewport({ ratio: 1 });
    expect(await gapBelowFoot()).toBeLessThan(1);
    const footTop = (await foot.boundingBox())?.y ?? 0;
    const lastBox = await lastGroup.boundingBox();
    expect((lastBox?.y ?? Number.POSITIVE_INFINITY) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(footTop);
  });
});
