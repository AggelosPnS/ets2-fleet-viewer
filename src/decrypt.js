/**
 * SII Decryption wrapper.
 *
 * ETS2 save files come in 3 flavors:
 *   1. Plain text (starts with "SiiNunit")  — no processing needed
 *   2. Encrypted  (magic "ScsC")             — AES-encrypted, needs decrypt
 *   3. Binary     (magic "BSII")             — structured binary, needs decode
 *
 * We detect which we have and run the right path.
 *
 * The heavy lifting uses a port of TheLazyTomcat's SII_Decrypt (via the
 * `@trucky/sii-decrypt-ts` npm package, loaded through esm.sh so we don't need
 * a bundler). Credit: TheLazyTomcat, jammerxd, trucky (see README).
 */

const DECRYPT_LIB_URL = 'https://esm.sh/@trucky/sii-decrypt-ts@1.0.0';

let decryptLibPromise = null;

function loadDecryptLib() {
  if (!decryptLibPromise) {
    decryptLibPromise = import(DECRYPT_LIB_URL).catch((err) => {
      decryptLibPromise = null;
      throw new Error(
        'Could not load the SII decryption library. Please check your ' +
          'internet connection and try again. (' + err.message + ')'
      );
    });
  }
  return decryptLibPromise;
}

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
 * Takes a File (from an <input type="file">) and returns { text, format }.
 * Throws on error.
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
    const lib = await loadDecryptLib();
    const SIIDecryptor = lib.SIIDecryptor || lib.default?.SIIDecryptor;
    if (!SIIDecryptor) {
      throw new Error('Decryption library loaded but SIIDecryptor export not found.');
    }
    // Convert Uint8Array to a buffer-like object the lib expects.
    // The lib accepts a filename in node, but we pass buffer data directly.
    const result = await SIIDecryptor.decryptBuffer
      ? SIIDecryptor.decryptBuffer(uint8)
      : SIIDecryptor.decrypt(uint8);

    if (!result || !result.success) {
      throw new Error(
        'Decryption failed: ' + (result?.error || 'unknown error') +
          '. This file may be from an unsupported game version.'
      );
    }
    const text = result.string_content || (result.data ? new TextDecoder().decode(result.data) : '');
    if (!text) throw new Error('Decryption produced empty output.');
    return { text, format };
  }

  throw new Error(
    'Unrecognized file format. Expected an ETS2 game.sii save ' +
      '(text, encrypted, or binary). Got: ' +
      Array.from(uint8.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ')
  );
}
