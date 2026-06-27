import type { ContractType } from '@/lib/types';

const LABEL: Record<NonNullable<ContractType>, string> = {
  '2-way': '2-WAY',
  '10-day': '10日間',
  'exhibit-10': 'Ex-10',
  'standard': '',
};

export default function ContractBadge({ type }: { type: ContractType }) {
  if (!type || type === 'standard') return null;
  return <span className={`contract-badge cb-${type.replace('-', '')}`}>{LABEL[type]}</span>;
}
