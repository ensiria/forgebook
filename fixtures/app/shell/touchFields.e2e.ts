/**
 * The simulated finger on editable fields: a tap focuses the field and puts the caret where it landed, as a real finger
 * does; a drag, a long press and a cancelled tap do not.
 *
 * @module
 */
import { expect, type FrameLocator, type Locator, type Page, test } from "@playwright/test";

/** The fields' story, with the Touch switch on. */
const STORY = "/?story=kit:interaction-touch-fields--overview&touch=touch";

/** How wide every text field is, in characters of its fixed-width font. */
const FIELD_CH = 30;

/** The story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Opens the story, and waits for it and for the simulation that follows the Touch switch. */
const open = async (page: Page): Promise<FrameLocator> => {
  await page.goto(STORY);
  const frame = frameOf(page);
  await expect(frame.locator("html")).toHaveAttribute("data-forgebook-touch", "touch");
  await expect(frame.getByRole("textbox", { name: "Text", exact: true })).toBeVisible();
  // a dot is drawn once the simulation runs: it loads apart from the frame
  await page.mouse.move(5, 5);
  await frame.locator("body").hover({ force: true });
  await expect(frame.locator(".forgebook-touch-dot:not([hidden])")).toHaveCount(1);
  return frame;
};

/** The point in the first line of a text field at the gap before a character, in the page. */
const pointAt = async (field: Locator, character: number): Promise<{ x: number; y: number }> => {
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox();
  if (box === null) throw new Error("the field is not drawn");
  return { x: box.x + (box.width / FIELD_CH) * character, y: box.y + 8 };
};

/** Taps a text field at the gap before a character. */
const tapAt = async (page: Page, field: Locator, character: number): Promise<void> => {
  const point = await pointAt(field, character);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
};

/** Whether the field holds the focus, across its frame and any shadow root. */
const isFocused = (field: Locator): Promise<boolean> =>
  field.evaluate((element) => {
    const root = element.getRootNode();
    return (root instanceof Document || root instanceof ShadowRoot) && root.activeElement === element;
  });

/** Where an input's or a textarea's caret is: its selection's two ends. */
const selectionOf = (field: Locator): Promise<(number | null)[]> =>
  field.evaluate((element) =>
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? [element.selectionStart, element.selectionEnd]
      : []
  );

/** The events the story's log lists. */
const logOf = (frame: FrameLocator): Promise<string[]> =>
  frame.getByRole("list", { name: "Field events" }).getByRole("listitem").allTextContents();

