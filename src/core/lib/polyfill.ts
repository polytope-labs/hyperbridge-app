import "core-js/es/iterator"
import "core-js/es/array"
import "core-js/es/object/group-by"
import "core-js/es/set"

// jsdom replaces globalThis.Uint8Array with its own version, which breaks
// `Buffer instanceof Uint8Array` checks inside ethers/tronweb at import time.
// Restore the native Node.js Uint8Array so BytesLike validation passes.
// Only needed in test environments — browser Uint8Array is always native.
// Uses require() (not import) so Vite does not externalize it in browser builds.
if (typeof process !== "undefined" && process.versions?.node) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer: NodeBuffer } = require("node:buffer")
  globalThis.Uint8Array = Object.getPrototypeOf(
    NodeBuffer.prototype,
  ).constructor
}
