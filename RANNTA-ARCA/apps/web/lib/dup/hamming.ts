export function hexToBigInt(hex: string) {
  return hex.startsWith('0x') ? BigInt(hex) : BigInt('0x' + hex);
}
export function hamming(a: bigint, b: bigint) {
  let x = a ^ b, c = 0n;
  while (x) { x &= x - 1n; c++; }
  return Number(c);
}
