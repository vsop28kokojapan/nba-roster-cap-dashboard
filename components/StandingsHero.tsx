import Link from 'next/link';
import type { SeasonStandings, StandingEntry } from '@/lib/types';

function ConfTable({ entries, label }: { entries: StandingEntry[]; label: string }) {
  return (
    <div className="sth-conf">
      <h3 className="sth-conf-title">{label}</h3>
      <div className="sth-list">
        {entries.map(e => {
          const cls = e.rank <= 6 ? 'playoff' : e.rank <= 10 ? 'playin' : '';
          const pct = e.wins + e.losses > 0
            ? (e.wins / (e.wins + e.losses)).toFixed(3).replace(/^0/, '')
            : '—';
          return (
            <Link key={e.abbr} href={`/team/${e.abbr}`} className={`sth-row${cls ? ' ' + cls : ''}`}>
              <span className="sth-rank">{e.rank}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.logo && <img className="sth-logo" src={e.logo} alt="" width={22} height={22} />}
              <b className="sth-abbr">{e.abbr}</b>
              <span className="sth-record"><b>{e.wins}</b>-{e.losses}</span>
              <span className="sth-pct">{pct}</span>
            </Link>
          );
        })}
      </div>
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
