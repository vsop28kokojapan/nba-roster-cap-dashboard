'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NBAData, Player, Team, Thresholds, DraftPickEntry, HistoricalSnapshot, FuturePickAsset } from '@/lib/types';
import { yen, badgeClass, lineDifference, capScale, getTeamPhase } from '@/lib/utils';
import PhaseBadge from './PhaseBadge';
import CapTrack from './CapTrack';
import TeamExceptions from './TeamExceptions';
import GlossaryModal from './GlossaryModal';

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

const BASE_COLUMNS: [SortKey, string][] = [
  ['jersey', '#'],
  ['name', '選手'],
  ['position', 'POS'],
];

function salaryTierClass(salary: number | null, cap: number | null): string {
  if (!salary || !cap) return 'tier-min';
  const pct = salary / cap;
  if (pct >= 0.30) return 'tier-max';
  if (pct >= 0.20) return 'tier-near';
  if (pct >= 0.10) return 'tier-mid';
  if (pct >= 0.035) return 'tier-low';
  return 'tier-min';
}

function tierLabel(cls: string): string {
  switch (cls) {
    case 'tier-max':  return 'マックス';
    case 'tier-near': return 'ニアマックス';
    case 'tier-mid':  return 'ミドルレベル';
    case 'tier-low':  return '小額';
    default:          return 'ミニマム';
  }
}

function yearLabel(year: number): string {
  return `'${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

// ── Historical salary mini chart ──────────────────────────────────────────

interface TeamHistoryPoint { season: string; totalCap: number | null; rosterSalary: number }

function HistoryMiniChart({ abbr }: { abbr: string }) {
  const [points, setPoints] = useState<TeamHistoryPoint[] | null>(null); // null = loading

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then((snaps: HistoricalSnapshot[]) => {
        const data = snaps
          .map(s => {
            const t = s.teams.find(tm => tm.abbreviation === abbr);
            return t ? { season: s.season, totalCap: t.totalCap, rosterSalary: t.rosterSalary } : null;
          })
          .filter((x): x is TeamHistoryPoint => x !== null)
          .sort((a, b) => a.season.localeCompare(b.season))
          .slice(-5);
        setPoints(data);
      })
      .catch(() => setPoints([]));
  }, [abbr]);

  if (points === null) return (
    <div className="history-mini-card">
      <p className="history-mini-title">過去サラリー推移</p>
      <p className="history-mini-empty">読み込み中…</p>
    </div>
  );

  if (points.length === 0) return (
    <div className="history-mini-card">
      <p className="history-mini-title">過去サラリー推移</p>
      <p className="history-mini-empty">履歴データ未取得<br /><span>履歴更新後に表示</span></p>
    </div>
  );

  const vals = points.map(p => p.totalCap ?? p.rosterSalary ?? 0).filter(v => v > 0);
  const maxVal = Math.max(...vals) * 1.05;
  const minVal = Math.min(...vals) * 0.92;
  const range = maxVal - minVal || 1;

  const W = 220, H = 72;
  const PAD = { left: 4, right: 4, top: 18, bottom: 22 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = points.length;
  const xs = points.map((_, i) => PAD.left + (i / Math.max(n - 1, 1)) * cW);
  const ys = points.map(p => {
    const v = (p.totalCap ?? p.rosterSalary ?? 0);
    return PAD.top + cH - ((v - minVal) / range) * cH;
  });
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  return (
    <div className="history-mini-card">
      <p className="history-mini-title">過去サラリー推移</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* Area fill */}
        <defs>
          <linearGradient id="hmg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a6fc2" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0a6fc2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${xs[0]},${PAD.top + cH} ${polyline} ${xs[n-1]},${PAD.top + cH}`}
          fill="url(#hmg)"
        />
        <polyline points={polyline} fill="none" stroke="#0a6fc2" strokeWidth={1.8} strokeLinejoin="round" />
        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={p.season}>
            <circle cx={xs[i]} cy={ys[i]} r={3} fill="#0a6fc2" />
            <text x={xs[i]} y={ys[i] - 5} textAnchor="middle" fontSize={8} fill="#0a6fc2" fontWeight={700}>
              ${((p.totalCap ?? p.rosterSalary ?? 0) / 1e6).toFixed(0)}M
            </text>
            <text x={xs[i]} y={H - 4} textAnchor="middle" fontSize={8} fill="#8aabcf">
              {p.season.replace(/20(\d{2})-(\d{2})/, "'$1-$2")}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Cap Projection Chart ───────────────────────────────────────────────────

