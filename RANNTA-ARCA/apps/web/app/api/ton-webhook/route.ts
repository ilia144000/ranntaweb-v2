
import { NextRequest, NextResponse } from 'next/server';
import { indexNft } from '@/lib/indexer-server';
import { assertRateLimit, assertAuth, verifySignature } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  try{
    const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0] || 'unknown';
    await assertRateLimit(`tonwebhook:${ip}`, Number(process.env.RL_MAX||120), Number(process.env.RL_WINDOW||60));
    await assertAuth(req);
    const raw = await req.text();
    await verifySignature(raw, req.headers.get('x-arca-sign'));

    const payload = JSON.parse(raw);
    const items = payload?.events || payload?.items || [];
    let enq = 0;

    for(const e of items){
      const nft = e?.nft?.address || e?.nft_address;
      const contentUri = e?.nft?.metadata?.image || e?.metadata?.image_url || e?.image;
      if(nft && contentUri){
        await indexNft({ token: nft, contentUri });
        enq++;
      }
    }
    return NextResponse.json({ ok:true, indexed: enq });
  }catch(e:any){
    const code = String(e.message||'').includes('Too Many Requests') ? 429 : 500;
    return NextResponse.json({ error: e.message }, { status: code });
  }
}
