import Link from 'next/link';
import type { SeasonStandings, StandingEntry } from '@/lib/types';

function ConfTable({ entries, label }: { entries: StandingEntry[]; label: string }) {
  return (
    <div className="sth-conf">
      <h3 className="sth-conf-title">{label}</h3>
      <table className="sth-table">
        <colgroup>
          <col style={{ width: 28 }} />
          <col />
          <col style={{ width: 32 }} />
          <col style={{ width: 32 }} />
          <col style={{ width: 38 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="sth-rank">#</th>
            <th className="sth-col-team">チーム</th>
            <th style={{ textAlign: 'right' }}>W</th>
            <th style={{ textAlign: 'right' }}>L</th>
            <th className="sth-pct">勝率</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const cls = e.rank <= 6 ? 'playoff' : e.rank <= 10 ? 'playin' : '';
            const pct = e.wins + e.losses > 0
              ? (e.wins / (e.wins + e.losses)).toFixed(3).replace(/^0/, '')
              : '—';
            return (
              <tr key={e.abbr} className={cls}>
                <td className="sth-rank">
                  {e.rank <= 6 ? <span className="seed-dot playoff" /> : e.rank <= 10 ? <span className="seed-dot playin" /> : null}
                  {e.rank}
                </td>
                <td>
                  <Link href={`/team/${e.abbr}`} className="sth-team-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {e.logo && <img src={e.logo} alt={e.abbr} width={22} height={22} />}
                    <span>
                      <b className="sth-abbr">{e.abbr}</b>
                      <span className="sth-name"> {e.name}</span>
                    </span>
                  </Link>
                </td>
                <td><b>{e.wins}</b></td>
                <td className="sth-losses">{e.losses}</td>
                <td className="sth-pct">{pct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsHero({ standings }: { standings: SeasonStandings }) {
  return (
    <section className="standings-hero">
      <div className="sth-header">
        <h2 className="sth-title">{standings.season} シーズン順位</h2>
        <div className="sth-legend">
          <span><span className="seed-dot playoff inline" />プレーオフ</span>
          <span><span className="seed-dot playin inline" />プレーイン</span>
        </div>
      </div>
      <div className="sth-both">
        <ConfTable entries={standings.east} label="イースタン・カンファレンス" />
        <ConfTable entries={standings.west} label="ウェスタン・カンファレンス" />
      </div>
    </section>
  );
}
