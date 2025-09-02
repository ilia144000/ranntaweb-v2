import imghash from 'imghash';

/** perceptual hash (pHash) as hex string (64-bit => 16 hex chars) */
export async function phashFromBuffer(buf: Buffer) {
  return imghash.hash(buf, 16, 'hex');
}

