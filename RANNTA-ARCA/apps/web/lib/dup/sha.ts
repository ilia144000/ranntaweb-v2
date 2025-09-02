import { createHash } from 'crypto';

export function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest(); // Buffer
}

export function sha256Hex(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex'); // string
}
