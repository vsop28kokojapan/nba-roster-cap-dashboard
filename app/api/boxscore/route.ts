export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// ESPN labels: MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-
const SHOW_COLS = [
  { label: 'MIN', idx: 0 },
  { label: 'PTS', idx: 1 },
  { label: 'REB', idx: 5 },
  { label: 'AST', idx: 6 },
  { label: 'STL', idx: 8 },
  { label: 'BLK', idx: 9 },
  { label: 'FG',  idx: 2 },
  { label: '3PT', idx: 3 },
  { label: '+/-', idx: 13 },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ home: null, away: null });

  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
      { cache: 'no-store' }
    );
    const data = await r.json();
    const bs = data.boxscore as Record<string, unknown>;

    // homeAway mapping from boxscore.teams
    const teamHomeAway = new Map<string, string>();
    for (const t of (bs.teams as Record<string, unknown>[]) ?? []) {
      const abbr = String((t.team as Record<string, unknown>)?.abbreviation ?? '');
      teamHomeAway.set(abbr, String(t.homeAway ?? ''));
    }

    // Player data from boxscore.players
    const playerGroups = (bs.players as Record<string, unknown>[]) ?? [];
    const result: Record<string, unknown> = { home: null, away: null, cols: SHOW_COLS.map(c => c.label) };

    for (const pg of playerGroups) {
      const teamInfo = pg.team as Record<string, unknown>;
      const abbr = String(teamInfo?.abbreviation ?? '');
      const homeAway = teamHomeAway.get(abbr) ?? '';
      const statCat = (pg.statistics as Record<string, unknown>[])?.[0] ?? {};
      const athletes = (statCat.athletes as Record<string, unknown>[]) ?? [];

      const players = athletes
        .filter(a => !a.didNotPlay)
        .map(a => {
          const ath = a.athlete as Record<string, unknown>;
          const rawStats = (a.stats as string[]) ?? [];
          return {
            name: String(ath?.displayName ?? ath?.shortName ?? ''),
            jersey: String(ath?.jersey ?? ''),
            position: String((ath?.position as Record<string, unknown>)?.abbreviation ?? ''),
            starter: Boolean(a.starter),
            stats: SHOW_COLS.map(c => rawStats[c.idx] ?? '—'),
          };
        })
        .sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0));

      const teamData = {
        abbr,
        name: String(teamInfo?.displayName ?? abbr),
        players,
      };

      if (homeAway === 'home') result.home = teamData;
      else result.away = teamData;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/boxscore]', err);
    return NextResponse.json({ home: null, away: null, cols: [] });
  }
}
