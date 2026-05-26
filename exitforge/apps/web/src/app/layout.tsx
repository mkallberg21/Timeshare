import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ExitForge — Timeshare Exit, $0 Upfront',
  description:
    'AI-powered timeshare exit platform. 7% contingency fee, paid only on success. No upfront costs.',
  metadataBase: new URL('https://exitforge.com'),
  openGraph: {
    title: 'ExitForge — Exit Your Timeshare, Pay Nothing Until We Win',
    description: '7% contingency fee only. No upfront costs. AI-driven exit strategy.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
