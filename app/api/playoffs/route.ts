export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

interface SeriesData { winner: string; loser: string; winsW: number; winsL: number }
interface CupGame { round: string; winner: string; loser: string }
interface PlayinGame { round: string; conf: string; winner: string; loser: string; scoreW: string; scoreL: string }
interface CupGroupEntry { abbr: string; wins: number; losses: number }

function extractTeams(comp: Record<string, unknown>) {
  const comps = (comp.competitors as Record<string, unknown>[]) ?? [];
  return comps.map(c => ({
    abbr: String((c.team as Record<string, unknown>)?.abbreviation ?? ''),
    won: Boolean(c.winner),
    score: String((c as Record<string, unknown>).score ?? ''),
  })).filter(t => t.abbr.length > 0);
}

function getHeadline(comp: Record<string, unknown>): string {
  const notes = (comp.notes as Array<Record<string, unknown> | string>) ?? [];
  return notes.map(n => typeof n === 'string' ? n : String(n.headline ?? '')).join(' ');
}

function isCompleted(comp: Record<string, unknown>): boolean {
  const stype = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>) ?? {};
  return Boolean(stype.completed);
}

async function fetchEvents(url: string): Promise<Record<string, unknown>[]> {
  try {
    const r = await fetch(url, { next: { revalidate: 3600 } });
    const d = await r.json();
    return (d.events ?? []) as Record<string, unknown>[];
  } catch { return []; }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get('season') ?? '2025-26';
  const baseYear = parseInt(season.split('-')[0]);
  const endYear = baseYear + 1;

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [playoffEvents, playinEvents, cupNov1, cupNov2, cupDec] = await Promise.all([
    // Main playoff series (April–June)
    fetchEvents(`${ESPN_SB}?seasontype=3&dates=${endYear}0418-${endYear}0630&limit=500`),
    // Play-in games (April 13-22)
    fetchEvents(`${ESPN_SB}?seasontype=3&dates=${endYear}0413-${endYear}0422&limit=30`),
    // Cup group play - first half of November
    fetchEvents(`${ESPN_SB}?seasontype=3&dates=${baseYear}1101-${baseYear}1115&limit=150`),
    // Cup group play - second half of November
    fetchEvents(`${ESPN_SB}?seasontype=3&dates=${baseYear}1116-${baseYear}1130&limit=150`),
    // Cup knockout (December)
    fetchEvents(`${ESPN_SB}?seasontype=3&dates=${baseYear}1201-${baseYear}1231&limit=100`),
  ]);

  // ── Playoff series ────────────────────────────────────────────────────────
  const matchups = new Map<string, Map<string, number>>();
  for (const e of playoffEvents) {
    const comp = (e.competitions as Record<string, unknown>[])?.[0];
    if (!comp || !isCompleted(comp as Record<string, unknown>)) continue;
    const teams = extractTeams(comp as Record<string, unknown>);
    if (teams.length !== 2) continue;
    const key = teams.map(t => t.abbr).sort().join('|');
    if (!matchups.has(key)) matchups.set(key, new Map());
    const wins = matchups.get(key)!;
    for (const t of teams) {
      if (t.won) wins.set(t.abbr, (wins.get(t.abbr) ?? 0) + 1);
    }
  }

  const rawSeries: SeriesData[] = [];
  for (const [key, wins] of matchups) {
    const [a, b] = key.split('|');
    const wa = wins.get(a) ?? 0;
    const wb = wins.get(b) ?? 0;
    const total = wa + wb;
    if (total < 4) continue;
    if (wa === wb) continue; // handle ties below
    const winner = wa > wb ? a : b;
    const loser = wa > wb ? b : a;
    const winsW = Math.max(wa, wb);
    const winsL = Math.min(wa, wb);
    if (winsW < 4) continue;
    rawSeries.push({ winner, loser, winsW, winsL });
  }

  // Resolve tied matchups (DET 4 - ORL 4): if one team appears as loser later, they won this
  for (const [key, wins] of matchups) {
    const [a, b] = key.split('|');
    const wa = wins.get(a) ?? 0;
    const wb = wins.get(b) ?? 0;
    if (wa !== wb || wa < 4) continue;
    const aLostLater = rawSeries.some(s => s.loser === a && s.winner !== b);
    const bLostLater = rawSeries.some(s => s.loser === b && s.winner !== a);
    if (aLostLater && !bLostLater) rawSeries.push({ winner: a, loser: b, winsW: 4, winsL: 4 });
    else if (bLostLater && !aLostLater) rawSeries.push({ winner: b, loser: a, winsW: 4, winsL: 4 });
  }

  const seenPairs = new Set<string>();
  const series: SeriesData[] = [];
  for (const s of rawSeries) {
    const pairKey = [s.winner, s.loser].sort().join('|');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    series.push({ ...s, winsW: Math.min(s.winsW, 4) });
  }

  // ── Play-in games ─────────────────────────────────────────────────────────
  const playin: PlayinGame[] = [];
  for (const e of playinEvents) {
    const comp = (e.competitions as Record<string, unknown>[])?.[0];
    if (!comp || !isCompleted(comp as Record<string, unknown>)) continue;
    const headline = getHeadline(comp as Record<string, unknown>);
    if (!headline.includes('Play-In')) continue;
    const teams = extractTeams(comp as Record<string, unknown>);
    if (teams.length !== 2) continue;
    const winner = teams.find(t => t.won);
    const loser = teams.find(t => !t.won);
    if (!winner || !loser) continue;

    let round = '';
    let conf = '';
    if (headline.includes('East')) conf = 'East';
    else if (headline.includes('West')) conf = 'West';
    if (headline.includes('9th') || headline.includes('10th')) round = '9v10';
    else if (headline.includes('7th') || headline.includes('8th Place')) round = '7v8';
    else if (headline.includes('8th Seed')) round = 'consolation';
    if (!round || !conf) continue;

    playin.push({ round, conf, winner: winner.abbr, loser: loser.abbr, scoreW: winner.score, scoreL: loser.score });
  }

  // ── NBA Cup group play ────────────────────────────────────────────────────
  const cupGroupWins = new Map<string, number>();
  const cupGroupLosses = new Map<string, number>();
  const seenGames = new Set<string>();

  for (const e of [...cupNov1, ...cupNov2]) {
    const comp = (e.competitions as Record<string, unknown>[])?.[0];
    if (!comp || !isCompleted(comp as Record<string, unknown>)) continue;
    const headline = getHeadline(comp as Record<string, unknown>);
    if (!headline.includes('Cup') || !headline.includes('Group')) continue;
    const teams = extractTeams(comp as Record<string, unknown>);
    if (teams.length !== 2) continue;
    const gameKey = teams.map(t => t.abbr).sort().join('|') + '_' + String(e.date ?? '');
    if (seenGames.has(gameKey)) continue;
    seenGames.add(gameKey);
    for (const t of teams) {
      if (t.won) cupGroupWins.set(t.abbr, (cupGroupWins.get(t.abbr) ?? 0) + 1);
      else cupGroupLosses.set(t.abbr, (cupGroupLosses.get(t.abbr) ?? 0) + 1);
    }
  }

  const cupGroup: CupGroupEntry[] = Array.from(new Set([...cupGroupWins.keys(), ...cupGroupLosses.keys()]))
    .map(abbr => ({ abbr, wins: cupGroupWins.get(abbr) ?? 0, losses: cupGroupLosses.get(abbr) ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  // ── NBA Cup knockout ──────────────────────────────────────────────────────
  const cup: CupGame[] = [];
  for (const e of cupDec) {
    const comp = (e.competitions as Record<string, unknown>[])?.[0];
    if (!comp || !isCompleted(comp as Record<string, unknown>)) continue;
    const headline = getHeadline(comp as Record<string, unknown>);
    if (!headline.includes('Cup')) continue;
    const teams = extractTeams(comp as Record<string, unknown>);
    if (teams.length !== 2) continue;
    const winner = teams.find(t => t.won)?.abbr ?? null;
    const loser = teams.find(t => !t.won)?.abbr ?? null;
    if (!winner || !loser) continue;
    let round = '';
    if (headline.includes('Championship')) round = 'Final';
    else if (headline.includes('Semifinal')) round = 'Semifinal';
    else if (headline.includes('Quarterfinal')) round = 'Quarterfinal';
    else continue;
    cup.push({ round, winner, loser });
  }

  return NextResponse.json({ series, cup, playin, cupGroup });
}
