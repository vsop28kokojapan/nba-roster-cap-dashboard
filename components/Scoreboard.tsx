'use client';
import { useEffect, useState } from 'react';

interface SBTeam { abbreviation: string; displayName: string; logo: string }
interface SBSide { team: SBTeam; score: string; winner: boolean }
interface SBGame {
  id: string; state: string; statusText: string; clock: string; period: number;
  home: SBSide; away: SBSide;
}
interface NextGames { label: string; games: SBGame[] }

interface PlayerRow { name: string; jersey: string; position: string; starter: boolean; stats: string[] }
interface TeamBS { abbr: string; name: string; players: PlayerRow[] }
interface BoxScoreData { home: TeamBS | null; away: TeamBS | null; cols: string[] }

const ESPN_SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const STAT_COLS = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT', '+/-'];

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

// ── Game Box Score Drawer ─────────────────────────────────────────────────────

function GameDrawer({ game, onClose }: { game: SBGame; onClose: () => void }) {
  const [bs, setBs] = useState<BoxScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/boxscore?gameId=${game.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: BoxScoreData) => { setBs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [game.id]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-matchup-title">
            <div className="drawer-team">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {game.away.team.logo && <img src={game.away.team.logo} alt={game.away.team.abbreviation} width={28} height={28} />}
              <span className={game.away.winner ? 'drawer-team-winner' : ''}>{game.away.team.abbreviation}</span>
              {game.state !== 'pre' && (
                <span className={`drawer-game-score${game.away.winner ? ' drawer-score-win' : ''}`}>{game.away.score}</span>
              )}
            </div>
            <span className="drawer-vs">
              {game.state === 'in' ? <span className="drawer-live-badge">LIVE</span> : game.statusText}
            </span>
            <div className="drawer-team">
              {game.state !== 'pre' && (
                <span className={`drawer-game-score${game.home.winner ? ' drawer-score-win' : ''}`}>{game.home.score}</span>
              )}
              <span className={game.home.winner ? 'drawer-team-winner' : ''}>{game.home.team.abbreviation}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {game.home.team.logo && <img src={game.home.team.logo} alt={game.home.team.abbreviation} width={28} height={28} />}
            </div>
          </div>
          {game.state === 'in' && (
            <p className="drawer-subtitle">{game.clock} {game.period > 0 ? `第${game.period}Q` : ''}</p>
          )}
          <button className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className="drawer-body">
          {loading && <p className="drawer-loading">スタッツ読み込み中…</p>}
          {!loading && !bs?.home && !bs?.away && (
            <p className="drawer-loading">スタッツデータが取得できませんでした</p>
          )}
          {!loading && bs && (
            <div className="boxscore-wrap" style={{ borderTop: 'none', paddingTop: 0 }}>
              {[bs.away, bs.home].filter(Boolean).map(team => team && (
                <div key={team.abbr} className="bs-team-section">
                  <div className="bs-team-header">
                    <span className="bs-team-name">{team.abbr}</span>
                  </div>
                  <div className="bs-table-wrap">
                    <table className="bs-table">
                      <thead>
                        <tr>
                          <th className="bs-col-name">選手</th>
                          {STAT_COLS.map(c => <th key={c} className="bs-col-stat">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((p, i) => (
                          <tr key={i} className={p.starter ? 'bs-starter' : 'bs-bench'}>
                            <td className="bs-col-name">
                              <span className="bs-pos">{p.position}</span>
                              <span className="bs-player-name">{p.name}</span>
                            </td>
                            {p.stats.map((s, j) => (
                              <td key={j} className={`bs-col-stat${STAT_COLS[j] === 'PTS' ? ' bs-pts' : ''}`}>{s}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Scoreboard ───────────────────────────────────────────────────────────

export default function Scoreboard() {
  const [games, setGames] = useState<SBGame[]>([]);
  const [next, setNext] = useState<NextGames | null>(null);
  const [selectedGame, setSelectedGame] = useState<SBGame | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date();
      const g = await fetchGames().catch(() => []);
      setGames(g);
      const allDone = g.length === 0 || g.every(x => x.state === 'post');
      if (allDone) {
        const n = await findNextGames(today);
        setNext(n);
      } else {
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

  if (games.length === 0 && !next) return null;

  const todayGames = games.filter(g => g.state !== 'pre');

  return (
    <>
      <div className="scoreboard-strip">
        {todayGames.length > 0 && (
          <div className="sb-section">
            <span className="scoreboard-label">TODAY</span>
            <div className="scoreboard-games">
              {todayGames.map(g => (
                <SBCard key={g.id} game={g} onClick={() => setSelectedGame(g)} />
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

      {selectedGame && (
        <GameDrawer game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </>
  );
}

function SBCard({ game: g, showTime, onClick }: { game: SBGame; showTime?: boolean; onClick?: () => void }) {
  const clickable = Boolean(onClick) && g.state !== 'pre';
  return (
    <div className={`sb-card${clickable ? ' sb-card-clickable' : ''}`} onClick={clickable ? onClick : undefined}>
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
        {clickable && <span className="sb-detail-hint">詳細</span>}
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
