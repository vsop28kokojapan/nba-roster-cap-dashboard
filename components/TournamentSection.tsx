'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { SeasonStandings, SeasonAwards, StandingEntry } from '@/lib/types';

type BracketTab = 'cup' | 'playin' | 'playoffs';

// Seed matchups: 1v8, 2v7, 3v6, 4v5
const R1_SEEDS: [number, number][] = [[1,8],[4,5],[3,6],[2,7]];

function TeamPill({ entry, showRecord = true }: { entry: StandingEntry; showRecord?: boolean }) {
  return (
    <Link href={`/team/${entry.abbr}`} className="bracket-team">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {entry.logo && <img src={entry.logo} alt={entry.abbr} width={20} height={20} />}
      <span className="bt-seed">{entry.rank}</span>
      <span className="bt-abbr">{entry.abbr}</span>
      {showRecord && <span className="bt-rec">{entry.wins}-{entry.losses}</span>}
    </Link>
  );
}

function MatchupCard({
  top, bot, label,
}: {
  top: StandingEntry | null; bot: StandingEntry | null; label?: string;
}) {
  return (
    <div className="bracket-matchup">
      {label && <span className="bracket-matchup-label">{label}</span>}
      {top ? <TeamPill entry={top} /> : <div className="bracket-team placeholder">TBD</div>}
      <div className="bracket-vs">vs</div>
      {bot ? <TeamPill entry={bot} /> : <div className="bracket-team placeholder">TBD</div>}
    </div>
  );
}

function PlayInSection({ east, west }: { east: StandingEntry[]; west: StandingEntry[] }) {
  const render = (entries: StandingEntry[], conf: string) => {
    const s = (n: number) => entries.find(e => e.rank === n) ?? null;
    return (
      <div className="playin-conf">
        <h4 className="bracket-conf-title">{conf}</h4>
        <div className="playin-grid">
          <MatchupCard top={s(7)} bot={s(8)} label="勝利チームが7位シード確定" />
          <MatchupCard top={s(9)} bot={s(10)} label="敗者は敗退" />
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

function PlayoffBracket({ east, west }: { east: StandingEntry[]; west: StandingEntry[] }) {
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
                  <MatchupCard key={`${a}v${b}`} top={s(entries, a)} bot={s(entries, b)} />
                ))}
              </div>
              <div className="playoff-round">
                <p className="round-label">準決勝</p>
                <MatchupCard top={null} bot={null} />
                <MatchupCard top={null} bot={null} />
              </div>
              <div className="playoff-round">
                <p className="round-label">カンファレンス決勝</p>
                <MatchupCard top={null} bot={null} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="playoff-finals">
        <p className="round-label finals-label">🏆 NBAファイナル</p>
        <MatchupCard top={null} bot={null} />
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

  if (!standings) return null;

  return (
    <section className="tournament-section">
      <div className="tournament-header">
        <h2 className="tournament-title">トーナメント</h2>
        <p className="tournament-season">{standings.season}</p>
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
      {tab === 'playin' && <PlayInSection east={standings.east} west={standings.west} />}
      {tab === 'playoffs' && <PlayoffBracket east={standings.east} west={standings.west} />}

      <p className="bracket-disclaimer">
        ※ブラケットは順位表のシードから構成。実際の対戦結果はシーズン終了後のデータ更新で反映されます。
      </p>
    </section>
  );
}
