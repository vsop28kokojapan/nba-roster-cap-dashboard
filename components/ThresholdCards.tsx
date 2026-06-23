import { Thresholds } from '@/lib/types';
import { yen } from '@/lib/utils';

const LABELS: [keyof Thresholds, string][] = [
  ['salaryCap', 'サラリーキャップ'],
  ['luxuryTax', 'ラグジュアリータックス'],
  ['firstApron', '第1エプロン'],
  ['secondApron', '第2エプロン'],
];

export default function ThresholdCards({ thresholds }: { thresholds: Thresholds }) {
  return (
    <section className="thresholds">
      {LABELS.map(([key, label]) => (
        <div key={key} className="threshold">
          <small>{label}</small>
          <strong>{yen(thresholds[key])}</strong>
        </div>
      ))}
    </section>
  );
}
