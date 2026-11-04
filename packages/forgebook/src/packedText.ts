/**
 * What a build keeps gzipped, unpacked in the page when it is asked for: what a static catalogue weighs most and reads
 * least (axe's script, "Used in"). A build names such files `.bin`, since `.gz` makes some hosts send them with
 * `Content-Encoding: gzip`, which the browser would unpack before the page does.
 *
 * @module
 */

/**
 * A gzipped file's content, unpacked.
 *
 * @param address - the file's address.
 * @throws when it cannot be fetched.
 */
const unpacked = async (address: string): Promise<Response> => {
  const response = await fetch(address);
  if (!response.ok || response.body === null)
    throw new Error(`${address} could not be loaded (${response.status})`);
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip")));
};

/**
 * A gzipped script, at an address a script element can load: a blob URL, which its loader revokes once it ran.
 *
 * @param address - the file's address.
 * @throws when it cannot be fetched.
 */
export const unpackedScript = async (address: string): Promise<string> => {
  const script = await (await unpacked(address)).arrayBuffer();
  return URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
};

/**
 * A gzipped JSON document, parsed.
 *
 * @param address - the file's address.
 * @throws when it cannot be fetched, or is not JSON.
 */
export const packedJson = async (address: string): Promise<unknown> => (await unpacked(address)).json();
