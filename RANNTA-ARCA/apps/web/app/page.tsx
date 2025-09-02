// touch for redeploy
import TCProvider from "../components/TonConnectProvider";
import { Header } from "../components/Header";

export default function Page(){
  return (
    <TCProvider>
      <Header/>
      <main style={{maxWidth: '960px', margin: '0 auto', padding: '16px'}}>
        <h1 style={{fontSize:'28px',fontWeight:700}}>RANNTA ARCA</h1>
        <p style={{opacity:.75,marginTop:8}}>Marketplace هنری روی TON — آپلود به IPFS (Pinata)</p>
        <div style={{marginTop:16}}>
          <a href="/create" style={{background:'#c6a15b',color:'#0c0c0e',padding:'10px 14px',borderRadius:12,fontWeight:700,textDecoration:'none'}}>ساخت NFT</a>
        </div>
      </main>
    </TCProvider>
  );
}
