'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NBAData, Player, Team, Thresholds } from '@/lib/types';
import { yen, badgeClass, lineDifference, capScale } from '@/lib/utils';
import CapTrack from './CapTrack';

type SortKey = 'jersey' | 'name' | 'position' | 'salary' | 'yearsRemaining' | 'tradeRestricted';
type SortDir = 'asc' | 'desc';

function sortValue(p: Player, key: SortKey): string | number {
  if (key === 'jersey') return Number(String(p.jersey).replace(/\D/g, '')) || 0;
  if (key === 'name' || key === 'position') return String(p[key] ?? '');
  if (key === 'tradeRestricted') return p.tradeRestricted ? 1 : 0;
  return Number((p as unknown as Record<string, unknown>)[key] ?? -1);
}

const LINE_LABELS: [string, keyof Thresholds][] = [
  ['サラリーキャップ', 'salaryCap'],
  ['税ライン', 'luxuryTax'],
  ['第1エプロン', 'firstApron'],
  ['第2エプロン', 'secondApron'],
];

const COLUMNS: [SortKey, string][] = [
  ['jersey', '背番号'],
  ['name', '選手'],
  ['position', 'POS'],
  ['salary', 'サラリー'],
  ['yearsRemaining', '残年数'],
  ['tradeRestricted', 'トレード制限'],
];

interface Props {
  team: Team;
  players: Player[];
  data: NBAData;
}

export default function TeamDetail({ team: t, players, data }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'salary', dir: 'desc' });

  const max = capScale(data.teams, data.thresholds.secondApron);
  const total = t.totalCap ?? t.rosterSalary;

  const roster = [...players].sort((a, b) => {
    const isMissing = (p: Player) =>
      (sort.key === 'salary' || sort.key === 'yearsRemaining') &&
      (p as unknown as Record<string, unknown>)[sort.key] == null;
    if (isMissing(a) !== isMissing(b)) return isMissing(a) ? 1 : -1;
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    const result = typeof av === 'string'
      ? av.localeCompare(bv as string, 'en')
      : (av as number) - (bv as number);
    return sort.dir === 'asc' ? result : -result;
  });

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }

  const sortMark = (key: SortKey) =>
    sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕';

  return (
    <section className="team-page">
      <div className="detail-wrap">
        <Link className="back-link" href="/">← 全チーム一覧へ戻る</Link>

        <div className="detail-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.logo} alt={t.name} width={78} height={78} />
          <div>
            <p className="eyebrow dark">TEAM CAP DETAIL</p>
            <h2>{t.name}</h2>
            <span className={`badge ${badgeClass(t.apronStatus)}`}>{t.apronStatus}</span>
            {t.coach && <p className="coach-label">HC: {t.coach}</p>}
          </div>
        </div>

        <div className="detail-metrics">
          <div><small>総キャップ配賦額</small><strong>{yen(total)}</strong></div>
          <div><small>選手サラリー合計</small><strong>{yen(t.rosterSalary)}</strong></div>
          <div><small>アクティブキャップ</small><strong>{yen(t.activeCap)}</strong></div>
          <div><small>デッドキャップ</small><strong>{yen(t.deadCap)}</strong></div>
        </div>

        <section className="detail-cap">
          <h3>各ラインとの差</h3>
          <CapTrack total={total} color={t.color} thresholds={data.thresholds} max={max} />
          <div className="line-list">
            {LINE_LABELS.map(([label, key]) => (
              <div key={key}>
                <span>{label}<small>{yen(data.thresholds[key])}</small></span>
                <b>{lineDifference(total, data.thresholds[key])}</b>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="detail-roster-title">
            <h3>ロスター／選手サラリー</h3>
            <span>{roster.length}選手 · 見出しクリックで並べ替え</span>
          </div>
          <div className="table-wrap">
            <table className="sortable-table">
              <thead>
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <th key={key}>
                      <button onClick={() => toggleSort(key)}>
                        {label} {sortMark(key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map(p => (
                  <tr key={p.id}>
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
        </section>
      </div>
    </section>
  );
}
