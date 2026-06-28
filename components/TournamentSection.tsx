'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SeasonStandings, SeasonAwards, StandingEntry } from '@/lib/types';

type BracketTab = 'cup' | 'playin' | 'playoffs';

// R1 bracket pairs: [higher seed, lower seed], side A = pairs 0+1, side B = pairs 2+3
const R1_PAIRS: [number, number][] = [[1,8],[4,5],[3,6],[2,7]];

interface SeriesData { winner: string; loser: string; winsW: number; winsL: number }
interface CupGame { round: string; winner: string; loser: string }

interface PlayoffApiResult { series: SeriesData[]; cup: CupGame[] }

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
  entry: StandingEntry | null;
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
  top, bot, series, label,
}: {
  top: StandingEntry | null;
  bot: StandingEntry | null;
  series: SeriesData | null;
  label?: string;
}) {
  const done = Boolean(series);
  const topWon = done && series!.winner === top?.abbr;
  const botWon = done && series!.winner === bot?.abbr;
  return (
    <div className="bracket-matchup">
      {label && <span className="bracket-matchup-label">{label}</span>}
      <TeamPill entry={top} isWinner={topWon} isLoser={done && !topWon && top !== null} />
      <div className="bracket-vs">
        {done ? <span className="bt-score">{series!.winsW}-{series!.winsL}</span> : 'vs'}
      </div>
      <TeamPill entry={bot} isWinner={botWon} isLoser={done && !botWon && bot !== null} />
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
    // R2: sideA=[0,1], sideB=[2,3]
    const r2 = ([[0,1],[2,3]] as [number, number][]).map(([i,j]) => {
      const top = r1[i].winner ? (allByAbbr.get(r1[i].winner!) ?? null) : null;
      const bot = r1[j].winner ? (allByAbbr.get(r1[j].winner!) ?? null) : null;
      const s = findSeries(series, top?.abbr ?? null, bot?.abbr ?? null);
      return { top, bot, s, winner: s?.winner ?? null };
    });
    // CF
    const cfTop = r2[0].winner ? (allByAbbr.get(r2[0].winner!) ?? null) : null;
    const cfBot = r2[1].winner ? (allByAbbr.get(r2[1].winner!) ?? null) : null;
    const cfS = findSeries(series, cfTop?.abbr ?? null, cfBot?.abbr ?? null);
    return { r1, r2, cf: { top: cfTop, bot: cfBot, s: cfS, winner: cfS?.winner ?? null } };
  }

  const eastB = buildConf(east);
  const westB = buildConf(west);

  // Finals
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
            🏆 <b>{finTop?.abbr === finS.winner ? finTop?.abbr : finBot?.abbr}</b> が {new Date().getFullYear() - 1}-{String(new Date().getFullYear()).slice(2)} チャンピオン
          </p>
        )}
      </div>
    </>
  );
}

// ── Play-in section ───────────────────────────────────────────────────────────

function PlayInSection({
  east, west,
}: {
  east: StandingEntry[];
  west: StandingEntry[];
}) {
  const render = (entries: StandingEntry[], conf: string) => {
    const s = (n: number) => entries.find(e => e.rank === n) ?? null;
    // Seeds 7&8 made the main bracket (won play-in), 9&10 did not
    const seed7 = s(7); const seed8 = s(8);
    const seed9 = s(9); const seed10 = s(10);
    return (
      <div className="playin-conf">
        <h4 className="bracket-conf-title">{conf}</h4>
        <div className="playin-grid">
          <div className="bracket-matchup">
            <span className="bracket-matchup-label">7-8戦：勝者が7位シード確定</span>
            <TeamPill entry={seed7} isWinner={true} showRecord />
            <div className="bracket-vs">vs</div>
            <TeamPill entry={seed8} isLoser={true} showRecord />
          </div>
          <div className="bracket-matchup">
            <span className="bracket-matchup-label">9-10戦：敗者は敗退</span>
            <TeamPill entry={seed9} isLoser={true} showRecord />
            <div className="bracket-vs">vs</div>
            <TeamPill entry={seed10} isLoser={true} showRecord />
          </div>
        </div>
        <div className="bracket-matchup" style={{ marginTop: 8 }}>
          <span className="bracket-matchup-label">敗者戦：8位シードを賭けて</span>
          <TeamPill entry={seed8} isWinner={true} showRecord />
          <div className="bracket-vs">vs</div>
          <TeamPill entry={seed9} isLoser={true} showRecord />
        </div>
        <p className="playin-note">
          ✓ = プレーオフ進出（{seed7?.abbr}が7位、{seed8?.abbr}が8位シード獲得）
        </p>
      </div>
    );
  };
  return (
    <div className="playin-section">
      {render(east, 'イースタン')}
      {render(west, 'ウェスタン')}
    </div>
  );
}

// ── NBA Cup section ───────────────────────────────────────────────────────────

function CupMatchup({
  winner, loser, round, allByAbbr,
}: {
  winner: string; loser: string; round: string;
  allByAbbr: Map<string, StandingEntry>;
}) {
  const wEntry = allByAbbr.get(winner) ?? null;
  const lEntry = allByAbbr.get(loser) ?? null;
  return (
    <div className="cup-matchup">
      <span className="cup-round-label">{round}</span>
      <div className="bracket-matchup" style={{ margin: 0 }}>
        <TeamPill entry={wEntry} isWinner showRecord={false} />
        <div className="bracket-vs">vs</div>
        <TeamPill entry={lEntry} isLoser showRecord={false} />
      </div>
    </div>
  );
}

function NbaCupSection({
  awards, cup, allByAbbr,
}: {
  awards: SeasonAwards | undefined;
  cup: CupGame[];
  allByAbbr: Map<string, StandingEntry>;
}) {
  const qf = cup.filter(c => c.round === 'Quarterfinal');
  const sf = cup.filter(c => c.round === 'Semifinal');
  const fin = cup.find(c => c.round === 'Final');
  const cupMvp = awards?.nbaCupMvp;

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
              <TeamPill entry={allByAbbr.get(fin.winner) ?? null} isWinner showRecord={false} />
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
      {cup.length > 0 && (
        <div className="cup-bracket">
          {qf.length > 0 && (
            <div className="cup-bracket-round">
              <p className="round-label">準々決勝</p>
              <div className="cup-matchups-grid">
                {qf.map((g, i) => (
                  <CupMatchup key={i} {...g} allByAbbr={allByAbbr} />
                ))}
              </div>
            </div>
          )}
          {sf.length > 0 && (
            <div className="cup-bracket-round">
              <p className="round-label">準決勝</p>
              <div className="cup-matchups-grid">
                {sf.map((g, i) => (
                  <CupMatchup key={i} {...g} allByAbbr={allByAbbr} />
                ))}
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
      {cup.length === 0 && (
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
  const [apiData, setApiData] = useState<PlayoffApiResult>({ series: [], cup: [] });
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
        <NbaCupSection awards={awards} cup={apiData.cup} allByAbbr={allByAbbr} />
      )}
      {tab === 'playin' && (
        <PlayInSection east={standings.east} west={standings.west} />
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
        ※シードは順位表から算出。プレーオフ結果はESPNから自動取得。
      </p>
    </section>
  );
}
