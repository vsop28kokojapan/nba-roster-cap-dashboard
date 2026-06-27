'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NBAData, HistoricalSnapshot, HistoricalTeam } from '@/lib/types';
import { yen, million, badgeClass } from '@/lib/utils';
import ContractBadge from './ContractBadge';
import SalaryTrend from './SalaryTrend';

interface Props {
  currentData: NBAData;
}

function TeamModal({
  team,
  season,
  players,
  onClose,
}: {
  team: HistoricalTeam;
  season: string;
  players: { id: string; name: string; position: string; salary: number | null; yearsRemaining: number | null; contractType: import('@/lib/types').ContractType }[];
  onClose: () => void;
}) {
  return (
    <div className="hist-modal-overlay" onClick={onClose}>
      <div className="hist-modal" onClick={e => e.stopPropagation()}>
        <button className="hist-modal-close" onClick={onClose}>✕</button>
        <div className="hist-modal-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {team.logo && <img src={team.logo} alt={team.name} width={52} height={52} />}
          <div>
            <p className="eyebrow dark">{season}</p>
            <h3>{team.name}</h3>
            {team.coach && <p className="coach-label">HC: {team.coach}</p>}
            <span className={`badge ${badgeClass(team.apronStatus)}`} style={{ marginTop: 4 }}>
              {team.apronStatus}
            </span>
          </div>
        </div>

        <div className="hist-modal-metrics">
          <div><small>総キャップ</small><strong>{million(team.totalCap ?? team.rosterSalary)}</strong></div>
          <div><small>ロスター合計</small><strong>{million(team.rosterSalary)}</strong></div>
          <div><small>デッドキャップ</small><strong>{team.deadCap != null ? million(team.deadCap) : '—'}</strong></div>
          <div><small>データソース</small><strong style={{ fontSize: 12 }}>{team.capSource}</strong></div>
        </div>

        {players.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>選手</th><th>POS</th><th>サラリー</th><th>残年数</th><th>契約</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
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
        ) : (
          <p className="hist-no-roster">選手データなし（過去シーズンはチームキャップ情報のみ）</p>
        )}
      </div>
    </div>
  );
}

export default function HistoryPanel({ currentData }: Props) {
  const [availSeasons, setAvailSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loadedData, setLoadedData] = useState<Map<string, HistoricalSnapshot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalTeam, setModalTeam] = useState<HistoricalTeam | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalCap', dir: 'desc' });

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

  const trendPoints = useCallback(() => {
    if (!selectedTeam) return [];
    const points: { season: string; totalCap: number | null; rosterSalary: number }[] = [];
    for (const [season, snap] of loadedData) {
      const team = snap.teams.find(t => t.abbreviation === selectedTeam);
      if (team) points.push({ season, totalCap: team.totalCap, rosterSalary: team.rosterSalary });
    }
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

  const histTeams = snapshot ? [...snapshot.teams].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0;
    if (sort.key === 'name') { av = a.name; bv = b.name; }
    else if (sort.key === 'totalCap') { av = a.totalCap ?? a.rosterSalary; bv = b.totalCap ?? b.rosterSalary; }
    else if (sort.key === 'rosterSalary') { av = a.rosterSalary; bv = b.rosterSalary; }
    else if (sort.key === 'deadCap') { av = a.deadCap ?? 0; bv = b.deadCap ?? 0; }
    else if (sort.key === 'playerCount') { av = a.playerCount; bv = b.playerCount; }
    const result = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sort.dir === 'asc' ? result : -result;
  }) : [];

  const toggleSort = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
  );
  const sortMark = (key: string) => sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕';

  const modalPlayers = modalTeam && snapshot
    ? snapshot.players
        .filter(p => p.team === modalTeam.abbreviation)
        .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
    : [];

  if (availSeasons.length === 0 && !loading && !error) {
    return (
      <div className="history-empty">
        <p className="eyebrow dark">過去シーズンデータなし</p>
        <h3>履歴データがまだ登録されていません</h3>
        <p>以下のURLをブラウザで開いて各シーズンのデータを取得してください：</p>
        <pre>{`https://<your-vercel-url>/api/history-update?season=2024-25`}</pre>
        <p>対応シーズン：<code>2015-16</code> ～ <code>2024-25</code></p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      {modalTeam && snapshot && (
        <TeamModal
          team={modalTeam}
          season={selectedSeason}
          players={modalPlayers}
          onClose={() => setModalTeam(null)}
        />
      )}

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

      {snapshot && !selectedTeam && (
        <div className="hist-all-teams">
          <p className="eyebrow dark">{selectedSeason} · 全チームキャップ状況 <span className="hist-click-hint">（行をクリックで詳細）</span></p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('name')} style={{cursor:'pointer'}}>チーム{sortMark('name')}</th>
                  <th>監督</th>
                  <th onClick={() => toggleSort('playerCount')} style={{cursor:'pointer'}}>選手数{sortMark('playerCount')}</th>
                  <th onClick={() => toggleSort('totalCap')} style={{cursor:'pointer'}}>総額{sortMark('totalCap')}</th>
                  <th onClick={() => toggleSort('rosterSalary')} style={{cursor:'pointer'}}>ロスター合計{sortMark('rosterSalary')}</th>
                  <th onClick={() => toggleSort('deadCap')} style={{cursor:'pointer'}}>デッドキャップ{sortMark('deadCap')}</th>
                  <th>ステータス</th><th>データソース</th>
                </tr>
              </thead>
              <tbody>
                {histTeams.map(t => (
                  <tr
                    key={t.abbreviation}
                    className="hist-team-row"
                    onClick={() => setModalTeam(t)}
                  >
                    <td>
                      <div className="hist-team-cell">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.logo && <img src={t.logo} alt={t.abbreviation} width={22} height={22} />}
                        <span><b>{t.abbreviation}</b> {t.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#4a5f70' }}>{t.coach ?? '—'}</td>
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
