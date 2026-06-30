'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { NBAData, Player, Team, Transaction } from '@/lib/types';
import { yen, million, fmtDate, badgeClass, distanceText, lineDifference, capScale, getTeamPhase } from '@/lib/utils';
import PhaseBadge from './PhaseBadge';
import AdBanner from './AdBanner';
import CapTrack from './CapTrack';
import ThresholdCards from './ThresholdCards';
import RuleGuide from './RuleGuide';
import ContractBadge from './ContractBadge';
import HistoryPanel from './HistoryPanel';
import AwardsPanel from './AwardsPanel';
import Scoreboard from './Scoreboard';
import StandingsHero from './StandingsHero';
import TournamentSection from './TournamentSection';
import GlossaryModal from './GlossaryModal';

type Tab = 'teams' | 'players' | 'trades' | 'history' | 'awards';

const SB_URL = 'https://wbojovciyyhkxewjfllz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib2pvdmNpeXloa3hld2pmbGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDc0NzQsImV4cCI6MjA5Nzc4MzQ3NH0.kfjq4Ww3NKppkbU9GQcKXPAPO2FNnz_BkZseiGhKHDc';

async function sbGet(path: string) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function fetchUpdatedAt(): Promise<string | null> {
  try {
    const rows = await sbGet('/rest/v1/nba_data?select=updated_at&id=eq.1');
    return rows[0]?.updated_at ?? null;
  } catch {
    return null;
  }
}

