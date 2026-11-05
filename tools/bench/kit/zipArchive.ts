/**
 * A zip archive, written in memory: the bench kit's results file, which the person running it sends back.
 *
 * @remarks
 * Node has deflate and CRC-32 but no zip container, and the kit installs nothing it does not need, so the container is
 * written here: local headers, the central directory and its end record, as the format's specification lays them out
 * (no ZIP64: the results are a few megabytes). Names are UTF-8, flagged as such. Pure.
 *
 * @module
 */
import { crc32, deflateRawSync } from "node:zlib";

/** A file of the archive. */
export type ZipEntry = {
  /** Its path in the archive, with `/` between folders. */
  readonly name: string;
  /** Its content. */
  readonly data: Buffer;
};

/** Bit 11 of the general purpose flags: the name is UTF-8. */
const UTF8_NAMES = 0x0800;

/** The compression method of deflate. */
const DEFLATE = 8;

/** The version needed to extract a deflated file: 2.0. */
const VERSION = 20;

/** A date in MS-DOS form: the time and the date, two 16-bit words, two-second steps, from 1980. */
const dosDateTime = (date: Date): { readonly time: number; readonly day: number } => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  day: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
});

/**
 * The archive of these files.
 *
 * @param entries - the files, in the order they are written.
 * @param date - the modification date every file carries.
 */
export const zipArchive = (entries: readonly ZipEntry[], date: Date): Buffer => {
  const { time, day } = dosDateTime(date);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_NAMES, 8);
    central.writeUInt16LE(DEFLATE, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // extra field, comment, disk number, internal and external attributes: none
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
};
