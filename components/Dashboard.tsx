'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { NBAData, Player, Team, Transaction } from '@/lib/types';
import { yen, million, fmtDate, badgeClass, distanceText, lineDifference, capScale } from '@/lib/utils';
import CapTrack from './CapTrack';

type Tab = 'teams' | 'players' | 'trades';

function Badge({ status }: { status: string }) {
  return <span className={`badge ${badgeClass(status)}`}>{status}</span>;
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
            <div className="money">{yen(total)}</div>
            <div className="sub">
              総キャップ配賦額{t.deadCap != null ? ` · デッド ${yen(t.deadCap)}` : ''}
            </div>
            <Badge status={t.apronStatus} />
            <p className="distance">{distanceText(total, data.thresholds)}</p>
            <CapTrack total={total} color={t.color} thresholds={data.thresholds} max={max} />
            <span className="open-detail">詳細を見る ↗</span>
          </Link>
        );
      })}
    </div>
  );
}

function PlayerTable({ players }: { players: Player[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>チーム</th><th>背番号</th><th>選手</th><th>POS</th>
            <th>サラリー</th><th>残年数</th><th>トレード制限</th>
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
                </div>
              </td>
              <td>{p.position}</td>
              <td><b>{yen(p.salary)}</b></td>
              <td>{p.yearsRemaining ?? '—'}</td>
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

export default function Dashboard({ data }: { data: NBAData }) {
  const [tab, setTab] = useState<Tab>('teams');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const max = useMemo(() => capScale(data.teams, data.thresholds.secondApron), [data]);
  const q = search.trim().toLowerCase();

  const filteredTeams = useMemo(() => data.teams.filter(t =>
    (!teamFilter || t.abbreviation === teamFilter) &&
    (!statusFilter || t.apronStatus === statusFilter) &&
    (!q || `${t.name} ${t.abbreviation}`.toLowerCase().includes(q))
  ), [data.teams, teamFilter, statusFilter, q]);

  const filteredPlayers = useMemo(() => data.players.filter(p =>
    (!teamFilter || p.team === teamFilter) &&
    (!q || `${p.name} ${p.team} ${p.jersey}`.toLowerCase().includes(q))
  ), [data.players, teamFilter, q]);

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
        Salary: p.salary, YearsRemaining: p.yearsRemaining, TradeRestricted: p.tradeRestricted,
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

  return (
    <>
      <nav className="tabs">
        {(['teams', 'players', 'trades'] as Tab[]).map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'teams' ? 'チーム' : t === 'players' ? '選手' : 'トレード・異動'}
          </button>
        ))}
      </nav>

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
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ display: tab === 'teams' ? '' : 'none' }}
        >
          <option value="">全ステータス</option>
          <option>第2エプロン超</option>
          <option>第1エプロン超</option>
          <option>ラグジュアリータックス超</option>
          <option>サラリーキャップ超</option>
          <option>キャップ内</option>
        </select>
        <button onClick={handleCSV}>CSVを書き出す</button>
      </section>

      {tab === 'teams' && (
        <section className="panel active">
          <CapChartSection teams={filteredTeams} data={data} max={max} />
          <TeamGrid teams={filteredTeams} data={data} max={max} />
        </section>
      )}
      {tab === 'players' && (
        <section className="panel active">
          <PlayerTable players={filteredPlayers} />
        </section>
      )}
      {tab === 'trades' && (
        <section className="panel active">
          <TradeList transactions={filteredTrades} />
        </section>
      )}
    </>
  );
}

export { lineDifference };
