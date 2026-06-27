'use client';
import { useEffect, useState } from 'react';

interface SBTeam { abbreviation: string; displayName: string; logo: string }
interface SBSide { team: SBTeam; score: string; winner: boolean }
interface SBGame {
  id: string; state: string; statusText: string; clock: string; period: number;
  home: SBSide; away: SBSide;
}

function parseSide(c: Record<string, unknown>): SBSide {
  const t = c.team as Record<string, unknown>;
  const logos = t.logos as Array<{ href: string; rel?: string[] }> | undefined;
  const logo = logos?.find(l => l.rel?.includes('default'))?.href ?? logos?.[0]?.href ?? '';
  return {
    team: { abbreviation: String(t.abbreviation ?? ''), displayName: String(t.displayName ?? ''), logo },
    score: String(c.score ?? ''),
    winner: Boolean(c.winner),
  };
}

async function fetchGames(): Promise<SBGame[]> {
  const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
    cache: 'no-store',
  });
  const d = await r.json();
  return (d.events ?? []).map((e: Record<string, unknown>) => {
    const comp = (e.competitions as Record<string, unknown>[])[0];
    const cs = comp.competitors as Record<string, unknown>[];
    const home = cs.find(c => c.homeAway === 'home');
    const away = cs.find(c => c.homeAway === 'away');
    const st = e.status as Record<string, unknown>;
    const stype = st.type as Record<string, unknown>;
    return {
      id: String(e.id),
      state: String(stype.state ?? 'pre'),
      statusText: String(stype.shortDetail ?? stype.description ?? ''),
      clock: String(st.displayClock ?? ''),
      period: Number(st.period ?? 0),
      home: parseSide(home ?? {}),
      away: parseSide(away ?? {}),
    };
  });
}

export default function Scoreboard() {
  const [games, setGames] = useState<SBGame[]>([]);

  useEffect(() => {
    fetchGames().then(setGames).catch(() => {});
    const id = setInterval(() => fetchGames().then(setGames).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  if (games.length === 0) return null;

  return (
    <div className="scoreboard-strip">
      <span className="scoreboard-label">TODAY</span>
      <div className="scoreboard-games">
        {games.map(g => (
          <div key={g.id} className="sb-card">
            <ScoreTeam side={g.away} showScore={g.state !== 'pre'} />
            <div className="sb-mid">
              {g.state === 'in' ? (
                <div className="sb-live">
                  <span className="live-dot" />
                  <span className="sb-live-text">{g.clock} {g.period > 0 ? `${g.period}Q` : ''}</span>
                </div>
              ) : (
                <span className="sb-status">{g.statusText}</span>
              )}
            </div>
            <ScoreTeam side={g.home} showScore={g.state !== 'pre'} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreTeam({ side, showScore }: { side: SBSide; showScore: boolean }) {
  return (
    <div className={`sb-team${side.winner ? ' winner' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {side.team.logo && <img src={side.team.logo} alt={side.team.abbreviation} width={24} height={24} />}
      <span className="sb-abbr">{side.team.abbreviation}</span>
      {showScore && <strong className="sb-score">{side.score}</strong>}
    </div>
  );
}
