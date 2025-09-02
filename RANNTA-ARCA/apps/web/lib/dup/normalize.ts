
import sharp from 'sharp';

export async function normalizeImage(input: Buffer){
  const img = sharp(input, { failOnError: false }).removeMetadata();
  const meta = await img.metadata();
  const hasAlpha = !!meta.hasAlpha;
  const base = img
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true, background: { r:0, g:0, b:0, alpha:1 } })
    .toColorspace('srgb');
  const out = hasAlpha
    ? await base.flatten({ background: { r:0, g:0, b:0 } }).png().toBuffer()
    : await base.jpeg({ quality: 92 }).toBuffer();
  return { buffer: out, width: meta.width || null, height: meta.height || null, mime: hasAlpha ? 'image/png' : 'image/jpeg' };
}
