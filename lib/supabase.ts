import { createClient } from '@supabase/supabase-js';
import type { NBAData } from './types';

function readClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

function writeClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export async function getLatestData(): Promise<NBAData> {
  const { data, error } = await readClient()
    .from('nba_data')
    .select('data')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.data as NBAData;
}

export async function writeLatestData(nbaData: NBAData): Promise<void> {
  const { error } = await writeClient().from('nba_data').upsert({
    id: 1,
    updated_at: nbaData.meta?.updatedAt ?? new Date().toISOString(),
    season: nbaData.meta?.season ?? null,
    data: nbaData,
  });
  if (error) throw error;
}
