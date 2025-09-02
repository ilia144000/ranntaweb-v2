
'use client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export default function TCProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl="/tonconnect-manifest.json">
      {children}
    </TonConnectUIProvider>
  );
}
