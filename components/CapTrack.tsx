import { Thresholds } from '@/lib/types';

interface Props {
  total: number;
  color: string;
  thresholds: Thresholds;
  max: number;
}

export default function CapTrack({ total, color, thresholds: t, max }: Props) {
  const p = (n: number) => Math.min(100, (n / max) * 100);
  return (
    <div className="cap-track">
      <div className="cap-zones" />
      <i className="team-fill" style={{ width: `${p(total)}%`, background: color }} />
      <b className="marker cap-m" style={{ left: `${p(t.salaryCap)}%` }} />
      <b className="marker tax-m" style={{ left: `${p(t.luxuryTax)}%` }} />
      <b className="marker first-m" style={{ left: `${p(t.firstApron)}%` }} />
      <b className="marker second-m" style={{ left: `${p(t.secondApron)}%` }} />
      <em className="total-dot" style={{ left: `${p(total)}%`, borderColor: color }} />
    </div>
  );
}
