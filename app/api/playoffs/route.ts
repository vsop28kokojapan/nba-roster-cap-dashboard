export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

interface SeriesData { winner: string; loser: string; winsW: number; winsL: number }
interface CupGame { round: string; winner: string; loser: string }

function extractTeams(comp: Record<string, unknown>) {
  const comps = (comp.competitors as Record<string, unknown>[]) ?? [];
  return comps.map(c => ({
    abbr: String((c.team as Record<string, unknown>)?.abbreviation ?? ''),
    won: Boolean(c.winner),
    score: String((c as Record<string, unknown>).score ?? ''),
  })).filter(t => t.abbr.length > 0);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get('season') ?? '2025-26';
  const baseYear = parseInt(season.split('-')[0]);
  const endYear = baseYear + 1;

  try {
    // ── Playoff series (April–June) ──────────────────────────────────────────
    const playoffR = await fetch(
      `${ESPN_SB}?seasontype=3&dates=${endYear}0401-${endYear}0630&limit=500`,
      { next: { revalidate: 3600 } }
    );
    const playoffData = await playoffR.json();
    const playoffEvents = (playoffData.events ?? []) as Record<string, unknown>[];

    const matchups = new Map<string, Map<string, number>>();
    for (const e of playoffEvents) {
      const comp = (e.competitions as Record<string, unknown>[])?.[0];
      if (!(comp?.status as Record<string, unknown> | undefined)) continue;
      const stype = ((comp.status as Record<string, unknown>).type as Record<string, unknown>) ?? {};
      if (!stype.completed) continue;
      const teams = extractTeams(comp as Record<string, unknown>);
      if (teams.length !== 2) continue;
      const key = teams.map(t => t.abbr).sort().join('|');
      if (!matchups.has(key)) matchups.set(key, new Map());
      const wins = matchups.get(key)!;
      for (const t of teams) {
        if (t.won) wins.set(t.abbr, (wins.get(t.abbr) ?? 0) + 1);
      }
    }

    // Build series list: winner = team with more wins (≥4) beating team with fewer
    // Handles contaminated data (5-1, 6-0) and clean data (4-3, 4-2)
    const rawSeries: SeriesData[] = [];
    const resolvedLosersByWinner = new Map<string, string[]>(); // winner → [losers it beat]

    for (const [key, wins] of matchups) {
      const [a, b] = key.split('|');
      const wa = wins.get(a) ?? 0;
      const wb = wins.get(b) ?? 0;
      const total = wa + wb;
      if (total < 4) continue; // too few games, skip
      if (wa === wb) continue; // tie (DET/ORL contamination) — handled below
      const winner = wa > wb ? a : b;
      const loser = wa > wb ? b : a;
      const winsW = Math.max(wa, wb);
      const winsL = Math.min(wa, wb);
      // Only count if winner appears to have won a real series (≥4 wins)
      if (winsW < 4) continue;
      rawSeries.push({ winner, loser, winsW, winsL });
      if (!resolvedLosersByWinner.has(winner)) resolvedLosersByWinner.set(winner, []);
      resolvedLosersByWinner.get(winner)!.push(loser);
    }

    // Resolve tied matchups (DET 4 - ORL 4):
    // If one team appears as a loser in another series, it must have WON the tied matchup first
    for (const [key, wins] of matchups) {
      const [a, b] = key.split('|');
      const wa = wins.get(a) ?? 0;
      const wb = wins.get(b) ?? 0;
      if (wa !== wb || wa < 4) continue;
      // Check which team appears as loser elsewhere → that team won this series
      const aLostLater = rawSeries.some(s => s.loser === a && s.winner !== b);
      const bLostLater = rawSeries.some(s => s.loser === b && s.winner !== a);
      if (aLostLater && !bLostLater) {
        rawSeries.push({ winner: a, loser: b, winsW: 4, winsL: 4 });
      } else if (bLostLater && !aLostLater) {
        rawSeries.push({ winner: b, loser: a, winsW: 4, winsL: 4 });
      }
    }

    // Deduplicate series (same pair might appear twice from contamination)
    const seenPairs = new Set<string>();
    const series: SeriesData[] = [];
    for (const s of rawSeries) {
      const pairKey = [s.winner, s.loser].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      // Normalize winsW to 4 max (cap contaminated win count)
      series.push({ ...s, winsW: Math.min(s.winsW, 4) });
    }

    // ── NBA Cup knockout (December) ───────────────────────────────────────────
    const cupR = await fetch(
      `${ESPN_SB}?seasontype=3&dates=${baseYear}1201-${baseYear}1231&limit=100`,
      { next: { revalidate: 3600 } }
    );
    const cupData = await cupR.json();
    const cupEvents = (cupData.events ?? []) as Record<string, unknown>[];

    const cup: CupGame[] = [];
    for (const e of cupEvents) {
      const comp = (e.competitions as Record<string, unknown>[])?.[0];
      if (!comp) continue;
      const notes = (comp.notes as Array<Record<string, unknown> | string>) ?? [];
      const headline = notes.map(n => typeof n === 'string' ? n : String(n.headline ?? '')).join(' ');
      if (!headline.includes('Cup')) continue;
      const stype = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>) ?? {};
      if (!stype.completed) continue;
      const teams = extractTeams(comp as Record<string, unknown>);
      if (teams.length !== 2) continue;
      const winner = teams.find(t => t.won)?.abbr ?? null;
      const loser = teams.find(t => !t.won)?.abbr ?? null;
      if (!winner || !loser) continue;
      let round = 'Group';
      if (headline.includes('Championship')) round = 'Final';
      else if (headline.includes('Semifinal')) round = 'Semifinal';
      else if (headline.includes('Quarterfinal')) round = 'Quarterfinal';
      else continue; // skip group stage
      cup.push({ round, winner, loser });
    }

    return NextResponse.json({ series, cup });
  } catch (err) {
    console.error('[/api/playoffs]', err);
    return NextResponse.json({ series: [], cup: [] });
  }
}
