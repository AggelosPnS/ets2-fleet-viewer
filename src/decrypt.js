/**
 * SII File Loader.
 *
 * ETS2 save files come in 3 formats:
 *   1. Plain text (starts with "SiiNunit")  — we read directly ✓
 *   2. Encrypted  (magic "ScsC")             — we ask the user to pre-decrypt
 *   3. Binary     (magic "BSII")             — we ask the user to pre-decrypt
 *
 * For (2) and (3), we point users to https://sii-decode.github.io/ which is a
 * battle-tested browser-based decryptor (yuriko_3's implementation).
 *
 * Why this split? Browser-side decryption of the proprietary SCS formats needs
 * a significant chunk of code that's not our core value — letting the user do
 * one extra step using an already-reliable tool keeps our footprint small and
 * our site robust. If the community ever asks loudly enough for one-click, we
 * can integrate a proper browser-native decryptor later.
 */

/**
 * Sniff the first bytes of the file to figure out what we're dealing with.
 */
function detectFormat(uint8) {
  if (uint8.length < 4) return 'unknown';
  // "SiiN" = plain text "SiiNunit"
  if (uint8[0] === 0x53 && uint8[1] === 0x69 && uint8[2] === 0x69 && uint8[3] === 0x4e) {
    return 'plain';
  }
  // "ScsC" = encrypted
  if (uint8[0] === 0x53 && uint8[1] === 0x63 && uint8[2] === 0x73 && uint8[3] === 0x43) {
    return 'encrypted';
  }
  // "BSII" = binary
  if (uint8[0] === 0x42 && uint8[1] === 0x53 && uint8[2] === 0x49 && uint8[3] === 0x49) {
    return 'binary';
  }
  return 'unknown';
}

/**
 * Error class so the UI can special-case encrypted files with a friendlier
 * message and an action (link to sii-decode.github.io).
 */
export class NeedsDecryptionError extends Error {
  constructor(format) {
    super(
      format === 'encrypted'
        ? 'This save file is encrypted and needs to be decoded first.'
        : 'This save file is in binary format and needs to be decoded first.'
    );
    this.name = 'NeedsDecryptionError';
    this.format = format;
  }
}

/**
 * Takes a File (from an <input type="file">) and returns { text, format }.
 * Throws NeedsDecryptionError for encrypted/binary saves, generic Error otherwise.
 */
export async function loadSaveFile(file) {
  const arrayBuf = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuf);
  const format = detectFormat(uint8);

  if (format === 'plain') {
    const text = new TextDecoder('utf-8').decode(uint8);
    return { text, format };
  }

  if (format === 'encrypted' || format === 'binary') {
    throw new NeedsDecryptionError(format);
  }

  const magic = Array.from(uint8.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  throw new Error(
    `Unrecognized file format (magic bytes: ${magic}). ` +
      'Expected an ETS2 game.sii save — either plain text (starting with "SiiNunit"), encrypted ("ScsC..."), or binary ("BSII...").'
  );
}
