import type { NBAData } from './types';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

function clean(s = ''): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(s = ''): number {
  const neg = /\$-/.test(s);
  const n = Number((s.match(/[\d,]+/)?.[0] || '0').replaceAll(',', ''));
  return neg ? -n : n;
}

async function get(url: string, type: 'json' | 'text' = 'json') {
  const r = await fetch(url, {
    headers: { 'user-agent': 'NBA-Roster-Cap-Dashboard/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return type === 'text' ? r.text() : r.json();
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        result[i] = await fn(items[i], i);
      }
    })
  );
  return result;
}

function extractSpotrac(html: string) {
  const start = html.indexOf('<table', html.indexOf('id="cap_total"') - 5000);
  const end = html.indexOf('</table>', start);
  const table = start >= 0 && end > start ? html.slice(start, end) : '';
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);
  const caps: Record<string, {
    activePlayers: number | null;
    averageAge: number | null;
    totalCap: number;
    capSpace: number;
    activeCap: number;
    top3Cap: number;
    deadCap: number;
    source: string;
  }> = {};
  const aliases: Record<string, string> = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => clean(x[1]));
    const abbr = cells[1]?.match(/\b[A-Z]{2,3}\b/)?.[0];
    if (!abbr || cells.length < 10) continue;
    caps[aliases[abbr] || abbr] = {
      activePlayers: Number(cells[3]) || null,
      averageAge: Number(cells[4]) || null,
      totalCap: parseMoney(cells[5]),
      capSpace: parseMoney(cells[6]),
      activeCap: parseMoney(cells[7]),
      top3Cap: parseMoney(cells[8]),
      deadCap: parseMoney(cells[9]),
      source: 'Spotrac',
    };
  }
  const threshold = (label: string) => {
    const re = new RegExp(label + '[\\s\\S]{0,700}?Threshold:\\s*\\$([\\d,]+)', 'i');
    return parseMoney(html.match(re)?.[1] || '');
  };
  const firstApron = threshold('FIRST APRON');
  const secondApron = threshold('SECOND APRON');
  const tax = threshold('LUXURY TAX|TAX THRESHOLD|OVER THE TAX');
  const cap =
    Number(html.match(/(?:OVER THE CAP[\s\S]{0,200}?)?Maximum:\s*\$([\d,]+)/i)?.[1]?.replaceAll(',', '')) ||
    null;
  return {
    caps,
    thresholds: {
      salaryCap: cap,
      luxuryTax: tax || null,
      firstApron: firstApron || null,
      secondApron: secondApron || null,
    },
  };
}

function apronStatus(
  total: number,
  t: { salaryCap: number | null; luxuryTax: number | null; firstApron: number | null; secondApron: number | null }
): string {
  if (!total) return '不明';
  if (t.secondApron && total > t.secondApron) return '第2エプロン超';
  if (t.firstApron && total > t.firstApron) return '第1エプロン超';
  if (t.luxuryTax && total > t.luxuryTax) return 'ラグジュアリータックス超';
  if (t.salaryCap && total > t.salaryCap) return 'サラリーキャップ超';
  return 'キャップ内';
}

