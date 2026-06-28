'use client';
import { useState, useEffect } from 'react';
import type { StandingEntry } from '@/lib/types';

export type MatchType = 'playoffs' | 'playin' | 'cup-knockout' | 'cup-group';

interface Game {
  id: string;
  date: string;
  gameNum: number;
  headline: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
}

interface PlayerRow {
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  stats: string[];
}

interface TeamBS { abbr: string; name: string; players: PlayerRow[] }
interface BoxScoreData { home: TeamBS | null; away: TeamBS | null; cols: string[] }

function fmtDate(d: string) {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

function PlayerTable({ team, allByAbbr }: { team: TeamBS; allByAbbr: Map<string, StandingEntry>; cols: string[] }) {
  const entry = allByAbbr.get(team.abbr);
  const cols = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT', '+/-'];
  return (
    <div className="bs-team-section">
      <div className="bs-team-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {entry?.logo && <img src={entry.logo} alt={team.abbr} width={22} height={22} />}
        <span className="bs-team-name">{team.abbr}</span>
      </div>
      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th className="bs-col-name">選手</th>
              {cols.map(c => <th key={c} className="bs-col-stat">{c}</th>)}
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
                  <td key={j} className={`bs-col-stat${cols[j] === 'PTS' ? ' bs-pts' : ''}`}>{s}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SeriesDrawer({
  t1, t2, matchType, season, title, onClose, allByAbbr,
}: {
  t1: string; t2: string;
  matchType: MatchType;
  season: string;
  title: string;
  onClose: () => void;
  allByAbbr: Map<string, StandingEntry>;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [boxScore, setBoxScore] = useState<BoxScoreData | null>(null);
  const [loadingBS, setLoadingBS] = useState(false);

  useEffect(() => {
    setLoadingGames(true);
    fetch(`/api/series?t1=${t1}&t2=${t2}&type=${matchType}&season=${encodeURIComponent(season)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { games: Game[] }) => {
        setGames(d.games);
        setLoadingGames(false);
        // Auto-select if single game (play-in / cup)
        if (d.games.length === 1) selectGame(d.games[0]);
      })
      .catch(() => setLoadingGames(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t1, t2, matchType, season]);

  function selectGame(game: Game) {
    setSelectedGame(game);
    setBoxScore(null);
    setLoadingBS(true);
    fetch(`/api/boxscore?gameId=${game.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: BoxScoreData) => { setBoxScore(d); setLoadingBS(false); })
      .catch(() => setLoadingBS(false));
  }

  const t1Entry = allByAbbr.get(t1);
  const t2Entry = allByAbbr.get(t2);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-matchup-title">
            <div className="drawer-team">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t1Entry?.logo && <img src={t1Entry.logo} alt={t1} width={28} height={28} />}
              <span>{t1}</span>
            </div>
            <span className="drawer-vs">VS</span>
            <div className="drawer-team">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t2Entry?.logo && <img src={t2Entry.logo} alt={t2} width={28} height={28} />}
              <span>{t2}</span>
            </div>
          </div>
          <p className="drawer-subtitle">{title}</p>
          <button className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className="drawer-body">
          {/* Games list */}
          {loadingGames ? (
            <p className="drawer-loading">試合データ取得中…</p>
          ) : games.length === 0 ? (
            <p className="drawer-loading">試合データが見つかりませんでした</p>
          ) : (
            <div className="game-list">
              {games.map(g => {
                const awayWon = !g.homeWon;
                const isSelected = selectedGame?.id === g.id;
                return (
                  <button
                    key={g.id}
                    className={`game-row${isSelected ? ' active' : ''}`}
                    onClick={() => selectGame(g)}
                  >
                    <span className="game-row-label">
                      {g.headline.includes('Game') ? g.headline.replace(/^.*?(Game \d+).*$/, '$1') : `GAME ${g.gameNum}`}
                    </span>
                    <span className="game-row-date">{fmtDate(g.date)}</span>
                    <div className="game-row-score">
                      <span className={awayWon ? 'score-winner' : 'score-loser'}>{g.awayAbbr} {g.awayScore}</span>
                      <span className="score-sep">-</span>
                      <span className={g.homeWon ? 'score-winner' : 'score-loser'}>{g.homeScore} {g.homeAbbr}</span>
                    </div>
                    <span className="game-row-arrow">{isSelected ? '▲' : '▼'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Box score */}
          {loadingBS && <p className="drawer-loading">スタッツ読み込み中…</p>}
          {!loadingBS && boxScore && (boxScore.away || boxScore.home) && (
            <div className="boxscore-wrap">
              {selectedGame && (
                <p className="bs-game-label">
                  {selectedGame.headline || `GAME ${selectedGame.gameNum}`} — {fmtDate(selectedGame.date)} —&nbsp;
                  {selectedGame.awayAbbr} {selectedGame.awayScore} - {selectedGame.homeScore} {selectedGame.homeAbbr}
                </p>
              )}
              {boxScore.away && <PlayerTable team={boxScore.away} allByAbbr={allByAbbr} cols={boxScore.cols} />}
              {boxScore.home && <PlayerTable team={boxScore.home} allByAbbr={allByAbbr} cols={boxScore.cols} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
