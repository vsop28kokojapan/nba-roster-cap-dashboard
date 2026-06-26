import { getLatestData } from './supabase';
import type { NBAData } from './types';

export async function getNBAData(): Promise<NBAData> {
  return getLatestData();
}
