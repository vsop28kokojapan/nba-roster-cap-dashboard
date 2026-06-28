export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get('season') ?? '2025-26';
  const baseYear = parseInt(season.split('-')[0]);
  const endYear = baseYear + 1; // 2025-26 → 2026

  try {
    const r = await fetch(
      `${ESPN_SB}?seasontype=3&dates=${endYear}0401-${endYear}0630&limit=500`,
      { next: { revalidate: 3600 } }
    );
    const data = await r.json();
    const events = (data.events ?? []) as Record<string, unknown>[];

    // Aggregate wins per team matchup
    const matchups = new Map<string, Map<string, number>>();
    for (const e of events) {
      const comp = (e.competitions as Record<string, unknown>[])?.[0];
      const status = comp?.status as Record<string, unknown> | undefined;
      if (!(status?.type as Record<string, unknown> | undefined)?.completed) continue;

      const comps = (comp?.competitors as Record<string, unknown>[]) ?? [];
      const teams = comps.map(c => ({
        abbr: String((c.team as Record<string, unknown>)?.abbreviation ?? ''),
        won: Boolean(c.winner),
      })).filter(t => t.abbr.length > 0);
      if (teams.length !== 2) continue;

      const key = [...teams].map(t => t.abbr).sort().join('|');
      if (!matchups.has(key)) matchups.set(key, new Map());
      const wins = matchups.get(key)!;
      for (const t of teams) {
        if (t.won) wins.set(t.abbr, (wins.get(t.abbr) ?? 0) + 1);
      }
    }

    // Series winner = exactly one team has reached 4 wins
    const seriesWinners = new Set<string>();
    const seriesLosers = new Set<string>();

    for (const [key, wins] of matchups) {
      const [a, b] = key.split('|');
      const wa = wins.get(a) ?? 0;
      const wb = wins.get(b) ?? 0;
      if (wa === 4 && wb !== 4) {
        seriesWinners.add(a); seriesLosers.add(b);
      } else if (wb === 4 && wa !== 4) {
        seriesWinners.add(b); seriesLosers.add(a);
      }
    }

    return NextResponse.json({
      seriesWinners: [...seriesWinners],
      seriesLosers: [...seriesLosers],
    });
  } catch {
    return NextResponse.json({ seriesWinners: [], seriesLosers: [] });
  }
}
