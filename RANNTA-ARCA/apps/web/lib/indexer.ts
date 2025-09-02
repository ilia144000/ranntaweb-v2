
export async function indexNft({ token, contentUri }: { token: string; contentUri: string }){
  try{
    const res = await fetch('/api/index-nft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, contentUri })
    });
    if(!res.ok){ const j=await res.json(); throw new Error(j.error||'index failed'); }
    return true;
  }catch(err){ console.error('indexNft error:', err); return false; }
}
