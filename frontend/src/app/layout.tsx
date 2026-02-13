import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StarknetProvider } from "@/components/StarknetProvider";
import { WalletProvider } from "@/context/WalletContext";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GhostSats | Private Bitcoin Accumulation Protocol",
  description: "Accumulate BTC without revealing your position. Shielded pool on Starknet with real on-chain ZK proof verification via Garaga. Noir circuits, Pedersen commitments, intent-based BTC settlement.",
  metadataBase: new URL("https://ghostsats.vercel.app"),
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "GhostSats | Private Bitcoin Accumulation Protocol",
    description: "Accumulate BTC without revealing your position. Shielded pool on Starknet with real on-chain ZK proof verification via Garaga.",
    siteName: "GhostSats",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostSats | Private Bitcoin Accumulation Protocol",
    description: "Accumulate BTC privately. On-chain ZK proofs, batch swaps, intent-based BTC settlement on Starknet.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <StarknetProvider>
          <WalletProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </WalletProvider>
        </StarknetProvider>
      </body>
    </html>
  );
}
