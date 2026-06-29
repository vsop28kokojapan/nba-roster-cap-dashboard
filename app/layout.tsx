import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

const BASE_URL = 'https://nba-roster-cap-dashboard.vercel.app';

export const metadata: Metadata = {
  title: {
    default: 'NBA ロスター & サラリーキャップ 2024-25 | 全30チーム完全網羅',
    template: '%s | NBA Cap Board',
  },
  description: 'NBA全30チームのロスター・サラリーキャップ・契約情報を日本語でまとめたダッシュボード。ラグジュアリータックス・エプロンラインをリアルタイムで確認できます。',
  keywords: ['NBA', 'サラリーキャップ', 'ロスター', 'キャップ情報', 'ラグジュアリータックス', 'エプロン', '年俸', '契約', '選手', '移籍', 'トレード', '2024-25'],
  authors: [{ name: 'NBA Cap Board' }],
  metadataBase: new URL(BASE_URL),
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: BASE_URL,
    siteName: 'NBA Cap Board',
    title: 'NBA ロスター & サラリーキャップ 2024-25',
    description: 'NBA全30チームのロスター・サラリーキャップ・契約情報を日本語で。ラグジュアリータックス・エプロンラインをリアルタイム確認。',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NBA Cap Board' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NBA ロスター & サラリーキャップ 2024-25',
    description: 'NBA全30チームのキャップ情報を日本語でまとめたダッシュボード',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={inter.variable}>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3095444700234869"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
