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
      <div className="ts-hero">
        <h3>🔀 トレードマシーン</h3>
        <p className="ts-sub">2チーム以上を選んで選手・指名権を選び合うと、CBAのサラリーマッチングルール（簡略版）で成立可否を即判定します。</p>
      </div>

      <div className="ts-team-picker">
        {data.teams.map(t => {
          const active = participants.includes(t.abbreviation);
          return (
            <button
              key={t.abbreviation}
              type="button"
              className={`ts-team-chip${active ? ' active' : ''}`}
              style={active ? { borderColor: t.color, background: t.color, color: '#fff' } : undefined}
              onClick={() => toggleTeam(t.abbreviation)}
            >
              <img src={t.logo} alt="" width={18} height={18} />
              {t.abbreviation}
            </button>
          );
        })}
      </div>

      {participants.length > 0 && (
        <>
          <div className="ts-rosters">
            {participants.map(abbr => {
              const team = teamMap.get(abbr);
              const roster = data.players.filter(p => p.team === abbr).sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
              const picks = data.futurePicks?.[abbr] ?? [];
              return (
                <div key={abbr} className="ts-roster-col" style={{ borderTopColor: team?.color ?? '#0A1931' }}>
                  <div className="ts-roster-head">
                    {team?.logo && <img src={team.logo} alt="" width={28} height={28} />}
                    <h4>{team?.name ?? abbr}</h4>
                  </div>
                  <div className="ts-asset-group">
                    {roster.map(p => {
                      const id = `player-${p.id}`;
                      const checked = assets.some(a => a.id === id);
                      return (
                        <label
                          key={id}
                          className={`ts-asset-row${checked ? ' checked' : ''}`}
                          style={checked ? { borderColor: team?.color, background: `${team?.color}14` } : undefined}
                        >
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
                          {p.headshot
                            ? <img className="ts-asset-photo" src={p.headshot} alt="" width={32} height={32} />
                            : <span className="ts-asset-photo ts-asset-photo-fallback">{p.name.slice(0, 1)}</span>
                          }
                          <span className="ts-asset-info">
                            <span className="ts-asset-name">{p.name}</span>
                            <span className="ts-asset-pos">{p.position}</span>
                          </span>
                          <span className="ts-asset-salary">{million(p.salary)}</span>
                          {checked && <span className="ts-asset-check" style={{ background: team?.color }}>✓</span>}
                        </label>
                      );
                    })}
                    {picks.map((pk, i) => {
                      const id = `pick-${abbr}-${pk.year}-${pk.round}-${i}`;
                      const checked = assets.some(a => a.id === id);
                      const label = `${pk.year} ${pk.round === 1 ? '1巡目' : '2巡目'}${pk.from ? `（元: ${pk.from}）` : ''}`;
                      return (
                        <label
                          key={id}
                          className={`ts-asset-row ts-pick-row${checked ? ' checked' : ''}`}
                          style={checked ? { borderColor: team?.color, background: `${team?.color}14` } : undefined}
                        >
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
                          <span className="ts-asset-photo ts-asset-photo-pick">🎟️</span>
                          <span className="ts-asset-info">
                            <span className="ts-asset-name">{label}</span>
                            {pk.protection && <span className="ts-asset-pos">{pk.protection}</span>}
                          </span>
                          <span className="ts-asset-salary">—</span>
                          {checked && <span className="ts-asset-check" style={{ background: team?.color }}>✓</span>}
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
              <h4>📋 トレード内容</h4>
              <div className="ts-board-list">
                {assets.map(a => {
                  const fromTeam = teamMap.get(a.fromTeam);
                  const toTeam = a.toTeam ? teamMap.get(a.toTeam) : null;
                  return (
                    <div key={a.id} className="ts-board-row">
                      <span className="ts-board-team">
                        {fromTeam?.logo && <img src={fromTeam.logo} alt="" width={20} height={20} />}
                        {a.fromTeam}
                      </span>
                      <span className="ts-board-asset">
                        {a.label}
                        {a.salary > 0 && <em>{million(a.salary)}</em>}
                      </span>
                      <span className="ts-board-arrow">➜</span>
                      <span className="ts-board-dest">
                        {toTeam?.logo && <img src={toTeam.logo} alt="" width={20} height={20} />}
                        <select value={a.toTeam ?? ''} onChange={e => setDestination(a.id, e.target.value)}>
                          <option value="">未割当</option>
                          {participants.filter(p => p !== a.fromTeam).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                  );
                })}
              </div>
              {unassignedCount > 0 && (
                <p className="ts-warning">⚠ {unassignedCount}件のアセットに送り先が未割当です。</p>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="ts-results">
              <div className={`ts-verdict${allOk ? ' ts-verdict-ok' : ' ts-verdict-ng'}`}>
                <span className="ts-verdict-icon">{allOk ? '🎉' : '🚫'}</span>
                <span className="ts-verdict-text">{allOk ? 'トレード成立！' : 'トレード成立不可'}</span>
              </div>
              <div className="ts-result-grid">
                {results.map(r => {
                  const team = teamMap.get(r.abbr);
                  return (
                    <div key={r.abbr} className={`ts-result-card${r.ok ? ' ts-ok' : ' ts-ng'}`} style={{ borderTopColor: team?.color }}>
                      <div className="ts-result-head">
                        {team?.logo && <img src={team.logo} alt="" width={30} height={30} />}
                        <strong>{team?.name ?? r.abbr}</strong>
                      </div>
                      <div className="ts-flow">
                        <div className="ts-flow-item">
                          <span>📤 送出</span>
                          <strong>{million(r.outgoingSalary)}</strong>
                        </div>
                        <div className="ts-flow-item">
                          <span>📥 受取</span>
                          <strong>{million(r.incomingSalary)}</strong>
                        </div>
                        <div className="ts-flow-item">
                          <span>上限</span>
                          <strong>{million(r.matchCap)}</strong>
                        </div>
                      </div>
                      <div className="ts-cap-change">
                        <span className={`badge ${badgeClass(TIER_LABEL[r.preTier])}`}>{TIER_LABEL[r.preTier]}</span>
                        <span className="ts-cap-arrow">{million(r.preTotal)} → {million(r.postTotal)}</span>
                        <span className={`badge ${badgeClass(TIER_LABEL[r.postTier])}`}>{TIER_LABEL[r.postTier]}</span>
                      </div>
                      {r.reasons.length > 0 && (
                        <ul className="ts-reasons">
                          {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button type="button" className="ts-reset" onClick={reset}>↺ リセット</button>
        </>
      )}

      <p className="ts-disclaimer">
        ※ サラリーマッチングは簡略化した概算ルールです。トレードキッカー・ベースイヤー報酬・1年以上前のTPEなど一部の例外は考慮していません。実際のトレードはチーム公式・リーグの審査が必要です。
      </p>
    </section>
  );
}
