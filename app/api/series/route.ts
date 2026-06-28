export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

async function fetchEvents(url: string): Promise<Record<string, unknown>[]> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    return (d.events ?? []) as Record<string, unknown>[];
  } catch { return []; }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const t1 = searchParams.get('t1') ?? '';
  const t2 = searchParams.get('t2') ?? '';
  const type = searchParams.get('type') ?? 'playoffs';
  const season = searchParams.get('season') ?? '2025-26';

  if (!t1 || !t2) return NextResponse.json({ games: [] });

  const baseYear = parseInt(season.split('-')[0]);
  const endYear = baseYear + 1;

  let dateRanges: string[];
  if (type === 'playin') {
    dateRanges = [`${endYear}0413-${endYear}0422`];
  } else if (type === 'cup-knockout') {
    dateRanges = [`${baseYear}1201-${baseYear}1231`];
  } else if (type === 'cup-group') {
    dateRanges = [
      `${baseYear}1101-${baseYear}1115`,
      `${baseYear}1116-${baseYear}1205`,
    ];
  } else {
    dateRanges = [`${endYear}0413-${endYear}0630`];
  }

  const allGames: {
    id: string; date: string; headline: string;
    homeAbbr: string; awayAbbr: string;
    homeScore: number; awayScore: number; homeWon: boolean;
  }[] = [];

  const seenIds = new Set<string>();

  for (const dr of dateRanges) {
    const events = await fetchEvents(`${ESPN_SB}?seasontype=3&dates=${dr}&limit=200`);
    for (const e of events) {
      const comp = (e.competitions as Record<string, unknown>[])?.[0];
      if (!comp) continue;
      const stype = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>) ?? {};
      if (!stype.completed) continue;

      const competitors = (comp.competitors as Record<string, unknown>[]) ?? [];
      const abbrs = competitors.map(c => String((c.team as Record<string, unknown>)?.abbreviation ?? ''));
      if (!(abbrs.includes(t1) && abbrs.includes(t2))) continue;

      const id = String(e.id ?? '');
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');
      const notes = (comp.notes as Record<string, unknown>[]) ?? [];
      const headline = notes.map(n => String(n.headline ?? '')).join(', ');

      allGames.push({
        id,
        date: String(e.date ?? '').slice(0, 10),
        headline,
        homeAbbr: String((home?.team as Record<string, unknown>)?.abbreviation ?? ''),
        awayAbbr: String((away?.team as Record<string, unknown>)?.abbreviation ?? ''),
        homeScore: parseInt(String(home?.score ?? '0')),
        awayScore: parseInt(String(away?.score ?? '0')),
        homeWon: Boolean(home?.winner),
      });
    }
  }

  allGames.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ games: allGames.map((g, i) => ({ ...g, gameNum: i + 1 })) });
}
