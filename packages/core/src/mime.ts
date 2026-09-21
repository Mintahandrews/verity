/**
 * Magic-byte MIME sniffing. Declared types are untrusted (bots and pages
 * construct Blobs without types, and c2pa-node throws on a MIME/format
 * mismatch), so sniff the actual container instead.
 */
export function sniffMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  // >>> 0 coerces to unsigned — 0x89<<24 overflows int32 sign bit otherwise.
  const b32 = ((buf[0]! << 24) | (buf[1]! << 16) | (buf[2]! << 8) | buf[3]!) >>> 0;
  const ascii = (off: number, len: number): string =>
    String.fromCharCode(...buf.subarray(off, off + len));

  if (b32 === 0x89504e47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp') return 'video/mp4';
  if (b32 === 0x1a45dfa3) return 'video/webm';
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  return null;
}
