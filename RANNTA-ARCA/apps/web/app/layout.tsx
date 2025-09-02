export const metadata = { title: "RANNTA ARCA", description: "Art-only TON NFT marketplace" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{background:'#0f0f11',color:'#e8eaed',fontFamily:'system-ui,Segoe UI,Roboto,Helvetica,Arial'}}>
        {children}
      </body>
    </html>
  );
}
