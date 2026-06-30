'use client';

import { useState } from 'react';
import type { NBAData, SeasonAwards, StandingEntry } from '@/lib/types';

const AWARD_LABELS: { key: keyof SeasonAwards; label: string; icon: string; isArray: boolean }[] = [
  { key: 'mvp',          label: 'MVP',                 icon: '👑', isArray: false },
  { key: 'finalsMvp',   label: 'ファイナルズMVP',     icon: '🏆', isArray: false },
  { key: 'dpoy',        label: '守備最優秀',           icon: '🛡',  isArray: false },
  { key: 'roy',         label: '新人賞',               icon: '⭐',  isArray: false },
  { key: 'mip',         label: '最多躍進',             icon: '📈', isArray: false },
  { key: 'sixthMan',    label: '第6の男',              icon: '6️⃣',  isArray: false },
  { key: 'nbaCupMvp',   label: 'NBAカップMVP',        icon: '🥇', isArray: false },
  { key: 'clutchPlayer',label: 'クラッチ賞',           icon: '🎯', isArray: false },
  { key: 'allNba1',     label: 'オールNBA 1stチーム', icon: '★',  isArray: true  },
  { key: 'allNba2',     label: 'オールNBA 2ndチーム', icon: '☆',  isArray: true  },
  { key: 'allNba3',     label: 'オールNBA 3rdチーム', icon: '☆',  isArray: true  },
  { key: 'allDefense1', label: 'オール守備 1st',       icon: '🛡',  isArray: true  },
  { key: 'allDefense2', label: 'オール守備 2nd',       icon: '🛡',  isArray: true  },
  { key: 'allRookie1',  label: 'オール新人 1st',       icon: '⭐',  isArray: true  },
];

function StandingsTable({ east, west, season }: { east: StandingEntry[]; west: StandingEntry[]; season: string }) {
  return (
    <div className="standings-wrap">
      <p className="eyebrow dark">{season} カンファレンス順位</p>
      <div className="standings-both">
        {[{ label: 'イースト', entries: east }, { label: 'ウェスト', entries: west }].map(({ label, entries }) => (
          <div key={label} className="standings-conf">
            <h4>{label}</h4>
            <div className="standings-list">
              {entries.map(e => (
                <div key={e.abbr} className={`standings-row${e.rank <= 6 ? ' playoff-in' : e.rank <= 10 ? ' playin' : ''}`}>
                  <span className="sr-rank">{e.rank}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.logo && <img className="sr-logo" src={e.logo} alt="" width={26} height={26} />}
                  <span className="sr-name"><b>{e.abbr}</b> <span className="standings-name">{e.name}</span></span>
                  <span className="sr-record"><b>{e.wins}</b>-{e.losses}</span>
                  <span className="sr-pct">{e.wins + e.losses > 0 ? (e.wins / (e.wins + e.losses)).toFixed(3).replace(/^0/, '') : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AwardsPanel({ data }: { data: NBAData }) {
  const [selectedSeason, setSelectedSeason] = useState(data.awards[0]?.season ?? '');

  const currentAwards = data.awards.find(a => a.season === selectedSeason);
  const currentStandings = data.standings.find(s => s.season === selectedSeason);

  const seasons = data.awards.map(a => a.season);
  const playerById = new Map(data.players.map(p => [p.id, p]));

  return (
    <div className="awards-panel">
      <div className="awards-season-nav">
        {seasons.map(s => (
          <button
            key={s}
            className={`awards-season-btn${selectedSeason === s ? ' active' : ''}`}
            onClick={() => setSelectedSeason(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {currentAwards && (
        <>
          <div className="awards-grid">
            {/* Individual awards */}
            <div className="awards-col">
              <p className="eyebrow dark">個人賞</p>
              <div className="award-cards">
                {AWARD_LABELS.filter(a => !a.isArray).map(({ key, label, icon }) => {
                  const entry = currentAwards[key] as import('@/lib/types').AwardEntry | undefined;
                  if (!entry) return null;
                  const player = playerById.get(entry.athleteId);
                  return (
                    <div key={key} className="award-card">
                      {player?.headshot
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="award-photo" src={player.headshot} alt="" width={36} height={36} />
                        : <span className="award-icon">{icon}</span>}
                      <div>
                        <p className="award-label">{icon} {label}</p>
                        <p className="award-name">
                          {entry.athleteName}
                          {player?.age != null && <span className="player-age">{player.age}歳</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team awards */}
            <div className="awards-col">
              <p className="eyebrow dark">オールNBA・守備・新人チーム</p>
              <div className="award-teams">
                {AWARD_LABELS.filter(a => a.isArray).map(({ key, label, icon }) => {
                  const entries = currentAwards[key] as import('@/lib/types').AwardEntry[];
                  if (!entries?.length) return null;
                  return (
                    <div key={key} className="award-team-row">
                      <span className="award-team-label">{icon} {label}</span>
                      <div className="award-team-members">
                        {entries.map(e => {
                          const player = playerById.get(e.athleteId);
                          return (
                            <span key={e.athleteId} className="award-member">
                              {player?.headshot &&
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img className="award-member-photo" src={player.headshot} alt="" width={22} height={22} />}
                              {e.athleteName}
                              {player?.age != null && <span className="player-age">{player.age}歳</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {currentStandings && (
        <StandingsTable
          east={currentStandings.east}
          west={currentStandings.west}
          season={currentStandings.season}
        />
      )}

      <div className="standings-legend">
        <span className="playoff-in-dot"></span> プレーオフ進出（1〜6位）
        <span className="playin-dot"></span> プレーイン対象（7〜10位）
      </div>
    </div>
  );
}
