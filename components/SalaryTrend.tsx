'use client';

import { million } from '@/lib/utils';

interface DataPoint {
  season: string;
  totalCap: number | null;
  rosterSalary: number;
}

interface Thresholds {
  salaryCap: number | null;
  luxuryTax: number | null;
  firstApron: number | null;
  secondApron: number | null;
}

interface Props {
  points: DataPoint[];
  color: string;
  thresholds: Thresholds;
}

const W = 620;
const H = 220;
const PAD = { top: 24, right: 24, bottom: 36, left: 64 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

const REF_LINES = [
  { key: 'salaryCap' as keyof Thresholds, label: 'キャップ', color: '#4285d4', dash: '5,3' },
  { key: 'luxuryTax' as keyof Thresholds, label: '税ライン', color: '#e2b632', dash: '5,3' },
  { key: 'firstApron' as keyof Thresholds, label: '第1', color: '#ee7e2f', dash: '5,3' },
  { key: 'secondApron' as keyof Thresholds, label: '第2', color: '#d63a49', dash: '5,3' },
];

export default function SalaryTrend({ points, color, thresholds }: Props) {
  if (points.length < 2) {
    return <p className="no-history-msg">グラフを表示するには2シーズン以上のデータが必要です。</p>;
  }

  const values = points.map(p => p.totalCap ?? p.rosterSalary).filter(v => v > 0);
  const refValues = Object.values(thresholds).filter((v): v is number => v != null);
  const allValues = [...values, ...refValues];

  const minV = Math.min(...values) * 0.88;
  const maxV = Math.max(...allValues) * 1.04;
  const range = maxV - minV || 1;

  const xPos = (i: number) => PAD.left + (i / (points.length - 1)) * IW;
  const yPos = (v: number) => PAD.top + IH - ((v - minV) / range) * IH;

  const sorted = [...points].sort((a, b) => a.season.localeCompare(b.season));
  const pathD = sorted
    .map((p, i) => {
      const v = p.totalCap ?? p.rosterSalary;
      return `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`;
    })
    .join(' ');

  const yLabels = Array.from({ length: 5 }, (_, i) => minV + (i / 4) * range);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="salary-trend-svg"
      role="img"
      aria-label="サラリートレンド"
    >
      {/* Horizontal grid */}
      {yLabels.map(v => {
        const y = yPos(v).toFixed(1);
        return (
          <line key={v} x1={PAD.left} y1={y} x2={PAD.left + IW} y2={y}
            stroke="#e7edf3" strokeWidth="1" />
        );
      })}

      {/* Threshold reference lines */}
      {REF_LINES.map(({ key, label, color: rc, dash }) => {
        const v = thresholds[key];
        if (!v) return null;
        const y = yPos(v);
        if (y < PAD.top || y > PAD.top + IH) return null;
        return (
          <g key={key}>
            <line x1={PAD.left} y1={y} x2={PAD.left + IW} y2={y}
              stroke={rc} strokeWidth="1.5" strokeDasharray={dash} />
            <text x={PAD.left + IW - 2} y={y - 3} fill={rc} fontSize="9" textAnchor="end">
              {label}
            </text>
          </g>
        );
      })}

      {/* Salary line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Area fill */}
      <path
        d={`${pathD} L${xPos(sorted.length - 1).toFixed(1)},${(PAD.top + IH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + IH).toFixed(1)} Z`}
        fill={color}
        fillOpacity="0.08"
      />

      {/* Data points */}
      {sorted.map((p, i) => {
        const v = p.totalCap ?? p.rosterSalary;
        const cx = xPos(i).toFixed(1);
        const cy = yPos(v).toFixed(1);
        return (
          <g key={p.season}>
            <circle cx={cx} cy={cy} r="5" fill={color} />
            <circle cx={cx} cy={cy} r="3" fill="white" />
            <title>{p.season}: {million(v)}</title>
          </g>
        );
      })}

      {/* Y-axis labels */}
      {yLabels.map(v => (
        <text key={v} x={PAD.left - 5} y={yPos(v) + 3} textAnchor="end" fontSize="9" fill="#637387">
          {million(v)}
        </text>
      ))}

      {/* X-axis labels */}
      {sorted.map((p, i) => (
        <text key={p.season} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#637387">
          {p.season.slice(2, 5)}
        </text>
      ))}
    </svg>
  );
}
