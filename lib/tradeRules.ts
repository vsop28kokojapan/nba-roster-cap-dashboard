import type { Thresholds } from './types';
import { million } from './utils';

// ── トレードシミュレーター：サラリーマッチングルール（簡略版） ──────────────
// CBAの正式ルールを近似したもの。トレードキッカー・ベースイヤー報酬・
// 1年以上前のTPEなど細部は省略している。

export type ApronTier = 'room' | 'tax' | 'apron1' | 'apron2';

export const TIER_LABEL: Record<ApronTier, string> = {
  room: 'キャップ内',
  tax: 'ラグジュアリータックス超',
  apron1: '第1エプロン超',
  apron2: '第2エプロン超',
};

const MATCH_BUFFER = 250_000;
const TAX_MATCH_RATIO = 1.25;
const APRON1_MATCH_RATIO = 1.10;

export function classifyTier(total: number, t: Thresholds): ApronTier {
  if (total <= t.salaryCap) return 'room';
  if (total <= t.firstApron) return 'tax';
  if (total <= t.secondApron) return 'apron1';
  return 'apron2';
}

export interface TradeAsset {
  id: string;
  kind: 'player' | 'pick';
  fromTeam: string;
  toTeam: string | null;
  label: string;
  detail: string;
  salary: number;
}

export interface TeamTradeResult {
  abbr: string;
  outgoingSalary: number;
  incomingSalary: number;
  outgoingPlayerCount: number;
  incomingPlayerCount: number;
  preTotal: number;
  postTotal: number;
  preTier: ApronTier;
  postTier: ApronTier;
  matchCap: number;
  ok: boolean;
  reasons: string[];
}

export function evaluateTeamTrade(
  team: { abbreviation: string; totalCap: number | null; rosterSalary: number },
  thresholds: Thresholds,
  assets: TradeAsset[],
): TeamTradeResult {
  const abbr = team.abbreviation;
  const outgoing = assets.filter(a => a.fromTeam === abbr);
  const incoming = assets.filter(a => a.toTeam === abbr);
  const outgoingSalary = outgoing.reduce((s, a) => s + a.salary, 0);
  const incomingSalary = incoming.reduce((s, a) => s + a.salary, 0);
  const outgoingPlayerCount = outgoing.filter(a => a.kind === 'player').length;
  const incomingPlayerCount = incoming.filter(a => a.kind === 'player').length;

  const preTotal = team.totalCap ?? team.rosterSalary;
  const postTotal = preTotal - outgoingSalary + incomingSalary;
  const preTier = classifyTier(preTotal, thresholds);
  const postTier = classifyTier(postTotal, thresholds);

  const reasons: string[] = [];
  let matchCap: number;

  if (preTier === 'room') {
    const capSpace = Math.max(0, thresholds.salaryCap - preTotal);
    matchCap = capSpace + outgoingSalary + MATCH_BUFFER;
  } else if (preTier === 'tax') {
    matchCap = outgoingSalary * TAX_MATCH_RATIO + MATCH_BUFFER;
  } else if (preTier === 'apron1') {
    matchCap = outgoingSalary * APRON1_MATCH_RATIO + MATCH_BUFFER;
  } else {
    matchCap = outgoingSalary;
    if (outgoingPlayerCount > 1 && incomingSalary > 0) {
      reasons.push('第2エプロン超過チームは複数選手の給与を合算してトレードに使えません。');
    }
  }

  if (incomingSalary > matchCap) {
    reasons.push(`受け取り給与が上限（概算 ${million(matchCap)}）を超過しています。`);
  }

  return {
    abbr,
    outgoingSalary,
    incomingSalary,
    outgoingPlayerCount,
    incomingPlayerCount,
    preTotal,
    postTotal,
    preTier,
    postTier,
    matchCap,
    ok: reasons.length === 0,
    reasons,
  };
}