function translateTransaction(description = ''): string {
  const role = (s: string) =>
    s
      .replace(/\bGs\b/g, 'G')
      .replace(/\bFs\b/g, 'F')
      .replace(/\bCs\b/g, 'C')
      .replace(/\bG\s+(?=[A-Z])/g, 'G（ガード）')
      .replace(/\bF\s+(?=[A-Z])/g, 'F（フォワード）')
      .replace(/\bC\s+(?=[A-Z])/g, 'C（センター）')
      .replace(/\s+and\s+/gi, 'と');

  const translateSentence = (raw: string) => {
    const s = raw.trim().replace(/[.]$/, '');
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^Acquired (.+?) from (.+?) and sent (.+?) to (.+?) as part of a three-team trade$/i)))
      return `3チーム間トレードの一環として、${m[2]}から${role(m[1])}を獲得し、${role(m[3])}を${m[4]}へ放出。`;
    if ((m = s.match(/^Acquired (.+?) from (.+?) in exchange for (.+)$/i)))
      return `${m[2]}から${role(m[1])}を獲得し、対価として${role(m[3])}を放出。`;
    if ((m = s.match(/^Acquired (.+?) from (.+)$/i)))
      return `${m[2]}から${role(m[1])}を獲得。`;
    if ((m = s.match(/^Traded (.+?) to (.+?) in exchange for (.+)$/i)))
      return `${role(m[1])}を${m[2]}へ放出し、対価として${role(m[3])}を獲得。`;
    if ((m = s.match(/^Traded (.+?) to (.+?) for (.+)$/i)))
      return `${role(m[1])}を${m[2]}へ放出し、${role(m[3])}を獲得。`;
    if ((m = s.match(/^Waived (.+)$/i))) return `${role(m[1])}をウェイブ（契約解除）。`;
    if ((m = s.match(/^Placed (.+?) on waivers$/i))) return `${role(m[1])}をウェイブ公示。`;
    if ((m = s.match(/^Released (.+)$/i))) return `${role(m[1])}をリリース。`;
    if ((m = s.match(/^Re-signed (.+?) to (.+)$/i))) return `${role(m[1])}と${m[2]}で再契約。`;
    if ((m = s.match(/^Signed (.+?) to (.+)$/i))) return `${role(m[1])}と${m[2]}で契約。`;
    if ((m = s.match(/^Signed (.+?) off waivers after getting waived by (.+)$/i)))
      return `${m[2]}からウェイブされた${role(m[1])}を獲得。`;
    if ((m = s.match(/^Converted the contract of (.+?) to (.+)$/i)))
      return `${role(m[1])}の契約を${m[2]}へ切り替え。`;
    if ((m = s.match(/^Hired (.+)$/i))) return `${m[1]}を招聘。`;
    return (
      role(s)
        .replace(/three-team trade/gi, '3チーム間トレード')
        .replace(/four-team trade/gi, '4チーム間トレード')
        .replace(/draft considerations/gi, 'ドラフト関連の権利')
        .replace(/draft pick/gi, 'ドラフト指名権')
        .replace(/cash considerations/gi, '金銭')
        .replace(/future considerations/gi, '将来の権利') + '。'
    );
  };

  const protectedText = description.replaceAll('L.A.', 'L§A§').replaceAll('D.C.', 'D§C§');
  return protectedText
    .split(/(?<=\.)\s+/)
    .filter(Boolean)
    .map(x => translateSentence(x.replaceAll('L§A§', 'L.A.').replaceAll('D§C§', 'D.C.')))
    .join(' ')
    .replace(/\bthe L\.A\. Clippers\b/gi, 'L.A. Clippers')
    .replace(/cash and draft considerations/gi, '金銭およびドラフト関連の権利')
    .replace(/cashとドラフト関連の権利/gi, '金銭およびドラフト関連の権利')
    .replace(/cash considerations/gi, '金銭')
    .replace(/a (\d{4}) second-round pick/gi, '$1年2巡目指名権')
    .replace(/a second-round pick swap/gi, '2巡目指名権のスワップ権')
    .replace(/a second-round pick/gi, '2巡目指名権')
    .replace(/a first-round pick/gi, '1巡目指名権')
    .replace(/draft considerations/gi, 'ドラフト関連の権利')
    .replace(/future considerations/gi, '将来の権利')
    .replace(/cashとドラフト関連の権利/gi, '金銭およびドラフト関連の権利');
}