test.describe("touch on a field", () => {
  test("a tap on an input focuses it, puts the caret there, and the keyboard types there", async ({
    page
  }) => {
    const frame = await open(page);
    const input = frame.getByRole("textbox", { name: "Text", exact: true });
    await tapAt(page, input, 5);
    await expect.poll(() => isFocused(input)).toBe(true);
    expect(await selectionOf(input)).toEqual([5, 5]);
    // a tap in the field it already holds moves the caret
    await tapAt(page, input, 8);
    await expect.poll(() => selectionOf(input)).toEqual([8, 8]);
    await page.keyboard.type("X");
    await expect(input).toHaveValue("01234567X89abcdefghij");
  });

  test("a tap on a textarea puts the caret on the tapped line", async ({ page }) => {
    const frame = await open(page);
    const textarea = frame.getByRole("textbox", { name: "Textarea" });
    await tapAt(page, textarea, 5);
    await expect.poll(() => isFocused(textarea)).toBe(true);
    expect(await selectionOf(textarea)).toEqual([5, 5]);
    const box = await textarea.boundingBox();
    if (box === null) throw new Error("the field is not drawn");
    const point = await pointAt(textarea, 3);
    await page.mouse.move(point.x, box.y + box.height - 8);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => selectionOf(textarea)).toEqual([24, 24]);
  });

  test("a tap on a contenteditable puts the caret in its text, marks included", async ({ page }) => {
    const frame = await open(page);
    const selectionIn = (field: Locator): Promise<(string | number | boolean | null)[]> =>
      field.evaluate((element) => {
        const selection = element.ownerDocument.getSelection();
        return [
          selection?.anchorNode?.textContent ?? null,
          selection?.anchorOffset ?? null,
          selection?.isCollapsed ?? null
        ];
      });
    const plain = frame.getByTestId("editable");
    await tapAt(page, plain, 5);
    await expect.poll(() => isFocused(plain)).toBe(true);
    expect(await selectionIn(plain)).toEqual(["0123456789abcdefghij", 5, true]);
    const marked = frame.getByTestId("editable-marks");
    await tapAt(page, marked, 7);
    await expect.poll(() => isFocused(marked)).toBe(true);
    expect(await selectionIn(marked)).toEqual(["56789", 2, true]);
    await page.keyboard.type("X");
    await expect(marked.locator("b")).toHaveText("56X789");
  });

  test("the fields without a selection of their own take the caret too, and a long field's scroll counts", async ({
    page
  }) => {
    const frame = await open(page);
    const email = frame.getByRole("textbox", { name: "Email" });
    await tapAt(page, email, 5);
    await expect.poll(() => isFocused(email)).toBe(true);
    await page.keyboard.type("X");
    await expect(email).toHaveValue("01234X56789abcdefghij");
    const number = frame.getByRole("spinbutton", { name: "Number" });
    await tapAt(page, number, 5);
    await expect.poll(() => isFocused(number)).toBe(true);
    await page.keyboard.type("0");
    await expect(number).toHaveValue("12345067890");
    const long = frame.getByRole("textbox", { name: "Long" });
    await long.evaluate((element) => {
      element.scrollLeft = 120;
    });
    const characterWidth = await long.evaluate((element) => element.getBoundingClientRect().width / 30);
    const scrolledBy = Math.round(120 / characterWidth);
    await tapAt(page, long, 5);
    await expect.poll(() => selectionOf(long)).toEqual([5 + scrolledBy, 5 + scrolledBy]);
  });

  test("a read-only field takes the caret, a disabled one nothing", async ({ page }) => {
    const frame = await open(page);
    const readOnly = frame.getByRole("textbox", { name: "Read only" });
    await tapAt(page, readOnly, 5);
    await expect.poll(() => isFocused(readOnly)).toBe(true);
    expect(await selectionOf(readOnly)).toEqual([5, 5]);
    const disabled = frame.getByRole("textbox", { name: "Disabled" });
    await tapAt(page, disabled, 5);
    expect(await isFocused(disabled)).toBe(false);
  });

  test("inside a shadow root too", async ({ page }) => {
    const frame = await open(page);
    const input = frame.getByRole("textbox", { name: "Shadow input" });
    await tapAt(page, input, 5);
    await expect.poll(() => isFocused(input)).toBe(true);
    expect(await selectionOf(input)).toEqual([5, 5]);
    const editable = frame.getByTestId("shadow-editable");
    await tapAt(page, editable, 5);
    await expect.poll(() => isFocused(editable)).toBe(true);
    await page.keyboard.type("X");
    await expect(editable).toHaveText("01234X56789abcdefghij");
    await tapAt(page, frame.getByText("A shadow label"), 1);
    await expect.poll(() => isFocused(frame.getByTestId("shadow-labelled"))).toBe(true);
  });

  test("a focus handler that shortens the text leaves the tap whole", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const frame = await open(page);
    const field = frame.getByTestId("editable-shrinks");
    await tapAt(page, field, 15);
    await expect.poll(() => isFocused(field)).toBe(true);
    await expect.poll(async () => (await logOf(frame)).at(-1)).toBe("click touch");
    expect(await logOf(frame)).toContain("mouseup");
    expect(errors).toEqual([]);
  });

  test("a story's events stay a finger's, with the focus where a tap has it", async ({ page }) => {
    const frame = await open(page);
    const input = frame.getByRole("textbox", { name: "Text", exact: true });
    await tapAt(page, input, 5);
    await expect
      .poll(() => logOf(frame))
      .toEqual([
        "pointerdown touch",
        "touchstart",
        "pointerup touch",
        "touchend",
        "mousedown",
        "focusin",
        "mouseup",
        "click touch"
      ]);
  });

  test("a drag and a long press do not focus the field", async ({ page }) => {
    const frame = await open(page);
    const input = frame.getByRole("textbox", { name: "Text", exact: true });
    const point = await pointAt(input, 5);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 60, point.y);
    await page.mouse.up();
    expect(await isFocused(input)).toBe(false);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect.poll(async () => (await logOf(frame)).includes("contextmenu")).toBe(true);
    await page.mouse.up();
    expect(await isFocused(input)).toBe(false);
  });

  test("a handler that cancels the tap keeps the focus away, as on a phone", async ({ page }) => {
    const frame = await open(page);
    for (const name of ["Cancels pointerdown", "Cancels mousedown", "Cancels touchend"]) {
      const field = frame.getByRole("textbox", { name });
      await tapAt(page, field, 5);
      await expect.poll(async () => (await logOf(frame)).at(-1)).toMatch(/click|touchend/);
      expect(await isFocused(field), name).toBe(false);
    }
    // a field inside a label: the click still activates the label, which does nothing for what it holds
    const wrapped = frame.getByTestId("wrapped");
    await tapAt(page, wrapped, 1);
    await expect.poll(async () => (await logOf(frame)).at(-1)).toBe("click touch");
    expect(await isFocused(wrapped)).toBe(false);
  });

  test("controls without a caret and labels behave as they did, and plain text stays unselected", async ({
    page
  }) => {
    const frame = await open(page);
    const checkbox = frame.getByRole("checkbox", { name: "Checkbox" });
    await checkbox.scrollIntoViewIfNeeded();
    const box = await checkbox.boundingBox();
    if (box === null) throw new Error("the checkbox is not drawn");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(checkbox).toBeChecked();
    const label = frame.getByText("A label");
    await label.scrollIntoViewIfNeeded();
    const labelBox = await label.boundingBox();
    if (labelBox === null) throw new Error("the label is not drawn");
    await page.mouse.move(labelBox.x + 4, labelBox.y + 4);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => isFocused(frame.getByRole("textbox", { name: "Labelled" }))).toBe(true);
    const plain = frame.getByTestId("plain");
    await plain.scrollIntoViewIfNeeded();
    const plainBox = await plain.boundingBox();
    if (plainBox === null) throw new Error("the text is not drawn");
    await page.mouse.move(plainBox.x + 5, plainBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(plainBox.x + 200, plainBox.y + 8);
    await page.mouse.up();
    expect(await plain.evaluate((element) => element.ownerDocument.getSelection()?.toString())).toBe("");
  });
});
