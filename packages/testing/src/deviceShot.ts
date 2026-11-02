/**
 * A story's picture framed in the device its view names, as `forgebook shot` asks for it with a model in the view
 * (`--view iphone-16`): the story pictured at the device's viewport, then drawn in the device (`forgebook/device-picture`).
 *
 * @module
 */
import type { Page } from "@playwright/test";
import { framedPicture, type NamedDevice } from "forgebook/device-picture";

/**
 * Pictures the story a page shows in the device, framed: the page must show it at the device's viewport.
 *
 * @param page - the page, the story opened at the device's viewport.
 * @param device - the device.
 * @param scheme - the story's scheme.
 * @param file - where the picture goes.
 */
export const framedShot = async (
  page: Page,
  device: NamedDevice,
  scheme: "light" | "dark",
  file: string
): Promise<void> => {
  const picture = await page.screenshot({ animations: "disabled" });
  const framed = framedPicture(device, picture.toString("base64"), scheme);
  await page.setViewportSize({ width: framed.width, height: framed.height });
  await page.setContent(framed.html);
  await page.screenshot({ path: file, omitBackground: true, animations: "disabled" });
};