async function fetchLatestData(): Promise<NBAData | null> {
  try {
    const rows = await sbGet('/rest/v1/nba_data?select=data&id=eq.1');
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

function Badge({ status }: { status: string }) {
  return <span className={`badge ${badgeClass(status)}`}>{status}</span>;
}


function tenureLabel(years: number | null): string {
  if (years == null) return '—';
  if (years === 1) return '今季';
  return `${years}年目`;
}

function CapChartSection({ teams, data, max }: { teams: Team[]; data: NBAData; max: number }) {
  const sorted = [...teams].sort((a, b) => (b.totalCap ?? b.rosterSalary) - (a.totalCap ?? a.rosterSalary));
  return (
    <div className="cap-comparison">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow dark">LEAGUE COMPARISON</p>
          <h2>30チーム キャップ比較</h2>
        </div>
        <p>棒の右端がチーム総額。縦線が各基準です。</p>
      </div>
      <div className="chart-legend">
        <span className="lg-cap">キャップ</span>
        <span className="lg-tax">税ライン</span>
        <span className="lg-first">第1</span>
        <span className="lg-second">第2</span>
      </div>
      <div className="cap-chart">
        {sorted.map(t => {
          const total = t.totalCap ?? t.rosterSalary;
          return (
            <Link key={t.abbreviation} className="cap-row" href={`/team/${t.abbreviation}`}>
              <div className="cap-team">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.logo} alt={t.abbreviation} width={25} height={25} />
                <b>{t.abbreviation}</b>
              </div>
              <div>
                <CapTrack total={total} color={t.color} thresholds={data.thresholds} max={max} />
                <small>{distanceText(total, data.thresholds)}</small>
              </div>
              <strong>{million(total)}</strong>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TeamGrid({ teams, data, max }: { teams: Team[]; data: NBAData; max: number }) {
  if (teams.length === 0) return <p>該当するチームがありません。</p>;
  return (
    <div className="team-grid">
      {teams.map(t => {
        const total = t.totalCap ?? t.rosterSalary;
        const phase = getTeamPhase(t.abbreviation, data);
        return (
          <Link key={t.abbreviation} className="team-card" href={`/team/${t.abbreviation}`} aria-label={`${t.name}の詳細`}>
            <div className="team-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo} alt={t.name} width={46} height={46} />
              <div>
                <h2>{t.name}</h2>
                <span>{t.playerCount} players · {t.capSource}</span>
              </div>
            </div>
            <div className="team-badge-row">
              <Badge status={t.apronStatus} />
              {phase && <PhaseBadge phase={phase} />}
            </div>
            <div className="money">{yen(total)}</div>
            <div className="sub">
              総キャップ配賦額{t.deadCap != null ? ` · デッド ${yen(t.deadCap)}` : ''}
            </div>
            <p className="distance">{distanceText(total, data.thresholds)}</p>
            <CapTrack total={total} color={t.color} thresholds={data.thresholds} max={max} />
            <span className="open-detail">詳細を見る ↗</span>
          </Link>
        );
      })}
    </div>
  );
}

function buildAwardBadges(awards: NBAData['awards']): Map<string, { icon: string; label: string; season: string }[]> {
  const map = new Map<string, { icon: string; label: string; season: string }[]>();
  const add = (id: string | undefined, icon: string, label: string, season: string) => {
    if (!id) return;
    const list = map.get(id) ?? [];
    if (!list.some(b => b.label === label && b.season === season)) list.push({ icon, label, season });
    map.set(id, list);
  };
  for (const s of (awards ?? [])) {
    add(s.mvp?.athleteId, '👑', 'MVP', s.season);
    add(s.dpoy?.athleteId, '🛡', 'DPOY', s.season);
    add(s.roy?.athleteId, '⭐', 'ROY', s.season);
    add(s.finalsMvp?.athleteId, '🏆', 'Finals', s.season);
    for (const e of s.allNba1) add(e.athleteId, '★', 'All-NBA 1st', s.season);
    for (const e of s.allNba2) add(e.athleteId, '☆', 'All-NBA 2nd', s.season);
  }
  return map;
}

function PlayerTable({ players, awards }: { players: Player[]; awards: NBAData['awards'] }) {
  const badges = buildAwardBadges(awards ?? []);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>チーム</th><th>背番号</th><th>選手</th><th>POS</th>
            <th>サラリー</th><th>残年数</th><th>契約タイプ</th><th>在籍年数</th><th>トレード制限</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td><b>{p.team}</b></td>
              <td><b>{p.jersey}</b></td>
              <td>
                <div className="player">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.headshot && <img src={p.headshot} alt={p.name} width={32} height={32} />}
                  {p.profile
                    ? <a href={p.profile} target="_blank" rel="noopener noreferrer">{p.name}</a>
                    : p.name}
                  {(badges.get(p.id) ?? []).map(b => (
                    <span key={b.label + b.season} className="player-badge">
                      <span className="pb-icon">{b.icon}</span>
                      <span className="pb-label">{b.label}</span>
                      <span className="pb-season">{b.season.slice(2)}</span>
                    </span>
                  ))}
                </div>
              </td>
              <td>{p.position}</td>
              <td><b>{yen(p.salary)}</b></td>
              <td>{p.yearsRemaining ?? '—'}</td>
              <td>
                <ContractBadge type={p.contractType} />
              </td>
              <td>
                <span className="tenure-label">{tenureLabel(p.yearsWithTeam)}</span>
              </td>
              <td>{p.tradeRestricted ? 'あり' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return <p>該当するトレード情報がありません。</p>;
  return (
    <div className="trade-list">
      {transactions.map(x => (
        <article key={x.id} className="trade">
          <time>{fmtDate(x.date)}</time>
          <b>{x.team}</b>
          <span className="type">{x.type}</span>
          <div className="desc">
            <strong>{x.descriptionJa || x.description}</strong>
            <details>
              <summary>英語原文を確認</summary>
              <p>{x.description}</p>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Dashboard({ initialData }: { initialData: NBAData | null }) {
  const [data, setData] = useState<NBAData | null>(initialData);
  const [tab, setTab] = useState<Tab>('teams');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // 30-second polling: lightweight updatedAt check first, full fetch only if changed
  useEffect(() => {
    if (!data) return;
    const id = setInterval(async () => {
      const ua = await fetchUpdatedAt();
      if (!ua || ua === data.meta.updatedAt) return;
      const next = await fetchLatestData();
      if (next) setData(next);
    }, 30_000);
    return () => clearInterval(id);
  }, [data?.meta?.updatedAt]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/update', { method: 'POST' });
      const next = await fetchLatestData();
      if (next) setData(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (!data) {
    return (
      <>
        <header>
          <div>
            <p className="eyebrow">NBA OPERATIONS DESK</p>
            <h1>Roster &amp; Cap Board</h1>
          </div>
        </header>
        <main>
          <p style={{ padding: '48px', textAlign: 'center', color: '#5a6d80' }}>
            データを読み込んでいます… Supabase に接続中。
          </p>
        </main>
      </>
    );
  }

  const max = useMemo(() => capScale(data.teams, data.thresholds.secondApron), [data]);
  const q = search.trim().toLowerCase();

  const filteredTeams = useMemo(() => data.teams.filter(t =>
    (!teamFilter || t.abbreviation === teamFilter) &&
    (!statusFilter || t.apronStatus === statusFilter) &&
    (!q || `${t.name} ${t.abbreviation}`.toLowerCase().includes(q))
  ), [data.teams, teamFilter, statusFilter, q]);

  const filteredPlayers = useMemo(() => data.players.filter(p =>
    (!teamFilter || p.team === teamFilter) &&
    (!contractFilter || p.contractType === contractFilter) &&
    (!q || `${p.name} ${p.team} ${p.jersey}`.toLowerCase().includes(q))
  ), [data.players, teamFilter, contractFilter, q]);

  const filteredTrades = useMemo(() => data.transactions.filter(x =>
    (!teamFilter || x.team === teamFilter) &&
    (!q || `${x.descriptionJa ?? ''} ${x.description} ${x.teamName}`.toLowerCase().includes(q)) &&
    (tab !== 'trades' || x.type === 'トレード')
  ), [data.transactions, teamFilter, q, tab]);

  function handleCSV() {
    let rows: Record<string, unknown>[];
    if (tab === 'teams') {
      rows = filteredTeams.map(t => ({
        Team: t.abbreviation, Name: t.name, Players: t.playerCount,
        TotalCap: t.totalCap, RosterSalary: t.rosterSalary, DeadCap: t.deadCap, Apron: t.apronStatus,
      }));
    } else if (tab === 'players') {
      rows = filteredPlayers.map(p => ({
        Team: p.team, Player: p.name, Jersey: p.jersey, Position: p.position,
        Salary: p.salary, YearsRemaining: p.yearsRemaining,
        ContractType: p.contractType ?? 'standard',
        YearsWithTeam: p.yearsWithTeam,
        TeamJoinedSeason: p.teamJoinedSeason,
        TradeRestricted: p.tradeRestricted,
      }));
    } else {
      rows = filteredTrades.map(x => ({
        Date: x.date, Team: x.team, Type: x.type, Japanese: x.descriptionJa, English: x.description,
      }));
    }
    const keys = Object.keys(rows[0] ?? {});
    const text = [
      keys.join(','),
      ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replaceAll('"', '""')}"`).join(',')),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' }));
    a.download = `nba-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const showToolbar = tab !== 'history' && tab !== 'awards';

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">NBA ANALYTICS</p>
          <h1>THE FRONT OFFICE</h1>
          <p className="meta">
            {data.meta.season} · 更新 {new Date(data.meta.updatedAt).toLocaleString('ja-JP')} · {data.players.length}選手
          </p>
        </div>
        <div className="header-actions">
          <span className="glossary-header-desktop-only">
            <GlossaryModal triggerClassName="glossary-link" />
          </span>
          <a className="glossary-link glossary-header-mobile-only" href="/glossary" target="_blank" rel="noopener noreferrer">
            📖 用語集
          </a>
          <button onClick={handleRefresh} disabled={refreshing} style={{ whiteSpace: 'nowrap' }}>
            {refreshing ? '更新中…' : '↻ データを更新'}
          </button>
        </div>
      </header>

      <main>
        <Scoreboard />
        {(data.standings?.length ?? 0) > 0 && (() => {
          const curStandings = data.standings.find(s => s.season === data.meta.season) ?? data.standings[0];
          const curAwards = data.awards?.find(a => a.season === data.meta.season) ?? data.awards?.[0];
          return (
            <>
              <StandingsHero standings={curStandings} />
              <TournamentSection standings={curStandings} awards={curAwards} />
            </>
          );
        })()}
        <ThresholdCards thresholds={data.thresholds} />
        <RuleGuide thresholds={data.thresholds} />

        <nav className="tabs">
          {(['teams', 'players', 'awards', 'history', 'trades'] as Tab[]).map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'teams' ? 'チーム一覧'
                : t === 'players' ? '選手'
                : t === 'awards' ? '🏆 アワード'
                : t === 'history' ? '📊 履歴'
                : 'トレード・異動'}
            </button>
          ))}
        </nav>

        {showToolbar && (
          <section className="toolbar">
            <input
              type="search"
              placeholder="チーム・選手・背番号を検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="">全チーム</option>
              {data.teams.map(t => (
                <option key={t.abbreviation} value={t.abbreviation}>{t.abbreviation} · {t.name}</option>
              ))}
            </select>
            {tab === 'teams' && (
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">全ステータス</option>
                <option>第2エプロン超</option>
                <option>第1エプロン超</option>
                <option>ラグジュアリータックス超</option>
                <option>サラリーキャップ超</option>
                <option>キャップ内</option>
              </select>
            )}
            {tab === 'players' && (
              <select value={contractFilter} onChange={e => setContractFilter(e.target.value)}>
                <option value="">全契約タイプ</option>
                <option value="2-way">2-WAY</option>
                <option value="10-day">10日間</option>
                <option value="exhibit-10">Exhibit 10</option>
              </select>
            )}
            {tab === 'trades' && <span />}
            <button onClick={handleCSV}>CSVを書き出す</button>
          </section>
        )}

        {tab === 'teams' && (
          <section className="panel active">
            <CapChartSection teams={filteredTeams} data={data} max={max} />
            <AdBanner slot="1234567890" format="horizontal" style={{ minHeight: 90, marginBottom: 16 }} />
            <TeamGrid teams={filteredTeams} data={data} max={max} />
          </section>
        )}
        {tab === 'players' && (
          <section className="panel active">
            <PlayerTable players={filteredPlayers} awards={data.awards ?? []} />
          </section>
        )}
        {tab === 'trades' && (
          <section className="panel active">
            <TradeList transactions={filteredTrades} />
          </section>
        )}
        {tab === 'history' && (
          <section className="panel active">
            <HistoryPanel currentData={data} />
          </section>
        )}
        {tab === 'awards' && (
          <section className="panel active">
            {(data.awards?.length ?? 0) > 0
              ? <AwardsPanel data={data} />
              : <p style={{ color: '#8097aa', padding: '40px 0' }}>アワードデータがまだ取得されていません。「↻ データを更新」を実行してください。</p>
            }
          </section>
        )}

        <AdBanner slot="0987654321" format="auto" style={{ minHeight: 90, margin: '0 max(24px, calc((100vw - 1440px) / 2)) 12px' }} />

        <p className="footnote">
          {data.meta.notes.join(' ')}
          {data.meta.warning ? ' ' + data.meta.warning : ''}
        </p>
      </main>
    </>
  );
}

export { lineDifference };
