/**
 * An image's size, read from its first bytes: what Next.js gives a statically imported image
 * (`import hero from "./hero.png"` is `{ src, width, height }`), so `<Image src={hero} />` needs no size written.
 *
 * @remarks
 * Pure: bytes in, size out. Reads PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG, the formats Next.js imports as images;
 * an SVG without a size reads its `viewBox`.
 *
 * @module
 */

/** An image's size, in pixels. */
export type ImageSize = {
  /** Its width. */
  readonly width: number;
  /** Its height. */
  readonly height: number;
};

/**
 * Whether the bytes start with a text.
 *
 * @param bytes - the bytes.
 * @param text - the text, in ASCII.
 * @param at - where it starts.
 */
const hasText = (bytes: Uint8Array, text: string, at = 0): boolean =>
  [...text].every((character, index) => bytes[at + index] === character.charCodeAt(0));

/** A PNG's size: its `IHDR` chunk, first. */
const pngSize = (view: DataView): ImageSize => ({ width: view.getUint32(16), height: view.getUint32(20) });

/** A GIF's size: its logical screen. */
const gifSize = (view: DataView): ImageSize => ({
  width: view.getUint16(6, true),
  height: view.getUint16(8, true)
});

/** A BMP's size: its info header (a height is negative for a top-down image). */
const bmpSize = (view: DataView): ImageSize => ({
  width: view.getInt32(18, true),
  height: Math.abs(view.getInt32(22, true))
});

/** An ICO's size: its first image, where 0 means 256. */
const icoSize = (view: DataView): ImageSize => ({
  width: view.getUint8(6) === 0 ? 256 : view.getUint8(6),
  height: view.getUint8(7) === 0 ? 256 : view.getUint8(7)
});

/**
 * A JPEG's size: the first start-of-frame segment's.
 *
 * @param view - the bytes.
 */
const jpegSize = (view: DataView): ImageSize | undefined => {
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return undefined;
    const marker = view.getUint8(offset + 1);
    // every start of frame but DHT (C4), JPG (C8) and DAC (CC)
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    offset += 2 + view.getUint16(offset + 2);
  }
  return undefined;
};

/**
 * A WebP's size: from its lossy, lossless or extended header.
 *
 * @param bytes - the bytes.
 * @param view - the same bytes.
 */
const webpSize = (bytes: Uint8Array, view: DataView): ImageSize | undefined => {
  if (hasText(bytes, "VP8 ", 12))
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (hasText(bytes, "VP8L", 12)) {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (hasText(bytes, "VP8X", 12)) {
    const width = 1 + (view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16));
    const height = 1 + (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16));
    return { width, height };
  }
  return undefined;
};

/**
 * An AVIF's size: its first `ispe` box (the image's spatial extent).
 *
 * @param bytes - the bytes.
 * @param view - the same bytes.
 */
const avifSize = (bytes: Uint8Array, view: DataView): ImageSize | undefined => {
  for (let offset = 0; offset + 16 <= bytes.length; offset += 1) {
    if (hasText(bytes, "ispe", offset))
      return { width: view.getUint32(offset + 8), height: view.getUint32(offset + 12) };
  }
  return undefined;
};

/**
 * A length of an SVG's attribute, in pixels: a number with no unit or `px`.
 *
 * @param tag - the root element's start tag.
 * @param name - the attribute.
 */
const svgLength = (tag: string, name: string): number | undefined => {
  const match = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`).exec(tag);
  return match?.[1] === undefined ? undefined : Number(match[1]);
};

/**
 * An SVG's size: its `width` and `height`, or its `viewBox`'s.
 *
 * @param text - the SVG's text.
 */
const svgSize = (text: string): ImageSize | undefined => {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (tag === undefined) return undefined;
  const viewBox = /\sviewBox\s*=\s*["']([^"']+)["']/i
    .exec(tag)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const boxWidth = viewBox?.[2];
  const boxHeight = viewBox?.[3];
  const width = svgLength(tag, "width") ?? boxWidth;
  const height = svgLength(tag, "height") ?? boxHeight;
  if (width === undefined || height === undefined || Number.isNaN(width) || Number.isNaN(height))
    return undefined;
  return { width: Math.round(width), height: Math.round(height) };
};

/**
 * An image's size, read from its bytes.
 *
 * @param bytes - the image file's bytes.
 * @returns its size, or none for a format it does not read or a file it cannot.
 */
export const imageSize = (bytes: Uint8Array): ImageSize | undefined => {
  if (bytes.length < 30) return svgSize(new TextDecoder().decode(bytes));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (hasText(bytes, "\x89PNG")) return pngSize(view);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(view);
  if (hasText(bytes, "GIF8")) return gifSize(view);
  if (hasText(bytes, "RIFF") && hasText(bytes, "WEBP", 8)) return webpSize(bytes, view);
  if (hasText(bytes, "ftyp", 4)) return avifSize(bytes, view);
  if (hasText(bytes, "BM")) return bmpSize(view);
  if (view.getUint16(0, true) === 0 && view.getUint16(2, true) === 1) return icoSize(view);
  return svgSize(new TextDecoder().decode(bytes));
};
