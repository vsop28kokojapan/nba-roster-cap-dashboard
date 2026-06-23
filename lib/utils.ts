import { Thresholds } from './types';

export const yen = (n: number | null | undefined): string =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US');

export const million = (n: number | null | undefined): string =>
  n == null ? '—' : '$' + (n / 1_000_000).toFixed(1) + 'M';

export const fmtDate = (s: string): string =>
  new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));

export function badgeClass(status: string): string {
  if (status.includes('第2')) return 'danger';
  if (status.includes('超')) return 'warn';
  return 'ok';
}

export function capScale(teams: { totalCap: number | null; rosterSalary: number }[], secondApron: number): number {
  return Math.max(secondApron * 1.16, ...teams.map(t => t.totalCap ?? t.rosterSalary));
}

export function distanceText(total: number, t: Thresholds): string {
  if (total > t.secondApron) return `第2エプロンを ${million(total - t.secondApron)} 超過`;
  if (total > t.firstApron) return `第2エプロンまで ${million(t.secondApron - total)}`;
  if (total > t.luxuryTax) return `第1エプロンまで ${million(t.firstApron - total)}`;
  if (total > t.salaryCap) return `税ラインまで ${million(t.luxuryTax - total)}`;
  return `キャップまで ${million(t.salaryCap - total)}`;
}

export function lineDifference(total: number, value: number): string {
  const d = total - value;
  return d >= 0 ? `${million(d)} 超過` : `あと ${million(-d)}`;
}
