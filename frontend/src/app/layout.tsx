import type { Metadata } from "next";
import { headers } from 'next/headers'
import './globals.css';
import ContextProvider from '@/context'
import ToastHost from '@/components/ToastHost'


export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "ColorSnap - Confidential Color Memory",
  description: "A private color-memory game powered by Zama FHEVM on Ethereum Sepolia.",
  keywords: ["Zama", "FHE", "Ethereum Sepolia", "blockchain", "game", "Web3"],
  authors: [{ name: "ColorSnap Team" }],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const headersData = await headers();
  const cookies = headersData.get('cookie');

  return (
    <html lang="en" data-scroll-behavior="smooth">
        <body>
        <ContextProvider cookies={cookies}>
          {children}
          <ToastHost />
        </ContextProvider>
      </body>
    </html>
  );
}
