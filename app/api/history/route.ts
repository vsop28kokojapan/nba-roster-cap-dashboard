import { NextResponse } from 'next/server';
import { readHistory, listHistorySeasons } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');

  if (!season) {
    const seasons = await listHistorySeasons();
    return NextResponse.json({ seasons });
  }

  try {
    const data = await readHistory(season);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }
}
