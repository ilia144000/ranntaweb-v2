import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  try{
    const form = await req.formData();
    const file = form.get('file') as File;
    if(!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
    const name = String(form.get('name')||'Untitled');
    const description = String(form.get('description')||'');

    const jwt = process.env.PINATA_JWT;
    if(!jwt) return NextResponse.json({ error: 'PINATA_JWT missing' }, { status: 500 });

    const buf = Buffer.from(await file.arrayBuffer());

    const body = new FormData();
    body.append('file', new Blob([buf]), (file as any).name || 'art.png');
    const up = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method:'POST', headers:{ Authorization: `Bearer ${jwt}` }, body
    });
    if(!up.ok){ const t = await up.text(); return NextResponse.json({ error: 'pinFile failed', detail: t }, { status: 500 }); }
    const img = await up.json();

    const metadata = { name, description, image: `ipfs://${img.IpfsHash}` };
    const metaRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method:'POST', headers:{ Authorization: `Bearer ${jwt}`, 'Content-Type':'application/json' }, body: JSON.stringify(metadata)
    });
    if(!metaRes.ok){ const t = await metaRes.text(); return NextResponse.json({ error: 'pinJSON failed', detail: t }, { status: 500 }); }
    const meta = await metaRes.json();

    return NextResponse.json({
      imageCid: img.IpfsHash,
      metadataCid: meta.IpfsHash,
      contentUri: `ipfs://${meta.IpfsHash}`
    });
  }catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
