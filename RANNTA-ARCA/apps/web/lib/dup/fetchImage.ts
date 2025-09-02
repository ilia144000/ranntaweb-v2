
export async function fetchImageFromURI(uri: string){
  const url = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.replace('ipfs://','')}` : uri;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
