import { NextResponse } from 'next/server';
import { fetchHistoricalSeason } from '@/lib/fetcher';
import { writeHistory } from '@/lib/supabase';

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const seasonParam = searchParams.get('season');

  if (!seasonParam || !/^\d{4}-\d{2}$/.test(seasonParam)) {
    return NextResponse.json(
      { error: 'season パラメータが必要です。例: ?season=2023-24' },
      { status: 400 }
    );
  }

  const year = parseInt(seasonParam.slice(0, 4));
  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 2015 || year > currentYear) {
    return NextResponse.json({ error: '2015〜現在のシーズンを指定してください' }, { status: 400 });
  }

  try {
    const snapshot = await fetchHistoricalSeason(year);
    await writeHistory(seasonParam, snapshot);
    return NextResponse.json({
      ok: true,
      season: seasonParam,
      teams: snapshot.teams.length,
      players: snapshot.players.length,
      fetchedAt: snapshot.fetchedAt,
    });
  } catch (e) {
    console.error('History update failed:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
