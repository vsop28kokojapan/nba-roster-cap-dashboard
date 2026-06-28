'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SeasonStandings, SeasonAwards, StandingEntry } from '@/lib/types';

type BracketTab = 'cup' | 'playin' | 'playoffs';
type SeriesResult = 'winner' | 'loser';

// Seed matchups: 1v8, 2v7, 3v6, 4v5
const R1_SEEDS: [number, number][] = [[1,8],[4,5],[3,6],[2,7]];

async function fetchSeriesMap(season: string): Promise<Map<string, SeriesResult>> {
  try {
    const r = await fetch(`/api/playoffs?season=${encodeURIComponent(season)}`, { cache: 'no-store' });
    const { seriesWinners, seriesLosers } = await r.json() as {
      seriesWinners: string[];
      seriesLosers: string[];
    };
    const map = new Map<string, SeriesResult>();
    // R1 loser = eliminated in first round (lost a series, never won one)
    const wSet = new Set(seriesWinners);
    for (const abbr of seriesLosers) {
      if (!wSet.has(abbr)) map.set(abbr, 'loser');
    }
    // Won at least one series = show as winner in R1 slot
    for (const abbr of seriesWinners) {
      map.set(abbr, 'winner');
    }
    return map;
  } catch {
    return new Map();
  }
}

function TeamPill({
  entry, showRecord = true, result,
}: {
  entry: StandingEntry; showRecord?: boolean; result?: SeriesResult;
}) {
  const cls = result === 'winner' ? ' bt-winner' : result === 'loser' ? ' bt-loser' : '';
  return (
    <Link href={`/team/${entry.abbr}`} className={`bracket-team${cls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {entry.logo && <img src={entry.logo} alt={entry.abbr} width={20} height={20} />}
      <span className="bt-seed">{entry.rank}</span>
      <span className="bt-abbr">{entry.abbr}</span>
      {result === 'winner' && <span className="bt-crown">✓</span>}
      {showRecord && <span className="bt-rec">{entry.wins}-{entry.losses}</span>}
    </Link>
  );
}

function MatchupCard({
  top, bot, label, sm,
}: {
  top: StandingEntry | null; bot: StandingEntry | null; label?: string;
  sm?: Map<string, SeriesResult>;
}) {
  return (
    <div className="bracket-matchup">
      {label && <span className="bracket-matchup-label">{label}</span>}
      {top
        ? <TeamPill entry={top} result={sm?.get(top.abbr)} />
        : <div className="bracket-team placeholder">TBD</div>}
      <div className="bracket-vs">vs</div>
      {bot
        ? <TeamPill entry={bot} result={sm?.get(bot.abbr)} />
        : <div className="bracket-team placeholder">TBD</div>}
    </div>
  );
}

function PlayInSection({
  east, west, sm,
}: {
  east: StandingEntry[]; west: StandingEntry[];
  sm?: Map<string, SeriesResult>;
}) {
  const render = (entries: StandingEntry[], conf: string) => {
    const s = (n: number) => entries.find(e => e.rank === n) ?? null;
    return (
      <div className="playin-conf">
        <h4 className="bracket-conf-title">{conf}</h4>
        <div className="playin-grid">
          <MatchupCard top={s(7)} bot={s(8)} label="勝利チームが7位シード確定" sm={sm} />
          <MatchupCard top={s(9)} bot={s(10)} label="敗者は敗退" sm={sm} />
        </div>
        <p className="playin-note">
          7-8戦の敗者 vs 9-10戦の勝者 → 最後の8位シードを争う
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

function PlayoffBracket({
  east, west, sm,
}: {
  east: StandingEntry[]; west: StandingEntry[];
  sm?: Map<string, SeriesResult>;
}) {
  const s = (entries: StandingEntry[], n: number) => entries.find(e => e.rank === n) ?? null;
  return (
    <div className="playoff-bracket-wrap">
      {['east', 'west'].map(side => {
        const entries = side === 'east' ? east : west;
        const label = side === 'east' ? 'イースタン' : 'ウェスタン';
        return (
          <div key={side} className="playoff-conf-bracket">
            <h4 className="bracket-conf-title">{label} カンファレンス</h4>
            <div className="playoff-rounds">
              <div className="playoff-round">
                <p className="round-label">1回戦</p>
                {R1_SEEDS.map(([a, b]) => (
                  <MatchupCard key={`${a}v${b}`} top={s(entries, a)} bot={s(entries, b)} sm={sm} />
                ))}
              </div>
              <div className="playoff-round">
                <p className="round-label">準決勝</p>
                <MatchupCard top={null} bot={null} sm={sm} />
                <MatchupCard top={null} bot={null} sm={sm} />
              </div>
              <div className="playoff-round">
                <p className="round-label">カンファレンス決勝</p>
                <MatchupCard top={null} bot={null} sm={sm} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="playoff-finals">
        <p className="round-label finals-label">🏆 NBAファイナル</p>
        <MatchupCard top={null} bot={null} sm={sm} />
        <p className="finals-note">イースト代表 vs ウェスト代表</p>
      </div>
    </div>
  );
}

function NbaCupSection({ awards }: { awards: SeasonAwards | undefined }) {
  const cupMvp = awards?.nbaCupMvp;
  return (
    <div className="cup-section">
      <div className="cup-hero">
        <span className="cup-trophy">🥇</span>
        <div>
          <p className="cup-title">NBA カップ（インシーズン・トーナメント）</p>
          <p className="cup-sub">毎年11〜12月に開催される公式トーナメント。優勝チームに賞金$500,000/選手</p>
        </div>
      </div>
      {cupMvp && (
        <div className="cup-mvp-card">
          <span className="cup-mvp-icon">🏆</span>
          <div>
            <p className="cup-mvp-label">カップMVP</p>
            <p className="cup-mvp-name">{cupMvp.athleteName}</p>
          </div>
        </div>
      )}
      <div className="cup-bracket-note">
        <p>グループステージ（東西各5グループ） → 準々決勝8チーム → 準決勝 → 決勝（ラスベガス開催）</p>
        <p className="cup-note-sub">※詳細なトーナメント結果はESPN APIから取得できないため、シーズン更新後に反映されます</p>
      </div>
    </div>
  );
}

export default function TournamentSection({
  standings,
  awards,
}: {
  standings: SeasonStandings | undefined;
  awards: SeasonAwards | undefined;
}) {
  const [tab, setTab] = useState<BracketTab>('playoffs');
  const [sm, setSm] = useState<Map<string, SeriesResult>>(new Map());

  useEffect(() => {
    if (!standings?.season) return;
    fetchSeriesMap(standings.season).then(setSm);
  }, [standings?.season]);

  if (!standings) return null;

  const hasResults = sm.size > 0;

  return (
    <section className="tournament-section">
      <div className="tournament-header">
        <h2 className="tournament-title">トーナメント</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="tournament-season">{standings.season}</p>
          {hasResults && (
            <span className="bracket-live-badge">結果反映済</span>
          )}
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

      {tab === 'cup' && <NbaCupSection awards={awards} />}
      {tab === 'playin' && <PlayInSection east={standings.east} west={standings.west} sm={sm} />}
      {tab === 'playoffs' && <PlayoffBracket east={standings.east} west={standings.west} sm={sm} />}

      {hasResults && (
        <div className="bracket-legend">
          <span className="bl-item bl-win">✓ 勝者</span>
          <span className="bl-item bl-lose">● 敗退</span>
        </div>
      )}
      <p className="bracket-disclaimer">
        ※ブラケットは順位表のシードから構成。実際の対戦結果はシーズン終了後のデータ更新で反映されます。
      </p>
    </section>
  );
}
