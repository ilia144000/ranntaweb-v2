
'use client';
import { useState } from 'react';

export default function DuplicateCheck(){
  const [uri, setUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string|undefined>();

  const onCheck = async ()=>{
    setLoading(true); setError(undefined); setData(null);
    try{
      const res = await fetch('/api/detect-duplicate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contentUri: uri }) });
      const j = await res.json();
      if(!res.ok) throw new Error(j.error || 'Error');
      setData(j);
    }catch(e:any){ setError(e.message); }
    finally{ setLoading(false); }
  };

  return (
    <div style={{marginTop:24,border:'1px solid #26262b',borderRadius:16,padding:16}}>
      <div style={{display:'flex',gap:8}}>
        <input value={uri} onChange={e=>setUri(e.target.value)} placeholder="IPFS or HTTPS image URL"
               style={{flex:1,background:'#151518',border:'1px solid #26262b',padding:12,borderRadius:12,color:'#e8eaed'}}/>
        <button onClick={onCheck} disabled={loading}
                style={{background:'#c6a15b',color:'#0c0c0e',border:'none',borderRadius:12,padding:'12px 16px',fontWeight:700}}>
          {loading?'Checking…':'Check originality'}
        </button>
      </div>
      {error && <div style={{color:'#ff7b7b',marginTop:12}}>{error}</div>}
      {data && (
        <div style={{marginTop:16}}>
          <div style={{opacity:.8,fontSize:14}}>Verdict: <b>{data.verdict}</b></div>
          {data.bestMatch && (
            <div style={{fontSize:14,marginTop:8}}>Best match → <code>{data.bestMatch.token}</code> • cosine: {data.bestMatch.cosine.toFixed(3)} • hamming: {data.bestMatch.hamming}</div>
          )}
        </div>
      )}
    </div>
  );
}
