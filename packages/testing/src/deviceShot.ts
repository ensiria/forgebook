/**
 * A story's picture framed in the device its view names, as `forgebook shot` asks for it with a model in the view
 * (`--view iphone-16`): the story pictured at the device's viewport, then drawn in the device (`forgebook/device-picture`).
 *
 * @module
 */
import type { Page } from "@playwright/test";
import { framedPicture, type NamedDevice } from "forgebook/device-picture";

/**
 * Pictures the story a page shows in the device, framed: the page must show it at the device's story area.
 *
 * @param page - the page, the story opened at its area's size (`deviceViewport`).
 * @param device - the device.
 * @param isEdgeToEdge - whether the story draws edge to edge.
 * @param scheme - the story's scheme.
 * @param file - where the picture goes.
 */
export const framedShot = async (
  page: Page,
  device: NamedDevice,
  isEdgeToEdge: boolean,
  scheme: "light" | "dark",
  file: string
): Promise<void> => {
  const picture = await page.screenshot({ animations: "disabled" });
  // the screen around a story inside the safe areas takes its page's colour, as the shell's frame does
  const background = await page.evaluate(() => {
    const colour = (element: Element): string => getComputedStyle(element).backgroundColor;
    const body = colour(document.body);
    return body === "rgba(0, 0, 0, 0)" ? colour(document.documentElement) : body;
  });
  const framed = framedPicture({
    shown: device,
    isEdgeToEdge,
    picture: picture.toString("base64"),
    scheme,
    background
  });
  await page.setViewportSize({ width: framed.width, height: framed.height });
  await page.setContent(framed.html);
  await page.screenshot({ path: file, omitBackground: true, animations: "disabled" });
};
