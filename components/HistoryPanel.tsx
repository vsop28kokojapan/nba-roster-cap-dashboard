'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NBAData, HistoricalSnapshot } from '@/lib/types';
import { yen, million, badgeClass } from '@/lib/utils';
import ContractBadge from './ContractBadge';
import SalaryTrend from './SalaryTrend';

interface Props {
  currentData: NBAData;
}

export default function HistoryPanel({ currentData }: Props) {
  const [availSeasons, setAvailSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loadedData, setLoadedData] = useState<Map<string, HistoricalSnapshot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available seasons on mount
  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => {
        const seasons: string[] = d.seasons ?? [];
        setAvailSeasons(seasons);
        if (seasons.length > 0) setSelectedSeason(seasons[0]);
      })
      .catch(() => setError('履歴シーズン一覧の取得に失敗しました'));
  }, []);

  // Load snapshot when season changes
  useEffect(() => {
    if (!selectedSeason || loadedData.has(selectedSeason)) return;
    setLoading(true);
    setError(null);
    fetch(`/api/history?season=${selectedSeason}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((snapshot: HistoricalSnapshot) => {
        setLoadedData(prev => new Map(prev).set(selectedSeason, snapshot));
      })
      .catch(e => setError(`${selectedSeason} のデータ取得失敗: ${e.message}`))
      .finally(() => setLoading(false));
  }, [selectedSeason, loadedData]);

  const snapshot = loadedData.get(selectedSeason);

  // Build trend data for selected team across all loaded snapshots
  const trendPoints = useCallback(() => {
    if (!selectedTeam) return [];
    const points: { season: string; totalCap: number | null; rosterSalary: number }[] = [];
    // Historical snapshots
    for (const [season, snap] of loadedData) {
      const team = snap.teams.find(t => t.abbreviation === selectedTeam);
      if (team) points.push({ season, totalCap: team.totalCap, rosterSalary: team.rosterSalary });
    }
    // Current season
    const cur = currentData.teams.find(t => t.abbreviation === selectedTeam);
    if (cur) {
      points.push({
        season: currentData.meta.season,
        totalCap: cur.totalCap,
        rosterSalary: cur.rosterSalary,
      });
    }
    return points.sort((a, b) => a.season.localeCompare(b.season));
  }, [selectedTeam, loadedData, currentData]);

  const teamColor = selectedTeam
    ? (currentData.teams.find(t => t.abbreviation === selectedTeam)?.color ?? '#1d428a')
    : '#1d428a';

  const histPlayers = snapshot && selectedTeam
    ? snapshot.players.filter(p => p.team === selectedTeam).sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
    : [];

  const histTeams = snapshot
    ? [...snapshot.teams].sort((a, b) => (b.totalCap ?? b.rosterSalary) - (a.totalCap ?? a.rosterSalary))
    : [];

  if (availSeasons.length === 0 && !loading && !error) {
    return (
      <div className="history-empty">
        <p className="eyebrow dark">過去シーズンデータなし</p>
        <h3>履歴データがまだ登録されていません</h3>
        <p>以下のコマンドで各シーズンのデータを取得・保存できます（CRON_SECRET が必要）：</p>
        <pre>{`curl "https://<your-vercel-url>/api/history-update?season=2024-25" \\
  -H "Authorization: Bearer <CRON_SECRET>"`}</pre>
        <p>対応シーズン：<code>2015-16</code> ～ <code>2024-25</code></p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      {/* Controls */}
      <div className="history-controls">
        <div>
          <label htmlFor="hist-season">シーズン</label>
          <select
            id="hist-season"
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
          >
            {availSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="hist-team">チーム</label>
          <select
            id="hist-team"
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
          >
            <option value="">全チーム</option>
            {currentData.teams.map(t => (
              <option key={t.abbreviation} value={t.abbreviation}>
                {t.abbreviation} · {t.name}
              </option>
            ))}
          </select>
        </div>
        {loading && <span className="hist-loading">読み込み中…</span>}
        {error && <span className="hist-error">{error}</span>}
      </div>

      {/* Salary trend chart (shown when a team is selected) */}
      {selectedTeam && (
        <div className="history-chart-wrap">
          <p className="eyebrow dark">サラリートレンド · {selectedTeam}</p>
          <p className="hist-chart-note">
            選択したシーズンのデータを読み込むとグラフに追加されます
            {currentData.meta.season && ` （${currentData.meta.season} は現行シーズン）`}
          </p>
          <SalaryTrend
            points={trendPoints()}
            color={teamColor}
            thresholds={{
              salaryCap: currentData.thresholds.salaryCap,
              luxuryTax: currentData.thresholds.luxuryTax,
              firstApron: currentData.thresholds.firstApron,
              secondApron: currentData.thresholds.secondApron,
            }}
          />
        </div>
      )}

      {/* Team roster for selected season + team */}
      {snapshot && selectedTeam && (
        <div className="hist-roster-wrap">
          <p className="eyebrow dark">ロスター · {selectedSeason} · {selectedTeam}</p>
          {histPlayers.length === 0 ? (
            <p>データなし</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>選手</th><th>POS</th><th>サラリー</th><th>残年数</th><th>契約タイプ</th>
                  </tr>
                </thead>
                <tbody>
                  {histPlayers.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.position}</td>
                      <td><b>{yen(p.salary)}</b></td>
                      <td>{p.yearsRemaining ?? '—'}</td>
                      <td><ContractBadge type={p.contractType} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All teams table for selected season */}
      {snapshot && !selectedTeam && (
        <div className="hist-all-teams">
          <p className="eyebrow dark">{selectedSeason} · 全チームキャップ状況</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>チーム</th><th>選手数</th><th>総額</th><th>ロスター合計</th>
                  <th>デッドキャップ</th><th>ステータス</th><th>データソース</th>
                </tr>
              </thead>
              <tbody>
                {histTeams.map(t => (
                  <tr key={t.abbreviation}>
                    <td>
                      <div className="hist-team-cell">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.logo && <img src={t.logo} alt={t.abbreviation} width={22} height={22} />}
                        <span><b>{t.abbreviation}</b> {t.name}</span>
                      </div>
                    </td>
                    <td>{t.playerCount}</td>
                    <td><b>{million(t.totalCap ?? t.rosterSalary)}</b></td>
                    <td>{million(t.rosterSalary)}</td>
                    <td>{t.deadCap != null ? million(t.deadCap) : '—'}</td>
                    <td>
                      <span className={`badge ${badgeClass(t.apronStatus)}`} style={{ marginTop: 0 }}>
                        {t.apronStatus}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#6e7f90' }}>{t.capSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
