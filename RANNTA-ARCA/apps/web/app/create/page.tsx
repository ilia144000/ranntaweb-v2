'use client';
import { useState } from 'react';

export default function Create(){
  const [file, setFile] = useState<File|null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [resData, setResData] = useState<any>(null);
  const [error, setError] = useState<string|undefined>();

  const onUpload = async () => {
    if(!file){ setError('ابتدا فایل را انتخاب کنید'); return; }
    setUploading(true); setError(undefined);
    try{
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name);
      fd.append('description', description);
      const res = await fetch('/api/upload', { method:'POST', body: fd });
      const j = await res.json();
      if(!res.ok) throw new Error(j.error || 'Upload failed');
      setResData(j);
    }catch(e:any){ setError(e.message); }
    finally{ setUploading(false); }
  };

  return (
    <main style={{maxWidth:'720px',margin:'0 auto',padding:'16px',color:'#e8eaed'}}>
      <h1 style={{fontSize:22,fontWeight:700}}>ساخت NFT — آپلود به IPFS</h1>
      <div style={{marginTop:12,display:'grid',gap:10}}>
        <input placeholder="Title" value={name} onChange={e=>setName(e.target.value)}
               style={{background:'#151518',border:'1px solid #26262b',padding:12,borderRadius:12,color:'#e8eaed'}}/>
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} rows={5}
                  style={{background:'#151518',border:'1px solid #26262b',padding:12,borderRadius:12,color:'#e8eaed'}}/>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} style={{color:'#e8eaed'}}/>
        <button onClick={onUpload} disabled={uploading}
                style={{background:'#c6a15b',color:'#0c0c0e',border:'none',borderRadius:12,padding:'12px 16px',fontWeight:700}}>
          {uploading?'در حال آپلود…':'Upload to IPFS'}
        </button>
        {error && <div style={{color:'#ff7b7b'}}>{error}</div>}
        {resData && (
          <div style={{marginTop:8,border:'1px solid #26262b',borderRadius:12,padding:12,fontSize:14}}>
            <div>Image CID: <code>{resData.imageCid}</code></div>
            <div>Metadata CID: <code>{resData.metadataCid}</code></div>
            <div>Content URI: <code>{resData.contentUri}</code></div>
          </div>
        )}
      </div>
    </main>
  );
}

