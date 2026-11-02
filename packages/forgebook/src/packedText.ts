/**
 * Text a build keeps gzipped, unpacked in the page when asked: what a static catalogue weighs most and reads least (axe,
 * the search index, "Used in").
 *
 * @module
 */

/**
 * The text of a gzipped file.
 *
 * @param address - the file's address.
 * @throws when it cannot be fetched.
 */
const unpackedResponse = async (address: string): Promise<Response> => {
  const response = await fetch(address);
  if (!response.ok || response.body === null) throw new Error(`${address} could not be loaded`);
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip")));
};

/**
 * A gzipped script, at an address a script tag can load.
 *
 * @param address - the file's address.
 */
export const unpackedScript = async (address: string): Promise<string> => {
  const text = await (await unpackedResponse(address)).blob();
  return URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
};

/**
 * A gzipped JSON document.
 *
 * @param address - the file's address.
 */
export const packedJson = async (address: string): Promise<unknown> =>
  (await unpackedResponse(address)).json();
