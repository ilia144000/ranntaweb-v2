
export default function IndexedBadge({ ok }: { ok:boolean }){
  const style = {
    display:'inline-flex',alignItems:'center',gap:'6px',
    padding:'4px 8px',borderRadius:'8px',fontSize:'12px',
    border: ok ? '1px solid #1f6b2a' : '1px solid #26262b',
    color: ok ? '#6ce086' : '#9aa0a6'
  } as const;
  return <span style={style}>{ok?'Indexed':'Not indexed'}</span>;
}
