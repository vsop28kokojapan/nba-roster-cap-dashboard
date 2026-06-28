import type { Thresholds, NBAData } from './types';

// ── チームフェーズ分類 ─────────────────────────────────────────────────────
// ロスター年齢・カンファレンス順位・キャップ状況・将来指名権保有数から自動判定

export interface TeamPhase {
  label: string;
  tier: 'championship' | 'rising' | 'playoff' | 'bubble' | 'transition' | 'rebuild' | 'draft';
  detail: string; // 根拠の一言説明
}

export function getTeamPhase(abbr: string, data: NBAData): TeamPhase | null {
  const team = data.teams.find(t => t.abbreviation === abbr);
  if (!team) return null;

  // カンファレンス順位（1–15）
  const curStandings = data.standings?.[0];
  const rank =
    curStandings?.east.find(t => t.abbr === abbr)?.rank ??
    curStandings?.west.find(t => t.abbr === abbr)?.rank ??
    15;

  // 平均年齢（給与のある選手のみ）
  const roster = data.players.filter(p => p.team === abbr && p.age != null);
  const avgAge =
    roster.length > 0 ? roster.reduce((s, p) => s + p.age!, 0) / roster.length : 26.5;

  // 将来指名権（自前保有数 / 最大10本=5年×2巡）
  const picks = data.futurePicks?.[abbr] ?? [];
  const ownPicks = picks.filter(p => !p.from).length;

  // キャップ状況
  const isOverTax =
    team.apronStatus.includes('タックス') || team.apronStatus.includes('エプロン');
  const isYoung = avgAge < 26.5;

  // ── 優先度順に判定 ──
  // 1. ドラフト重視：順位下位 + 自前指名権 8本以上
  if (rank >= 10 && ownPicks >= 8) {
    return { label: 'ドラフト重視', tier: 'draft', detail: `自前指名権 ${ownPicks}/10本保有・資産蓄積フェーズ` };
  }

  // 2. 優勝争い：上位シード + 高給与 or ベテラン核
  if (rank <= 4 && (isOverTax || !isYoung)) {
    return { label: '優勝争い', tier: 'championship', detail: `カンファ${rank}位・${isOverTax ? '贅沢税超' : ''}ベテラン核` };
  }

  // 3. 急成長中：上位シード + 若いロスター
  if (rank <= 6 && isYoung) {
    return { label: '急成長中', tier: 'rising', detail: `カンファ${rank}位・平均年齢${avgAge.toFixed(1)}歳の若手主体` };
  }

  // 4. プレーオフ圏：確実なプレーオフ圏内
  if (rank <= 8) {
    return { label: 'プレーオフ圏', tier: 'playoff', detail: `カンファ${rank}位・プレーオフ確定圏` };
  }

  // 5. プレーオフバブル：プレーイン圏
  if (rank <= 11) {
    return { label: 'バブル圏', tier: 'bubble', detail: `カンファ${rank}位・プレーイン争い中` };
  }

  // 6. 再建中：下位 + 若手主体
  if (isYoung) {
    return { label: '再建中', tier: 'rebuild', detail: `平均年齢${avgAge.toFixed(1)}歳・若手育成フェーズ` };
  }

  // 7. 移行期：その他
  return { label: '移行期', tier: 'transition', detail: `カンファ${rank}位・ロスター再編中` };
}

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