function SalaryProjectionChart({
  players, thresholds, espnYear,
}: {
  players: Player[];
  thresholds: Thresholds;
  espnYear: number;
}) {
  const allYears = [...new Set(
    players.flatMap(p => (p.contractYears ?? []).map(c => c.year))
  )].filter(y => y >= espnYear).sort((a, b) => a - b);

  if (allYears.length === 0) return (
    <div className="proj-chart-wrap">
      <h3 className="proj-title">キャップ見込み推移</h3>
      <p className="proj-empty">「データを更新」後に複数年サラリーが表示されます</p>
    </div>
  );
  const years = allYears.slice(0, 5);

  const totals = years.map(yr =>
    players.reduce((sum, p) => {
      const entry = (p.contractYears ?? []).find(c => c.year === yr);
      return sum + (entry?.salary ?? 0);
    }, 0)
  );

  const W = 800, H = 200;
  const PAD = { top: 28, right: 20, bottom: 36, left: 72 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const yMax = Math.max(...totals, thresholds.secondApron ?? 0, thresholds.salaryCap ?? 0) * 1.12;
  const yScale = (v: number) => PAD.top + chartH - (v / yMax) * chartH;
  const xStep = chartW / years.length;
  const barW = xStep * 0.55;

  const barColor = (total: number): string => {
    if (total >= (thresholds.secondApron ?? Infinity)) return '#c8102e';
    if (total >= (thresholds.firstApron ?? Infinity)) return '#e87722';
    if (total >= (thresholds.luxuryTax ?? Infinity)) return '#f5c518';
    if (total >= (thresholds.salaryCap ?? Infinity)) return '#3a7a5e';
    return '#0a6fc2';
  };

  const thresholdLines: { label: string; value: number | null; color: string }[] = [
    { label: 'キャップ', value: thresholds.salaryCap, color: '#3a7a5e' },
    { label: '税', value: thresholds.luxuryTax, color: '#b5900a' },
    { label: '1st', value: thresholds.firstApron, color: '#e87722' },
    { label: '2nd', value: thresholds.secondApron, color: '#c8102e' },
  ];

  // Y-axis grid labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(f => yMax * f);

  return (
    <div className="proj-chart-wrap">
      <h3 className="proj-title">キャップ見込み推移</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* Y-axis grid */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="#e8edf2" strokeWidth={i === 0 ? 1.5 : 1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end"
                fontSize={9} fill="#9ab0c0">
                {v > 0 ? `$${(v / 1e6).toFixed(0)}M` : ''}
              </text>
            </g>
          );
        })}

        {/* Threshold lines */}
        {thresholdLines.map(({ label, value, color }) => {
          if (!value) return null;
          const y = yScale(value);
          if (y < PAD.top - 10 || y > PAD.top + chartH + 10) return null;
          return (
            <g key={label}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke={color} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.85} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end"
                fontSize={9} fill={color} fontWeight={700}>{label}</text>
            </g>
          );
        })}

        {/* Bars */}
        {years.map((yr, i) => {
          const total = totals[i];
          if (total === 0) return null;
          const barH = (total / yMax) * chartH;
          const cx = PAD.left + (i + 0.5) * xStep;
          const x = cx - barW / 2;
          const y = PAD.top + chartH - barH;
          const color = barColor(total);
          return (
            <g key={yr}>
              <rect x={x} y={y} width={barW} height={barH}
                fill={color} opacity={0.8} rx={3} />
              <text x={cx} y={y - 6} textAnchor="middle"
                fontSize={11} fill={color} fontWeight={800}>
                ${(total / 1e6).toFixed(0)}M
              </text>
              <text x={cx} y={H - 4} textAnchor="middle"
                fontSize={10} fill="#6a7f90">
                {yearLabel(yr)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="proj-legend">
        {thresholdLines.filter(l => l.value).map(({ label, color }) => (
          <span key={label} style={{ color }}>— {label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Draft picks ────────────────────────────────────────────────────────────

function DraftPicksSection({ picks, season }: { picks: DraftPickEntry[]; season: string }) {
  if (picks.length === 0) return null;
  const draftYear = Number(season.slice(0, 4)) + 1;
  const r1 = picks.filter(p => p.round === 1).sort((a, b) => a.overall - b.overall);
  const r2 = picks.filter(p => p.round === 2).sort((a, b) => a.overall - b.overall);
  return (
    <section className="draft-picks-section">
      <h3>{draftYear} ドラフト指名</h3>
      <div className="draft-picks-grid">
        {r1.map(p => (
          <div key={p.overall} className="draft-pick-card r1">
            <span className="dp-round">1巡目</span>
            <span className="dp-overall">#{p.overall}全体</span>
            <span className="dp-name">{p.playerName}</span>
            {p.traded && p.tradeNote && (
              <span className="dp-trade">via {p.tradeNote}</span>
            )}
          </div>
        ))}
        {r2.map(p => (
          <div key={p.overall} className="draft-pick-card r2">
            <span className="dp-round">2巡目</span>
            <span className="dp-overall">#{p.overall}全体</span>
            <span className="dp-name">{p.playerName}</span>
            {p.traded && p.tradeNote && (
              <span className="dp-trade">via {p.tradeNote}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Future draft picks ─────────────────────────────────────────────────────

function PickTradeModal({ pick, onClose }: { pick: FuturePickAsset; onClose: () => void }) {
  const t = pick.trade;
  const tradeDate = t?.date ?? t?.tradeRef?.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ?? null;
  const desc = t?.descriptionJa || t?.descriptionEn || null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="pick-modal" onClick={e => e.stopPropagation()}>
        <div className="pick-modal-header">
          <div>
            <span className="pick-modal-round">{pick.round === 1 ? '1巡目' : '2巡目'} 指名権</span>
            <span className="pick-modal-year">{pick.year}年ドラフト</span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="pick-modal-body">
          <div className="pick-modal-meta">
            <div className="pm-row">
              <span className="pm-label">元保有チーム</span>
              <span className="pm-value">{pick.from}</span>
            </div>
            {pick.protection && (
              <div className="pm-row">
                <span className="pm-label">保護条件</span>
                <span className="pm-value pm-protection">{pick.protection}</span>
              </div>
            )}
            {t?.tradeRef && (
              <div className="pm-row">
                <span className="pm-label">トレード履歴</span>
                <span className="pm-value pm-trade-ref">{t.tradeRef}</span>
              </div>
            )}
            {tradeDate && !t?.tradeRef && (
              <div className="pm-row">
                <span className="pm-label">トレード日</span>
                <span className="pm-value">{tradeDate}</span>
              </div>
            )}
          </div>
          {desc && (
            <p className="pm-description">{desc}</p>
          )}
          {t?.espnUrl && (
            <a className="pm-espn-link" href={t.espnUrl} target="_blank" rel="noopener noreferrer">
              ESPN記事を見る →
            </a>
          )}
          <p className="pm-source">出典: RealGM</p>
        </div>
      </div>
    </div>
  );
}

function FutureDraftPicksSection({ abbr, allPicks }: { abbr: string; allPicks: Record<string, FuturePickAsset[]> | null | undefined }) {
  const [selectedPick, setSelectedPick] = useState<FuturePickAsset | null>(null);

  const picks = allPicks?.[abbr] ?? [];
  if (picks.length === 0) return null;

  const years = [...new Set(picks.map(p => p.year))].sort();

  return (
    <section className="future-picks-section">
      <h3>将来の保有指名権</h3>
      <div className="fp-years">
        {years.map(year => {
          const yearPicks = picks.filter(p => p.year === year).sort((a, b) => a.round - b.round);
          return (
            <div key={year} className="fp-year-col">
              <div className="fp-year-label">{year}</div>
              {yearPicks.map((pick, i) => {
                const isOwn = !pick.from;
                const hasDetail = Boolean(pick.trade);
                return (
                  <div
                    key={i}
                    className={`fp-card${isOwn ? ' fp-own' : ' fp-acquired'}${hasDetail ? ' fp-clickable' : ''}`}
                    onClick={hasDetail ? () => setSelectedPick(pick) : undefined}
                    role={hasDetail ? 'button' : undefined}
                  >
                    <span className="fp-round-badge">{pick.round === 1 ? '1巡' : '2巡'}</span>
                    {isOwn
                      ? <span className="fp-own-label">自チーム</span>
                      : <span className="fp-from-label">← {pick.from}</span>
                    }
                    {pick.protection && (
                      <span className="fp-protection-badge">{pick.protection}</span>
                    )}
                    {hasDetail && <span className="fp-detail-hint">詳細 ▾</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {selectedPick && (
        <PickTradeModal pick={selectedPick} onClose={() => setSelectedPick(null)} />
      )}
    </section>
  );
}

// ── Stats fetch ────────────────────────────────────────────────────────────

interface PlayerStats { pts: number | null; reb: number | null; ast: number | null; stl: number | null; blk: number | null }

async function fetchStatsBatch(
  ids: string[], espnYear: number
): Promise<Map<string, PlayerStats>> {
  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
  const results = new Map<string, PlayerStats>();
  const CONCURRENCY = 8;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async id => {
      try {
        const r = await fetch(`${ESPN_CORE}/seasons/${espnYear}/types/2/athletes/${id}/statistics/0`);
        if (!r.ok) return;
        const d = await r.json();
        const cats = (d.splits?.categories ?? []) as Array<{ stats: Array<{ name: string; value: number }> }>;
        const stats: Record<string, number> = {};
        for (const cat of cats) for (const s of cat.stats ?? []) stats[s.name] = s.value;
        results.set(id, {
          pts: stats.avgPoints ?? null,
          reb: stats.avgRebounds ?? null,
          ast: stats.avgAssists ?? null,
          stl: stats.avgSteals ?? null,
          blk: stats.avgBlocks ?? null,
        });
      } catch { /* ignore */ }
    }));
  }
  return results;
}

// ── Award badges ───────────────────────────────────────────────────────────

function buildBadges(awards: NBAData['awards']): Map<string, { icon: string; label: string; season: string }[]> {
  const map = new Map<string, { icon: string; label: string; season: string }[]>();
  const add = (id: string | undefined, icon: string, label: string, season: string) => {
    if (!id) return;
    const arr = map.get(id) ?? [];
    if (!arr.some(b => b.label === label && b.season === season)) arr.push({ icon, label, season });
    map.set(id, arr);
  };
  for (const s of awards ?? []) {
    add(s.mvp?.athleteId, '👑', 'MVP', s.season);
    add(s.dpoy?.athleteId, '🛡', 'DPOY', s.season);
    add(s.roy?.athleteId, '⭐', 'ROY', s.season);
    add(s.finalsMvp?.athleteId, '🏆', 'Finals', s.season);
    for (const e of s.allNba1) add(e.athleteId, '★', 'All-NBA 1st', s.season);
    for (const e of s.allNba2) add(e.athleteId, '☆', 'All-NBA 2nd', s.season);
    for (const e of s.allRookie1) add(e.athleteId, '⭐', 'All-Rookie', s.season);
  }
  return map;
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  team: Team;
  players: Player[];
  data: NBAData;
}

export default function TeamDetail({ team: t, players, data }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'salary', dir: 'desc' });
  const [multiYear, setMultiYear] = useState(false);

  const max = capScale(data.teams, data.thresholds.secondApron);
  const total = t.totalCap ?? t.rosterSalary;
  const awardBadges = buildBadges(data.awards);
  const cap = data.thresholds.salaryCap;

  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const espnYear = Number(data.meta.season?.slice(0, 4) ?? 2025) + 1;

  useEffect(() => {
    const ids = players.map(p => p.id).filter(Boolean);
    if (ids.length === 0) return;
    fetchStatsBatch(ids, espnYear).then(setPlayerStats);
  }, [players, espnYear]);

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

  // Determine contract years present across all players (for column headers)
  const contractYearCols = [...new Set(
    players.flatMap(p => (p.contractYears ?? []).map(c => c.year))
  )].filter(y => y >= espnYear).sort((a, b) => a - b).slice(0, 5);

  return (
    <section className="team-page">
      <div className="detail-wrap" style={{ borderTopColor: t.color }}>
        <Link className="back-link" href="/">← 全チーム一覧へ戻る</Link>

        <div className="detail-head">
          <div className="detail-head-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.logo} alt={t.name} width={78} height={78} />
            <div>
              <p className="eyebrow dark">TEAM CAP DETAIL</p>
              <h2>{t.name}</h2>
              <div className="detail-badges">
                <span className={`badge ${badgeClass(t.apronStatus)}`}>{t.apronStatus}</span>
                {(() => { const ph = getTeamPhase(t.abbreviation, data); return ph ? <PhaseBadge phase={ph} /> : null; })()}
              </div>
              {t.coach && <p className="coach-label">HC: {t.coach}</p>}
            </div>
          </div>
          <div className="detail-head-right">
            <GlossaryModal />
            <HistoryMiniChart abbr={t.abbreviation} />
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

        <TeamExceptions team={t} thresholds={data.thresholds} />

        {/* Cap Projection Chart */}
        {contractYearCols.length > 0 && (
          <SalaryProjectionChart
            players={players}
            thresholds={data.thresholds}
            espnYear={espnYear}
          />
        )}

        <FutureDraftPicksSection abbr={t.abbreviation} allPicks={data.futurePicks} />
        <DraftPicksSection picks={data.draftPicks?.[t.abbreviation] ?? []} season={data.meta.season} />

        {/* Salary tier legend */}
        <div className="tier-legend">
          <span className="tier-dot tier-max" />マックス (≥30% cap)
          <span className="tier-dot tier-near" />ニアマックス (20-30%)
          <span className="tier-dot tier-mid" />ミドル (10-20%)
          <span className="tier-dot tier-low" />小額 (3.5-10%)
          <span className="tier-dot tier-min" />ミニマム
        </div>

        <section>
          <div className="detail-roster-title">
            <h3>ロスター／選手サラリー</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>{roster.length}選手 · 見出しクリックで並べ替え</span>
              <button
                className={`year-toggle-btn${multiYear ? ' active' : ''}`}
                onClick={() => setMultiYear(v => !v)}
              >
                {multiYear ? '📅 複数年表示' : '📅 複数年表示'}
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="sortable-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '5%' }} />
                {multiYear ? (
                  contractYearCols.map(yr => (
                    <col key={yr} style={{ width: `${32 / contractYearCols.length}%` }} />
                  ))
                ) : (
                  <>
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '11%' }} />
                  </>
                )}
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>
              <thead>
                <tr>
                  {BASE_COLUMNS.map(([key, label]) => (
                    <th key={key}>
                      <button onClick={() => toggleSort(key as SortKey)}>
                        {label} {sortMark(key as SortKey)}
                      </button>
                    </th>
                  ))}
                  {multiYear ? (
                    // Multi-year: show each contract year as a column
                    contractYearCols.map(yr => (
                      <th key={yr} className="stats-col yr-col">
                        {yearLabel(yr)}
                      </th>
                    ))
                  ) : (
                    <>
                      <th>
                        <button onClick={() => toggleSort('salary')}>サラリー {sortMark('salary')}</button>
                      </th>
                      <th>
                        <button onClick={() => toggleSort('yearsRemaining')}>残年数 {sortMark('yearsRemaining')}</button>
                      </th>
                      <th>
                        <button className="col-tip" data-tip="トレード成立後、一定期間は別チームへ再トレードできない制限（CBA上のルール）" onClick={() => toggleSort('tradeRestricted')}>TR制限 {sortMark('tradeRestricted')}</button>
                      </th>
                    </>
                  )}
                  <th className="stats-col"><span className="col-tip" data-tip="平均得点（1試合あたり）">PTS</span></th>
                  <th className="stats-col"><span className="col-tip" data-tip="平均リバウンド数（1試合あたり）">REB</span></th>
                  <th className="stats-col"><span className="col-tip" data-tip="平均アシスト数（1試合あたり）">AST</span></th>
                  <th className="stats-col"><span className="col-tip" data-tip="平均スティール数（1試合あたり）">STL</span></th>
                  <th className="stats-col"><span className="col-tip" data-tip="平均ブロック数（1試合あたり）">BLK</span></th>
                </tr>
              </thead>
              <tbody>
                {roster.map(p => {
                  const tier = salaryTierClass(p.salary, cap);
                  return (
                    <tr key={p.id} className={tier}>
                      <td><b>{p.jersey}</b></td>
                      <td>
                        <div className="player">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.headshot && <img src={p.headshot} alt={p.name} width={32} height={32} />}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              {p.profile
                                ? <a href={p.profile} target="_blank" rel="noopener noreferrer">{p.name}</a>
                                : p.name}
                              {(awardBadges.get(p.id) ?? []).map(b => (
                                <span key={b.label + b.season} className="player-badge">
                                  <span className="pb-icon">{b.icon}</span>
                                  <span className="pb-label">{b.label}</span>
                                  <span className="pb-season">{b.season.slice(2)}</span>
                                </span>
                              ))}
                            </div>
                            <span className="tier-label-inline">{tierLabel(tier)}</span>
                          </div>
                        </div>
                      </td>
                      <td>{p.position}</td>
                      {multiYear ? (
                        contractYearCols.map(yr => {
                          const entry = (p.contractYears ?? []).find(c => c.year === yr);
                          const isCurrentYr = yr === espnYear;
                          return (
                            <td key={yr} className={`yr-col${isCurrentYr ? ' yr-current' : ' yr-future'}`}>
                              {entry?.salary ? (
                                <b style={isCurrentYr ? {} : { color: '#6a7f90' }}>
                                  {yen(entry.salary)}
                                </b>
                              ) : (
                                <span className="yr-fa">FA</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <>
                          <td>
                            <span className={`sal-cell ${tier}`}>
                              <b>{yen(p.salary)}</b>
                            </span>
                          </td>
                          <td>{p.yearsRemaining != null ? p.yearsRemaining : '—'}</td>
                          <td>{p.tradeRestricted ? 'あり' : '—'}</td>
                        </>
                      )}
                      {(['pts','reb','ast','stl','blk'] as const).map(k => {
                        const s = playerStats.get(p.id);
                        const v = s?.[k];
                        return <td key={k} className="stats-col">{v != null ? v.toFixed(1) : '—'}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
