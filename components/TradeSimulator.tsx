'use client';

import { useMemo, useState } from 'react';
import type { NBAData } from '@/lib/types';
import { million, badgeClass } from '@/lib/utils';
import { evaluateTeamTrade, TIER_LABEL, type TradeAsset } from '@/lib/tradeRules';

export default function TradeSimulator({ data }: { data: NBAData }) {
  const [participants, setParticipants] = useState<string[]>([]);
  const [assets, setAssets] = useState<TradeAsset[]>([]);

  const teamMap = useMemo(() => new Map(data.teams.map(t => [t.abbreviation, t])), [data.teams]);

  function toggleTeam(abbr: string) {
    if (participants.includes(abbr)) {
      setParticipants(p => p.filter(x => x !== abbr));
      setAssets(a => a.filter(x => x.fromTeam !== abbr && x.toTeam !== abbr));
    } else {
      setParticipants(p => [...p, abbr]);
    }
  }

  function toggleAsset(asset: Omit<TradeAsset, 'toTeam'>) {
    setAssets(prev => {
      const exists = prev.find(a => a.id === asset.id);
      if (exists) return prev.filter(a => a.id !== asset.id);
      const otherTeams = participants.filter(p => p !== asset.fromTeam);
      const toTeam = otherTeams.length === 1 ? otherTeams[0] : null;
      return [...prev, { ...asset, toTeam }];
    });
  }

  function setDestination(id: string, toTeam: string) {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, toTeam: toTeam || null } : a));
  }

  function reset() {
    setParticipants([]);
    setAssets([]);
  }

  const results = useMemo(() => {
    if (participants.length < 2) return [];
    return participants.map(abbr => {
      const team = teamMap.get(abbr);
      if (!team) return null;
      return evaluateTeamTrade(team, data.thresholds, assets);
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [participants, assets, teamMap, data.thresholds]);

  const unassignedCount = assets.filter(a => !a.toTeam).length;
  const allOk = results.length > 0 && unassignedCount === 0 && results.every(r => r.ok);

  return (
    <section className="trade-sim">
      <h3>🔀 トレードシミュレーター</h3>
      <p className="ts-sub">2チーム以上を選んで選手・指名権を選択すると、CBAのサラリーマッチングルール（簡略版）に基づいて成立可否を判定します。</p>

      <div className="ts-team-picker">
        {data.teams.map(t => (
          <button
            key={t.abbreviation}
            type="button"
            className={`ts-team-chip${participants.includes(t.abbreviation) ? ' active' : ''}`}
            onClick={() => toggleTeam(t.abbreviation)}
          >
            {t.abbreviation}
          </button>
        ))}
      </div>

      {participants.length > 0 && (
        <>
          <div className="ts-rosters">
            {participants.map(abbr => {
              const team = teamMap.get(abbr);
              const roster = data.players.filter(p => p.team === abbr).sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
              const picks = data.futurePicks?.[abbr] ?? [];
              return (
                <div key={abbr} className="ts-roster-col">
                  <h4>{team?.name ?? abbr}</h4>
                  <div className="ts-asset-group">
                    {roster.map(p => {
                      const id = `player-${p.id}`;
                      const checked = assets.some(a => a.id === id);
                      return (
                        <label key={id} className={`ts-asset-row${checked ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAsset({
                              id, kind: 'player', fromTeam: abbr,
                              label: p.name,
                              detail: p.position,
                              salary: p.salary ?? 0,
                            })}
                          />
                          <span className="ts-asset-label">{p.name}</span>
                          <span className="ts-asset-salary">{million(p.salary)}</span>
                        </label>
                      );
                    })}
                    {picks.map((pk, i) => {
                      const id = `pick-${abbr}-${pk.year}-${pk.round}-${i}`;
                      const checked = assets.some(a => a.id === id);
                      const label = `${pk.year} ${pk.round === 1 ? '1巡目' : '2巡目'}${pk.from ? `（元: ${pk.from}）` : ''}`;
                      return (
                        <label key={id} className={`ts-asset-row ts-pick-row${checked ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAsset({
                              id, kind: 'pick', fromTeam: abbr,
                              label,
                              detail: pk.protection ?? '',
                              salary: 0,
                            })}
                          />
                          <span className="ts-asset-label">{label}{pk.protection ? `（${pk.protection}）` : ''}</span>
                          <span className="ts-asset-salary">—</span>
                        </label>
                      );
                    })}
                    {roster.length === 0 && picks.length === 0 && (
                      <p className="ts-empty">選手・指名権データがありません。</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {assets.length > 0 && (
            <div className="ts-board">
              <h4>トレード内容</h4>
              <table className="ts-board-table">
                <thead>
                  <tr><th>差出</th><th>アセット</th><th>金額</th><th>送り先</th></tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id}>
                      <td>{a.fromTeam}</td>
                      <td>{a.label}</td>
                      <td>{a.salary > 0 ? million(a.salary) : '—'}</td>
                      <td>
                        <select value={a.toTeam ?? ''} onChange={e => setDestination(a.id, e.target.value)}>
                          <option value="">未割当</option>
                          {participants.filter(p => p !== a.fromTeam).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unassignedCount > 0 && (
                <p className="ts-warning">⚠ {unassignedCount}件のアセットに送り先が未割当です。</p>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="ts-results">
              <div className="ts-results-head">
                <h4>判定結果</h4>
                <span className={`ts-overall ${allOk ? 'ts-overall-ok' : 'ts-overall-ng'}`}>
                  {allOk ? '✓ トレード成立可能' : '✕ 成立不可'}
                </span>
              </div>
              <div className="ts-result-grid">
                {results.map(r => (
                  <div key={r.abbr} className={`ts-result-card${r.ok ? ' ts-ok' : ' ts-ng'}`}>
                    <div className="ts-result-head">
                      <strong>{teamMap.get(r.abbr)?.name ?? r.abbr}</strong>
                      <span className={`badge ${badgeClass(TIER_LABEL[r.preTier])}`}>{TIER_LABEL[r.preTier]}</span>
                    </div>
                    <dl className="ts-result-stats">
                      <div><dt>送出給与</dt><dd>{million(r.outgoingSalary)}</dd></div>
                      <div><dt>受取給与</dt><dd>{million(r.incomingSalary)}</dd></div>
                      <div><dt>受取上限</dt><dd>{million(r.matchCap)}</dd></div>
                    </dl>
                    <div className="ts-result-post">
                      <span>トレード後</span>
                      <strong>{million(r.postTotal)}</strong>
                      <span className={`badge ${badgeClass(TIER_LABEL[r.postTier])}`}>{TIER_LABEL[r.postTier]}</span>
                    </div>
                    {r.reasons.length > 0 && (
                      <ul className="ts-reasons">
                        {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="ts-reset" onClick={reset}>リセット</button>
        </>
      )}

      <p className="ts-disclaimer">
        ※ サラリーマッチングは簡略化した概算ルールです。トレードキッカー・ベースイヤー報酬・1年以上前のTPEなど一部の例外は考慮していません。実際のトレードはチーム公式・リーグの審査が必要です。
      </p>
    </section>
  );
}
