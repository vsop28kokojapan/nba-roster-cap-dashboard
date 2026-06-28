import type { Thresholds, NBAData } from './types';

// ── チームフェーズ分類 ─────────────────────────────────────────────────────
// ロスター年齢・カンファレンス順位・キャップ状況・将来指名権保有数から自動判定

export interface TeamPhase {
  label: string;
  tier: 'championship' | 'rising' | 'playoff' | 'bubble' | 'transition' | 'rebuild' | 'draft';
  description: string;  // フェーズの意味説明
  metrics: {
    confRank: number;
    avgAge: number;
    ownPicks: number;
    totalPicks: number;
    isOverTax: boolean;
    apronStatus: string;
  };
}

const PHASE_DESCRIPTIONS: Record<TeamPhase['tier'], string> = {
  championship: '優勝候補。上位シードを維持しながら高額のロスターを抱え、今シーズンの優勝を狙っているチーム。ベテランや実績あるスター中心の編成が多い。',
  rising:       '急速に強くなっている若いチーム。上位シードにいながら平均年齢が低く、今後さらなる成長が期待される。数年以内に優勝争いに加わる可能性大。',
  playoff:      '安定したプレーオフチーム。出場はほぼ確実で、シリーズを戦える戦力を持っている。ただし優勝候補とのギャップを埋めるための補強が課題。',
  bubble:       'プレーイン出場権を争っている状況。わずかな勝敗の差で順位が変わる緊張感のある位置。シーズン後半の戦い方が鍵を握る。',
  draft:        '将来のドラフト指名権を大量に確保し、資産の蓄積を優先しているチーム。高い指名順位でスーパースターを引き当てることを狙った長期戦略フェーズ。',
  rebuild:      '若手選手の育成と成長を最優先にしているチーム。勝敗より経験と開発を重視し、数年後の競争力向上を目標にしている。',
  transition:   'ロスターの再編と方向性の模索中。ベテランと若手が混在し、チームのビジョンがまだ固まっていない過渡期。補強や放出によって方向が変わる可能性がある。',
};

export function getTeamPhase(abbr: string, data: NBAData): TeamPhase | null {
  const team = data.teams.find(t => t.abbreviation === abbr);
  if (!team) return null;

  const curStandings = data.standings?.[0];
  const rank =
    curStandings?.east.find(t => t.abbr === abbr)?.rank ??
    curStandings?.west.find(t => t.abbr === abbr)?.rank ??
    15;

  const roster = data.players.filter(p => p.team === abbr && p.age != null);
  const avgAge =
    roster.length > 0 ? roster.reduce((s, p) => s + p.age!, 0) / roster.length : 26.5;

  const allPicks = data.futurePicks?.[abbr] ?? [];
  const ownPicks = allPicks.filter(p => !p.from).length;
  const totalPicks = allPicks.length;

  const isOverTax =
    team.apronStatus.includes('タックス') || team.apronStatus.includes('エプロン');
  const isYoung = avgAge < 26.5;

  const metrics = { confRank: rank, avgAge, ownPicks, totalPicks, isOverTax, apronStatus: team.apronStatus };

  const make = (tier: TeamPhase['tier']): TeamPhase => ({
    label: { championship: '優勝争い', rising: '急成長中', playoff: 'プレーオフ圏',
             bubble: 'バブル圏', draft: 'ドラフト重視', rebuild: '再建中', transition: '移行期' }[tier],
    tier, description: PHASE_DESCRIPTIONS[tier], metrics,
  });

  if (rank >= 10 && ownPicks >= 8) return make('draft');
  if (rank <= 4 && (isOverTax || !isYoung)) return make('championship');
  if (rank <= 6 && isYoung) return make('rising');
  if (rank <= 8) return make('playoff');
  if (rank <= 11) return make('bubble');
  if (isYoung) return make('rebuild');
  return make('transition');
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
