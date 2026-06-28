'use client';

import { useState, useRef, useEffect } from 'react';
import type { TeamPhase } from '@/lib/utils';

export default function PhaseBadge({ phase }: { phase: TeamPhase }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const m = phase.metrics;

  return (
    <span ref={ref} className="phase-badge-wrap" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}>
      <span className={`phase-badge phase-${phase.tier}`}>
        {phase.label}
        <span className="phase-badge-arrow"> ▾</span>
      </span>

      {open && (
        <div className="phase-popover">
          <div className="phase-pop-header">
            <span className={`phase-badge phase-${phase.tier}`}>{phase.label}</span>
            <span className="phase-pop-subtitle">チームフェーズ判定</span>
          </div>

          <p className="phase-pop-desc">{phase.description}</p>

          <div className="phase-pop-metrics">
            <div className="phase-metric">
              <span className="pm-key">カンファ順位</span>
              <span className="pm-val">{m.confRank}位</span>
            </div>
            <div className="phase-metric">
              <span className="pm-key">平均年齢</span>
              <span className="pm-val">{m.avgAge.toFixed(1)}歳</span>
            </div>
            <div className="phase-metric">
              <span className="pm-key">自前指名権</span>
              <span className="pm-val">{m.ownPicks}/10本</span>
            </div>
            <div className="phase-metric">
              <span className="pm-key">総保有指名権</span>
              <span className="pm-val">{m.totalPicks}本</span>
            </div>
            <div className="phase-metric">
              <span className="pm-key">給与状況</span>
              <span className="pm-val">{m.apronStatus}</span>
            </div>
          </div>

          <p className="phase-pop-note">※ 独断と偏見に基づく自動分類です</p>
        </div>
      )}
    </span>
  );
}
