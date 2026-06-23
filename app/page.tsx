import type { Metadata } from 'next';
import { getNBAData } from '@/lib/data';
import ThresholdCards from '@/components/ThresholdCards';
import RuleGuide from '@/components/RuleGuide';
import Dashboard from '@/components/Dashboard';

export const metadata: Metadata = { title: 'NBA Roster & Cap Board' };

export default function Home() {
  const data = getNBAData();
  const updatedAt = new Date(data.meta.updatedAt).toLocaleString('ja-JP');

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">NBA OPERATIONS DESK</p>
          <h1>Roster &amp; Cap Board</h1>
          <p className="meta">
            {data.meta.season} · 更新 {updatedAt} · {data.players.length}選手
          </p>
        </div>
      </header>
      <main>
        <ThresholdCards thresholds={data.thresholds} />
        <RuleGuide thresholds={data.thresholds} />
        <Dashboard data={data} />
        <p className="footnote">
          {data.meta.notes.join(' ')}
          {data.meta.warning ? ' ' + data.meta.warning : ''}
        </p>
      </main>
    </>
  );
}
