import type { Metadata } from 'next';
import { getNBAData } from '@/lib/data';
import type { NBAData } from '@/lib/types';
import Dashboard from '@/components/Dashboard';

export const metadata: Metadata = { title: 'NBA Roster & Cap Board' };

export default async function Home() {
  let initialData: NBAData | null = null;
  try {
    initialData = await getNBAData();
  } catch (e) {
    console.error('Supabase read failed:', e);
  }
  return <Dashboard initialData={initialData} />;
}
