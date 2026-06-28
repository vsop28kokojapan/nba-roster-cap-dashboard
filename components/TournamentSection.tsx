'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SeasonStandings, SeasonAwards, StandingEntry } from '@/lib/types';

type BracketTab = 'cup' | 'playin' | 'playoffs';

const R1_PAIRS: [number, number][] = [[1,8],[4,5],[3,6],[2,7]];

interface SeriesData { winner: string; loser: string; winsW: number; winsL: number }
interface CupGame { round: string; winner: string; loser: string }
interface PlayinGame { round: string; conf: string; winner: string; loser: string; scoreW: string; scoreL: string }
interface CupGroupEntry { abbr: string; wins: number; losses: number }
interface PlayoffApiResult {
  series: SeriesData[];
  cup: CupGame[];
  playin: PlayinGame[];
  cupGroup: CupGroupEntry[];
}

function findSeries(series: SeriesData[], a: string | null, b: string | null): SeriesData | null {
  if (!a || !b) return null;
  return series.find(s =>
    (s.winner === a && s.loser === b) || (s.winner === b && s.loser === a)
  ) ?? null;
}

// ── Team pill ─────────────────────────────────────────────────────────────────

function TeamPill({
  entry, isWinner, isLoser, showRecord = true,
}: {
  entry: StandingEntry | null | undefined;
  isWinner?: boolean;
  isLoser?: boolean;
  showRecord?: boolean;
}) {
  if (!entry) return <div className="bracket-team placeholder">TBD</div>;
  const cls = isWinner ? ' bt-winner' : isLoser ? ' bt-loser' : '';
  return (
    <Link href={`/team/${entry.abbr}`} className={`bracket-team${cls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {entry.logo && <img src={entry.logo} alt={entry.abbr} width={18} height={18} />}
      <span className="bt-seed">{entry.rank}</span>
      <span className="bt-abbr">{entry.abbr}</span>
      {isWinner && <span className="bt-crown">✓</span>}
      {showRecord && <span className="bt-rec">{entry.wins}-{entry.losses}</span>}
    </Link>
  );
}

// ── Matchup box ───────────────────────────────────────────────────────────────

function MatchupBox({
  top, bot, series, label, scoreTop, scoreBot,
}: {
  top: StandingEntry | null | undefined;
  bot: StandingEntry | null | undefined;
  series?: SeriesData | null;
  label?: string;
  scoreTop?: string;
  scoreBot?: string;
}) {
  const hasScore = Boolean(scoreTop && scoreBot);
  const hasSeries = Boolean(series);
  const topWon = (hasSeries && series!.winner === top?.abbr) || (hasScore && !hasSeries && Boolean(scoreTop));
  const botWon = (hasSeries && series!.winner === bot?.abbr) || (hasScore && !hasSeries && Boolean(scoreBot));

  let vsContent: React.ReactNode = 'vs';
  if (hasSeries) vsContent = <span className="bt-score">{series!.winsW}-{series!.winsL}</span>;
  else if (hasScore) vsContent = <span className="bt-score">{scoreTop}-{scoreBot}</span>;

  return (
    <div className="bracket-matchup">
      {label && <span className="bracket-matchup-label">{label}</span>}
      <TeamPill entry={top} isWinner={topWon} isLoser={(hasSeries || hasScore) && !topWon && top != null} />
      <div className="bracket-vs">{vsContent}</div>
      <TeamPill entry={bot} isWinner={botWon} isLoser={(hasSeries || hasScore) && !botWon && bot != null} />
    </div>
  );
}

// ── Playoff bracket ───────────────────────────────────────────────────────────

function PlayoffBracket({
  east, west, series, allByAbbr,
}: {
  east: StandingEntry[];
  west: StandingEntry[];
  series: SeriesData[];
  allByAbbr: Map<string, StandingEntry>;
}) {
  function buildConf(entries: StandingEntry[]) {
    const r1 = R1_PAIRS.map(([s1, s2]) => {
      const top = entries.find(e => e.rank === s1) ?? null;
      const bot = entries.find(e => e.rank === s2) ?? null;
      const s = findSeries(series, top?.abbr ?? null, bot?.abbr ?? null);
      return { top, bot, s, winner: s?.winner ?? null };
    });
    const r2 = ([[0,1],[2,3]] as [number, number][]).map(([i,j]) => {
      const top = r1[i].winner ? (allByAbbr.get(r1[i].winner!) ?? null) : null;
      const bot = r1[j].winner ? (allByAbbr.get(r1[j].winner!) ?? null) : null;
      const s = findSeries(series, top?.abbr ?? null, bot?.abbr ?? null);
      return { top, bot, s, winner: s?.winner ?? null };
    });
    const cfTop = r2[0].winner ? (allByAbbr.get(r2[0].winner!) ?? null) : null;
    const cfBot = r2[1].winner ? (allByAbbr.get(r2[1].winner!) ?? null) : null;
    const cfS = findSeries(series, cfTop?.abbr ?? null, cfBot?.abbr ?? null);
    return { r1, r2, cf: { top: cfTop, bot: cfBot, s: cfS, winner: cfS?.winner ?? null } };
  }

  const eastB = buildConf(east);
  const westB = buildConf(west);
  const finTop = eastB.cf.winner ? (allByAbbr.get(eastB.cf.winner!) ?? null) : null;
  const finBot = westB.cf.winner ? (allByAbbr.get(westB.cf.winner!) ?? null) : null;
  const finS = findSeries(series, finTop?.abbr ?? null, finBot?.abbr ?? null);

  const renderConf = (b: ReturnType<typeof buildConf>, label: string) => (
    <div className="playoff-conf-bracket">
      <h4 className="bracket-conf-title">{label} カンファレンス</h4>
      <div className="playoff-rounds">
        <div className="playoff-round">
          <p className="round-label">1回戦</p>
          {b.r1.map((slot, i) => (
            <MatchupBox key={i} top={slot.top} bot={slot.bot} series={slot.s} />
          ))}
        </div>
        <div className="playoff-round">
          <p className="round-label">準決勝</p>
          {b.r2.map((slot, i) => (
            <MatchupBox key={i} top={slot.top} bot={slot.bot} series={slot.s} />
          ))}
        </div>
        <div className="playoff-round">
          <p className="round-label">カンファレンス決勝</p>
          <MatchupBox top={b.cf.top} bot={b.cf.bot} series={b.cf.s} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="playoff-bracket-wrap">
        {renderConf(eastB, 'イースタン')}
        {renderConf(westB, 'ウェスタン')}
      </div>
      <div className="playoff-finals-section">
        <p className="round-label finals-label">🏆 NBAファイナル</p>
        <MatchupBox top={finTop} bot={finBot} series={finS} />
        {finS?.winner && (
          <p className="champion-text">
            🏆 <b>{finTop?.abbr === finS.winner ? finTop?.abbr : finBot?.abbr}</b> が チャンピオン
          </p>
        )}
      </div>
    </>
  );
}

// ── Play-in section ───────────────────────────────────────────────────────────

function PlayInSection({
  east, west, playin, allByAbbr,
}: {
  east: StandingEntry[];
  west: StandingEntry[];
  playin: PlayinGame[];
  allByAbbr: Map<string, StandingEntry>;
}) {
  const hasData = playin.length > 0;

  const render = (entries: StandingEntry[], conf: string) => {
    const confGames = playin.filter(g => g.conf === conf);
    const game78 = confGames.find(g => g.round === '7v8');
    const game910 = confGames.find(g => g.round === '9v10');
    const consolation = confGames.find(g => g.round === 'consolation');

    // Fall back to seed positions if no data
    const seed = (n: number) => entries.find(e => e.rank === n) ?? null;
    const top78 = game78 ? allByAbbr.get(game78.winner) : seed(7);
    const bot78 = game78 ? allByAbbr.get(game78.loser) : seed(8);
    const top910 = game910 ? allByAbbr.get(game910.winner) : seed(9);
    const bot910 = game910 ? allByAbbr.get(game910.loser) : seed(10);
    const topCons = consolation ? allByAbbr.get(consolation.winner) : seed(8);
    const botCons = consolation ? allByAbbr.get(consolation.loser) : seed(9);

    const playoff7 = consolation ? allByAbbr.get(game78?.winner ?? '') : seed(7);
    const playoff8 = consolation ? allByAbbr.get(consolation.winner) : seed(8);

    return (
      <div className="playin-conf">
        <h4 className="bracket-conf-title">{conf === 'East' ? 'イースタン' : 'ウェスタン'}</h4>
        <div className="playin-grid">
          <MatchupBox
            top={top78} bot={bot78}
            label="7-8戦：勝者が7位シード確定"
            scoreTop={game78 ? game78.scoreW : undefined}
            scoreBot={game78 ? game78.scoreL : undefined}
          />
          <MatchupBox
            top={top910} bot={bot910}
            label="9-10戦：敗者は敗退"
            scoreTop={game910 ? game910.scoreW : undefined}
            scoreBot={game910 ? game910.scoreL : undefined}
          />
        </div>
        <MatchupBox
          top={topCons} bot={botCons}
          label="敗者戦：8位シードを賭けて"
          scoreTop={consolation ? consolation.scoreW : undefined}
          scoreBot={consolation ? consolation.scoreL : undefined}
        />
        {hasData && playoff7 && playoff8 && (
          <p className="playin-note">
            ✓ = プレーオフ進出（{playoff7.abbr}が7位、{playoff8.abbr}が8位シード獲得）
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="playin-section">
      {render(east, 'East')}
      {render(west, 'West')}
    </div>
  );
}

// ── NBA Cup section ───────────────────────────────────────────────────────────

function CupMatchup({
  winner, loser, allByAbbr,
}: {
  winner: string; loser: string;
  allByAbbr: Map<string, StandingEntry>;
}) {
  return (
    <div className="bracket-matchup" style={{ margin: 0 }}>
      <TeamPill entry={allByAbbr.get(winner)} isWinner showRecord={false} />
      <div className="bracket-vs">vs</div>
      <TeamPill entry={allByAbbr.get(loser)} isLoser showRecord={false} />
    </div>
  );
}

function NbaCupSection({
  awards, cup, cupGroup, allByAbbr, east, west,
}: {
  awards: SeasonAwards | undefined;
  cup: CupGame[];
  cupGroup: CupGroupEntry[];
  allByAbbr: Map<string, StandingEntry>;
  east: StandingEntry[];
  west: StandingEntry[];
}) {
  const qf = cup.filter(c => c.round === 'Quarterfinal');
  const sf = cup.filter(c => c.round === 'Semifinal');
  const fin = cup.find(c => c.round === 'Final');
  const cupMvp = awards?.nbaCupMvp;

  const eastAbbrs = new Set(east.map(e => e.abbr));
  const westAbbrs = new Set(west.map(e => e.abbr));
  const eastGroup = cupGroup.filter(g => eastAbbrs.has(g.abbr));
  const westGroup = cupGroup.filter(g => westAbbrs.has(g.abbr));

  // QF winners advance: color them in group table
  const qfAdvancers = new Set(cup.map(c => c.winner));

  const renderGroupTable = (entries: CupGroupEntry[], label: string) => (
    <div className="cup-group-conf">
      <p className="cup-group-conf-title">{label}</p>
      <table className="cup-group-table">
        <thead>
          <tr>
            <th className="cgt-team">チーム</th>
            <th className="cgt-num">W</th>
            <th className="cgt-num">L</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(g => {
            const entry = allByAbbr.get(g.abbr);
            const advanced = qf.some(q => q.winner === g.abbr || q.loser === g.abbr);
            return (
              <tr key={g.abbr} className={advanced ? 'cgt-advanced' : ''}>
                <td className="cgt-team">
                  <Link href={`/team/${g.abbr}`} className="cgt-team-link">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {entry?.logo && <img src={entry.logo} alt={g.abbr} width={16} height={16} />}
                    <span>{g.abbr}</span>
                    {advanced && <span className="cgt-adv-badge">QF進出</span>}
                  </Link>
                </td>
                <td className="cgt-num cgt-w">{g.wins}</td>
                <td className="cgt-num cgt-l">{g.losses}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="cup-section">
      <div className="cup-hero">
        <span className="cup-trophy">🥇</span>
        <div>
          <p className="cup-title">NBA カップ（インシーズン・トーナメント）</p>
          <p className="cup-sub">毎年11〜12月に開催。優勝チームに賞金$500,000/選手</p>
        </div>
      </div>

      {(fin || cupMvp) && (
        <div className="cup-champion-row">
          {fin && (
            <div className="cup-champion-card">
              <span className="cup-champ-icon">🏆</span>
              <span className="cup-champ-label">優勝</span>
              <TeamPill entry={allByAbbr.get(fin.winner)} isWinner showRecord={false} />
            </div>
          )}
          {cupMvp && (
            <div className="cup-mvp-card">
              <span className="cup-mvp-icon">⭐</span>
              <div>
                <p className="cup-mvp-label">カップMVP</p>
                <p className="cup-mvp-name">{cupMvp.athleteName}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group stage standings */}
      {cupGroup.length > 0 && (
        <div className="cup-group-section">
          <p className="round-label" style={{ marginBottom: 12 }}>グループステージ（カップ成績）</p>
          <div className="cup-group-tables">
            {renderGroupTable(eastGroup, 'イースタン')}
            {renderGroupTable(westGroup, 'ウェスタン')}
          </div>
          <p className="cup-group-note">※ QF進出は上位8チーム（各カンファレンス上位4名）</p>
        </div>
      )}

      {/* Knockout bracket */}
      {cup.length > 0 && (
        <div className="cup-bracket">
          {qf.length > 0 && (
            <div className="cup-bracket-round">
              <p className="round-label">準々決勝</p>
              <div className="cup-matchups-grid">
                {qf.map((g, i) => <CupMatchup key={i} {...g} allByAbbr={allByAbbr} />)}
              </div>
            </div>
          )}
          {sf.length > 0 && (
            <div className="cup-bracket-round">
              <p className="round-label">準決勝</p>
              <div className="cup-matchups-grid">
                {sf.map((g, i) => <CupMatchup key={i} {...g} allByAbbr={allByAbbr} />)}
              </div>
            </div>
          )}
          {fin && (
            <div className="cup-bracket-round">
              <p className="round-label">決勝</p>
              <CupMatchup {...fin} allByAbbr={allByAbbr} />
            </div>
          )}
        </div>
      )}

      {cup.length === 0 && cupGroup.length === 0 && (
        <p className="cup-note-sub">カップ結果を読み込み中…</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TournamentSection({
  standings,
  awards,
}: {
  standings: SeasonStandings | undefined;
  awards: SeasonAwards | undefined;
}) {
  const [tab, setTab] = useState<BracketTab>('playoffs');
  const [apiData, setApiData] = useState<PlayoffApiResult>({ series: [], cup: [], playin: [], cupGroup: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!standings?.season) return;
    fetch(`/api/playoffs?season=${encodeURIComponent(standings.season)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: PlayoffApiResult) => { setApiData(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [standings?.season]);

  if (!standings) return null;

  const allEntries = [...standings.east, ...standings.west];
  const allByAbbr = new Map(allEntries.map(e => [e.abbr, e]));
  const hasResults = loaded && apiData.series.length > 0;

  return (
    <section className="tournament-section">
      <div className="tournament-header">
        <h2 className="tournament-title">トーナメント</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="tournament-season">{standings.season}</p>
          {hasResults && <span className="bracket-live-badge">結果反映済</span>}
        </div>
      </div>
      <div className="tournament-tabs">
        {([['playoffs', 'プレーオフ'], ['playin', 'プレーイン'], ['cup', 'NBAカップ']] as [BracketTab, string][]).map(([id, label]) => (
          <button
            key={id}
            className={`tournament-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {hasResults && tab !== 'cup' && (
        <div className="bracket-legend">
          <span className="bl-item bl-win">✓ 勝者</span>
          <span className="bl-item bl-lose">● 敗退</span>
        </div>
      )}

      {tab === 'cup' && (
        <NbaCupSection
          awards={awards}
          cup={apiData.cup}
          cupGroup={apiData.cupGroup}
          allByAbbr={allByAbbr}
          east={standings.east}
          west={standings.west}
        />
      )}
      {tab === 'playin' && (
        <PlayInSection
          east={standings.east}
          west={standings.west}
          playin={apiData.playin}
          allByAbbr={allByAbbr}
        />
      )}
      {tab === 'playoffs' && (
        <PlayoffBracket
          east={standings.east}
          west={standings.west}
          series={apiData.series}
          allByAbbr={allByAbbr}
        />
      )}

      <p className="bracket-disclaimer">
        ※プレーオフ・プレーイン・カップ結果はESPNから自動取得。
      </p>
    </section>
  );
}
