/**
 * Whether a story's picture shows one colour and nothing else: what no check of the page can tell, since an input with no
 * look of its own has a size and draws nothing.
 *
 * @remarks
 * Reads PNG as Chromium writes it, 8 bits per channel, with Node's own zlib, so the core adds no decoder. A file it cannot read
 * counts as showing something: this only ever takes a story from "drew" to "try another".
 *
 * @module
 */
import { inflateSync } from "node:zlib";

/** A PNG's signature, and where its header's fields sit. */
const HEADER_START = 8;

/** The bytes per pixel of the colour types Chromium writes: true colour, and with alpha. */
const BYTES_PER_PIXEL: Readonly<Record<number, number>> = { 2: 3, 6: 4 };

/** The chunks of a PNG: its header's fields, and its image data joined. */
const readChunks = (
  file: Buffer
): { readonly width: number; readonly height: number; readonly type: number; readonly data: Buffer } => {
  const parts: Buffer[] = [];
  let position = HEADER_START;
  let width = 0;
  let height = 0;
  let type = -1;
  while (position + 8 <= file.length) {
    const length = file.readUInt32BE(position);
    const name = file.toString("latin1", position + 4, position + 8);
    const start = position + 8;
    if (name === "IHDR") {
      width = file.readUInt32BE(start);
      height = file.readUInt32BE(start + 4);
      type = file.readUInt8(start + 9);
    }
    if (name === "IDAT") parts.push(file.subarray(start, start + length));
    position = start + length + 4;
  }
  return { width, height, type, data: inflateSync(Buffer.concat(parts)) };
};

/** PNG's Paeth predictor. */
const paeth = (left: number, up: number, corner: number): number => {
  const estimate = left + up - corner;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toCorner = Math.abs(estimate - corner);
  if (toLeft <= toUp && toLeft <= toCorner) return left;
  return toUp <= toCorner ? up : corner;
};

/** A row's byte before its filter: the filter's prediction added back. */
const predicted = (filter: number, left: number, up: number, corner: number): number => {
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  return filter === 4 ? paeth(left, up, corner) : 0;
};

/** A row with its filter undone, from the row above and where the row starts in the image data. */
const unfilteredRow = (
  data: Buffer,
  start: number,
  stride: number,
  pixel: number,
  previous: Buffer
): Buffer => {
  const filter = data.readUInt8(start);
  const row = Buffer.alloc(stride);
  for (let index = 0; index < stride; index += 1) {
    const left = index >= pixel ? (row[index - pixel] ?? 0) : 0;
    const corner = index >= pixel ? (previous[index - pixel] ?? 0) : 0;
    const raw = data[start + 1 + index] ?? 0;
    row[index] = (raw + predicted(filter, left, previous[index] ?? 0, corner)) & 255;
  }
  return row;
};

/** Whether every pixel of a row is the colour. */
const isRowOf = (row: Buffer, colour: Buffer): boolean =>
  row.every((value, index) => value === colour[index % colour.length]);

/**
 * Whether a PNG is one colour.
 *
 * @param file - the file's bytes.
 * @returns the answer; `false` for one it cannot read.
 */
export const isUniformPicture = (file: Buffer): boolean => {
  try {
    const { width, height, type, data } = readChunks(file);
    const pixel = BYTES_PER_PIXEL[type];
    if (pixel === undefined || width === 0 || height === 0) return false;
    const stride = width * pixel;
    let previous: Buffer = Buffer.alloc(stride);
    let colour: Buffer | undefined;
    for (let row = 0; row < height; row += 1) {
      previous = unfilteredRow(data, row * (stride + 1), stride, pixel, previous);
      colour ??= previous.subarray(0, pixel);
      if (!isRowOf(previous, colour)) return false;
    }
    return true;
  } catch {
    return false;
  }
};
