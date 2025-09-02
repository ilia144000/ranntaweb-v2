
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { fetchImageFromURI } from '@/lib/dup/fetchImage';
import { normalizeImage } from '@/lib/dup/normalize';
import { sha256 } from '@/lib/dup/sha';
import { phashFromBuffer } from '@/lib/dup/imhash';
import { hexToBigInt, hamming } from '@/lib/dup/hamming';
import { clipEmbed } from '@/lib/dup/embeddings';

export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  try{
    const { contentUri } = await req.json();
    if(!contentUri) return NextResponse.json({ error: 'contentUri required' }, { status: 400 });

    const raw = await fetchImageFromURI(contentUri);
    const norm = await normalizeImage(raw);
    const sha = sha256(norm.buffer);
    const phashHex = await phashFromBuffer(norm.buffer);
    const phash = hexToBigInt(phashHex);
    const clip = await clipEmbed(norm.buffer);

    const shaDup = await pool.query('SELECT token FROM nft_images WHERE sha256 = $1 LIMIT 1', [sha]);
    if(shaDup.rows.length){
      return NextResponse.json({ verdict: 'BLOCK', reason: 'EXACT_DUPLICATE', match: shaDup.rows[0].token });
    }

    const { rows } = await pool.query(
      'SELECT token, phash, (clip_vec <=> $1::vector) AS cosdist FROM nft_images ORDER BY clip_vec <=> $1::vector ASC LIMIT 20',
      [clip]
    );

    const scored = rows.map((r:any)=>{
      const ham = hamming(BigInt(r.phash), phash);
      const score = 1 - Number(r.cosdist);
      return { token: r.token, hamming: ham, cosine: score };
    }).sort((a,b)=> (b.cosine - a.cosine) || (a.hamming - b.hamming));

    const best = scored[0];
    let label = 'OK';
    if(best && best.cosine >= 0.95 && best.hamming <= 5) label = 'LIKELY_DUPLICATE';
    else if(best && best.cosine >= 0.90 && best.hamming <= 10) label = 'POSSIBLE_DUPLICATE';

    return NextResponse.json({
      verdict: label,
      bestMatch: best || null,
      candidates: scored,
      meta: { width: norm.width, height: norm.height, mime: norm.mime }
    });
  }catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
