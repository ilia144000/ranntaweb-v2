
import { NextRequest, NextResponse } from 'next/server';
import { indexNft } from '@/lib/indexer-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest){
  try{
    const { token, contentUri } = await req.json();
    if(!token || !contentUri) return NextResponse.json({ error: 'token, contentUri required' }, { status: 400 });
    const res = await indexNft({ token, contentUri });
    return NextResponse.json(res);
  }catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
