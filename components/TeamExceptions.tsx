import type { Thresholds } from '@/lib/types';
import { getTeamExceptions, million } from '@/lib/utils';
import GlossaryPopover from './GlossaryPopover';

interface Props {
  team: { totalCap: number | null; rosterSalary: number };
  thresholds: Thresholds;
}

export default function TeamExceptions({ team, thresholds }: Props) {
  const exceptions = getTeamExceptions(team, thresholds);

  return (
    <section className="team-exceptions">
      <h3>このチームが使える武器</h3>
      <p className="te-sub">現在のキャップ状況から判定した、補強に使える契約ツール（概算）</p>
      <div className="te-grid">
        {exceptions.map(ex => (
          <div key={ex.key} className={`te-card ${ex.available ? 'te-available' : 'te-locked'}`}>
            <div className="te-card-head">
              <span className="te-icon">{ex.available ? '✓' : '✕'}</span>
              {ex.glossaryTerm ? (
                <GlossaryPopover term={ex.glossaryTerm}>
                  <span className="te-label">{ex.label}</span>
                </GlossaryPopover>
              ) : (
                <span className="te-label">{ex.label}</span>
              )}
            </div>
            {ex.amount != null && <strong className="te-amount">{million(ex.amount)}</strong>}
            <p className="te-note">{ex.note}</p>
          </div>
        ))}
      </div>
      <p className="te-disclaimer">※ 金額はサラリーキャップに対する規定比率からの概算です。実際の例外枠は個別の契約状況により変動します。</p>
    </section>
  );
}
