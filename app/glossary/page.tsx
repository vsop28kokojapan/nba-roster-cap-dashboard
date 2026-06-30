import type { Metadata } from 'next';
import Glossary from '@/components/Glossary';

const BASE_URL = 'https://nba-roster-cap-dashboard.vercel.app';

export const metadata: Metadata = {
  title: 'NBA用語集 | サラリーキャップ・契約・トレード用語をまとめて解説',
  description: 'バード権、MLE、サイン&トレード、デッドキャップなどNBAのサラリーキャップ・契約・トレードに関する用語を日本語でわかりやすく解説。',
  alternates: { canonical: `${BASE_URL}/glossary` },
  openGraph: {
    title: 'NBA用語集',
    description: 'サラリーキャップ・契約・トレードに関するNBA用語を日本語でまとめて解説。',
    url: `${BASE_URL}/glossary`,
    type: 'website',
    locale: 'ja_JP',
    siteName: 'NBA Cap Board',
  },
  twitter: { card: 'summary', title: 'NBA用語集', description: 'NBAのキャップ・契約・トレード用語を日本語で解説。' },
};

export default function GlossaryPage() {
  return <Glossary />;
}
