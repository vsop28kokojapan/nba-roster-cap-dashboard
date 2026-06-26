import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

export const isConfigured = Boolean(url && (anonKey || serviceKey));

function getClient(write = false) {
  if (!url) throw new Error('SUPABASE_URL が設定されていません');
  const key = write ? serviceKey : (anonKey ?? serviceKey);
  if (!key) throw new Error(write ? 'SUPABASE_SERVICE_KEY が設定されていません' : 'SUPABASE_ANON_KEY または SUPABASE_SERVICE_KEY が必要です');
  return createClient(url, key);
}

export async function readNbaData() {
  const { data, error } = await getClient(false)
    .from('nba_data')
    .select('data')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.data;
}

export async function writeNbaData(nbaData) {
  const { error } = await getClient(true)
    .from('nba_data')
    .upsert({
      id: 1,
      updated_at: nbaData.meta?.updatedAt ?? new Date().toISOString(),
      season: nbaData.meta?.season ?? null,
      data: nbaData,
    });
  if (error) throw error;
}
