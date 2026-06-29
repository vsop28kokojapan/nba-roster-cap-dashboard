import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const PUB_ID = 'ca-pub-3095444700234869';

export const metadata: Metadata = {
  title: 'NBA Roster & Cap Board',
  description: 'NBAロスター・サラリーキャップダッシュボード',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isPlaceholder = PUB_ID.includes('XXXX');

  return (
    <html lang="ja" className={inter.variable}>
      <head>
        {!isPlaceholder && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
