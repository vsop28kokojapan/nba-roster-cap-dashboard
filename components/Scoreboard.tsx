'use client';
import { useEffect, useState } from 'react';

interface SBTeam { abbreviation: string; displayName: string; logo: string }
interface SBSide { team: SBTeam; score: string; winner: boolean }
interface SBGame {
  id: string; state: string; statusText: string; clock: string; period: number;
  home: SBSide; away: SBSide;
}
interface NextGames { label: string; games: SBGame[] }

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

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

function parseEvents(events: Record<string, unknown>[]): SBGame[] {
  return events.map((e: Record<string, unknown>) => {
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

async function fetchGames(): Promise<SBGame[]> {
  const r = await fetch(ESPN_SB, { cache: 'no-store' });
  const d = await r.json();
  return parseEvents(d.events ?? []);
}

async function findNextGames(today: Date): Promise<NextGames | null> {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const r = await fetch(`${ESPN_SB}?dates=${dateStr}`, { cache: 'no-store' });
      const json = await r.json();
      const events = (json.events ?? []) as Record<string, unknown>[];
      if (events.length > 0) {
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        return { label: `${m}/${day}（${dow}）`, games: parseEvents(events) };
      }
    } catch { /* skip */ }
  }
  return null;
}

export default function Scoreboard() {
  const [games, setGames] = useState<SBGame[]>([]);
  const [next, setNext] = useState<NextGames | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date();
      const g = await fetchGames().catch(() => []);
      setGames(g);
      // Look for next games: if all today's games are finished or no games today
      const allDone = g.length === 0 || g.every(x => x.state === 'post');
      if (allDone) {
        const n = await findNextGames(today);
        setNext(n);
      } else {
        // Check if there are any pre-game events today (upcoming games)
        const preGames = g.filter(x => x.state === 'pre');
        if (preGames.length > 0) {
          const m = today.getMonth() + 1;
          const day = today.getDate();
          const dow = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()];
          setNext({ label: `${m}/${day}（${dow}）予定`, games: preGames });
        }
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Show nothing only if truly no data at all
  if (games.length === 0 && !next) return null;

  // Games played today (non-pre), shown in TODAY strip
  const todayGames = games.filter(g => g.state !== 'pre');
  // Today's pre-game events handled via `next`

  return (
    <div className="scoreboard-strip">
      {todayGames.length > 0 && (
        <div className="sb-section">
          <span className="scoreboard-label">TODAY</span>
          <div className="scoreboard-games">
            {todayGames.map(g => (
              <SBCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}

      {next && next.games.length > 0 && (
        <div className="sb-section sb-next-section">
          <span className="scoreboard-label sb-label-next">NEXT <span className="sb-next-date">{next.label}</span></span>
          <div className="scoreboard-games">
            {next.games.map(g => (
              <SBCard key={g.id} game={g} showTime />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SBCard({ game: g, showTime }: { game: SBGame; showTime?: boolean }) {
  return (
    <div className="sb-card">
      <ScoreTeam side={g.away} showScore={g.state !== 'pre'} />
      <div className="sb-mid">
        {g.state === 'in' ? (
          <div className="sb-live">
            <span className="live-dot" />
            <span className="sb-live-text">{g.clock} {g.period > 0 ? `${g.period}Q` : ''}</span>
          </div>
        ) : (
          <span className="sb-status">{showTime && g.state === 'pre' ? g.statusText : g.statusText}</span>
        )}
      </div>
      <ScoreTeam side={g.home} showScore={g.state !== 'pre'} />
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
