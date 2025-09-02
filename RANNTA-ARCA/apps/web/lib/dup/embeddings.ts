
import { pipeline } from '@xenova/transformers';
let extractor: any;

export async function getExtractor(){
  if (!extractor){
    extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
  }
  return extractor;
}

export async function clipEmbed(buffer: Buffer){
  const model = await getExtractor();
  const result = await model(buffer);
  const arr = Array.from(result.data as Float32Array);
  const norm = Math.sqrt(arr.reduce((s,v)=>s + v*v, 0));
  return arr.map(v => v / (norm || 1));
}
