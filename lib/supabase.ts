import { createClient } from '@supabase/supabase-js';
import type { NBAData, HistoricalSnapshot } from './types';

const AUTH_OPT = { auth: { detectSessionInUrl: false, persistSession: false } };

// JWTはすべて "eyJ" から始まる。環境変数に余分なラベルが混入していても正しい値を取り出す。
function extractJwt(raw: string | undefined): string {
  if (!raw) return '';
  const m = raw.match(/eyJ[A-Za-z0-9_\-.]+/);
  return m ? m[0] : raw.trim();
}

function readClient() {
  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = extractJwt(process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_KEY);
  return createClient(url, key, AUTH_OPT);
}

function writeClient() {
  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = extractJwt(process.env.SUPABASE_SERVICE_KEY);
  return createClient(url, key, AUTH_OPT);
}

// ── 現行データ ────────────────────────────────────────────────

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

// ── 履歴データ ────────────────────────────────────────────────

export async function readHistory(season: string): Promise<HistoricalSnapshot> {
  const { data, error } = await readClient()
    .from('nba_history')
    .select('data')
    .eq('season', season)
    .single();
  if (error) throw error;
  return data.data as HistoricalSnapshot;
}

export async function writeHistory(season: string, snapshot: HistoricalSnapshot): Promise<void> {
  const { error } = await writeClient().from('nba_history').upsert({
    season,
    data: snapshot,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listHistorySeasons(): Promise<string[]> {
  const { data, error } = await readClient()
    .from('nba_history')
    .select('season')
    .order('season', { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: { season: string }) => row.season);
}