export async function fetchNbaData(): Promise<NBAData> {
  const teamPayload = await get(`${ESPN}/teams?limit=100`);
  const teams = teamPayload.sports[0].leagues[0].teams
    .map((x: { team: unknown }) => x.team as Record<string, unknown>)
    .filter((x: Record<string, unknown>) => x.isActive && !x.isAllStar);
  const season: string =
    teamPayload.sports[0].leagues[0].season?.displayName ||
    `${new Date().getUTCFullYear() - 1}-${String(new Date().getUTCFullYear()).slice(-2)}`;
  const seasonStart = Number(season.slice(0, 4));

  const rosters = await mapLimit(teams, 6, async (team: Record<string, unknown>) => {
    const abbr = (team.abbreviation as string).toLowerCase();
    const payload = await get(`${ESPN}/teams/${abbr}/roster`);
    return (payload.athletes as Record<string, unknown>[]).map(a => ({
      id: a.id as string,
      team: team.abbreviation as string,
      name: a.fullName as string,
      jersey: (a.jersey as string) || '—',
      position: ((a.position as Record<string, string> | undefined)?.abbreviation) || '—',
      status: ((a.status as Record<string, string> | undefined)?.name) || '—',
      age: (a.age as number | null) ?? null,
      height: (a.displayHeight as string) || '',
      weight: (a.displayWeight as string) || '',
      salary: ((a.contract as Record<string, number | null> | undefined)?.salary) ?? null,
      incomingTradeValue: ((a.contract as Record<string, number | null> | undefined)?.incomingTradeValue) ?? null,
      outgoingTradeValue: ((a.contract as Record<string, number | null> | undefined)?.outgoingTradeValue) ?? null,
      yearsRemaining: ((a.contract as Record<string, number | null> | undefined)?.yearsRemaining) ?? null,
      tradeRestricted: Boolean((a.contract as Record<string, unknown> | undefined)?.tradeRestriction),
      headshot: ((a.headshot as Record<string, string> | undefined)?.href) || '',
      profile:
        ((a.links as Array<{ rel?: string[]; href: string }> | undefined)
          ?.find(l => l.rel?.includes('playercard') && l.rel?.includes('desktop'))
          ?.href) || '',
    }));
  });

  let capData: ReturnType<typeof extractSpotrac> = { caps: {}, thresholds: { salaryCap: null, luxuryTax: null, firstApron: null, secondApron: null } };
  let capWarning: string | null = null;
  try {
    capData = extractSpotrac(
      await get(`https://www.spotrac.com/nba/cap/_/year/${seasonStart}`, 'text')
    );
  } catch (e) {
    capWarning = `Spotrac取得失敗: ${(e as Error).message}`;
  }

  const thresholds = {
    salaryCap: capData.thresholds.salaryCap || ({ '2025-26': 154647000 } as Record<string, number>)[season] || null,
    luxuryTax: capData.thresholds.luxuryTax || null,
    firstApron: capData.thresholds.firstApron || null,
    secondApron: capData.thresholds.secondApron || null,
  };

  const players = rosters.flat();
  const teamRows = teams.map((team: Record<string, unknown>) => {
    const abbr = team.abbreviation as string;
    const roster = players.filter(p => p.team === abbr);
    const reported = capData.caps[abbr];
    const rosterSalary = roster.reduce((sum, p) => sum + (p.salary || 0), 0);
    const total = reported?.totalCap || rosterSalary;
    const logos = team.logos as Array<{ rel?: string[]; href: string }> | undefined;
    return {
      id: team.id as string,
      abbreviation: abbr,
      name: team.displayName as string,
      logo: logos?.find(l => l.rel?.includes('default'))?.href || '',
      color: `#${(team.color as string) || '1d428a'}`,
      playerCount: roster.length,
      rosterSalary,
      totalCap: reported?.totalCap || null,
      activeCap: reported?.activeCap || null,
      deadCap: reported?.deadCap || null,
      capSpace: reported?.capSpace ?? null,
      apronStatus: apronStatus(total, thresholds),
      capSource: reported ? 'Spotrac' : 'ESPNロスター合計（概算）',
    };
  });

  const txPayload = await get(`${ESPN}/transactions?limit=200`);
  const transactions = ((txPayload.transactions || []) as Record<string, unknown>[]).map((x, i) => ({
    id: `${x.date}-${(x.team as Record<string, string> | undefined)?.abbreviation || 'NBA'}-${i}`,
    date: x.date as string,
    team: (x.team as Record<string, string> | undefined)?.abbreviation || 'NBA',
    teamName: (x.team as Record<string, string> | undefined)?.displayName || 'NBA',
    description: x.description as string,
    descriptionJa: translateTransaction(x.description as string),
    type: /trade|traded|acquired/i.test(x.description as string)
      ? 'トレード'
      : /signed|contract|waived|released/i.test(x.description as string)
      ? '契約・ウェイブ'
      : 'その他',
  }));

  return {
    meta: {
      updatedAt: new Date().toISOString(),
      season,
      sources: ['ESPN roster / contract / transactions API', 'Spotrac team cap tracker'],
      notes: [
        'サラリーはESPNのロスター契約値。チーム総額・デッドキャップ・エプロン判定はSpotrac取得成功時のみ正確なチーム配賦額を使用。',
        '情報提供目的です。契約判断はNBA公式発表・CBA・各チーム発表でも確認してください。',
      ],
      warning: capWarning,
    },
    thresholds: thresholds as NBAData['thresholds'],
    teams: teamRows,
    players,
    transactions,
  };
}
