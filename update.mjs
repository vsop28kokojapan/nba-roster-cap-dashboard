import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data');
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const clean = (s = '') => s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const money = (s = '') => {
  const neg = /\$-/.test(s);
  const n = Number((s.match(/[\d,]+/)?.[0] || '0').replaceAll(',', ''));
  return neg ? -n : n;
};

async function get(url, type = 'json') {
  const r = await fetch(url, { headers: { 'user-agent': 'NBA-Roster-Cap-Dashboard/1.0' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return type === 'text' ? r.text() : r.json();
}

async function mapLimit(items, limit, fn) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      result[i] = await fn(items[i], i);
    }
  }));
  return result;
}

function extractSpotrac(html) {
  const start = html.indexOf('<table', html.indexOf('id="cap_total"') - 5000);
  const end = html.indexOf('</table>', start);
  const table = start >= 0 && end > start ? html.slice(start, end) : '';
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);
  const caps = {};
  const aliases = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => clean(x[1]));
    const abbr = cells[1]?.match(/\b[A-Z]{2,3}\b/)?.[0];
    if (!abbr || cells.length < 10) continue;
    caps[aliases[abbr] || abbr] = {
      activePlayers: Number(cells[3]) || null,
      averageAge: Number(cells[4]) || null,
      totalCap: money(cells[5]),
      capSpace: money(cells[6]),
      activeCap: money(cells[7]),
      top3Cap: money(cells[8]),
      deadCap: money(cells[9]),
      source: 'Spotrac'
    };
  }
  const threshold = (label) => {
    const re = new RegExp(label + '[\\s\\S]{0,700}?Threshold:\\s*\\$([\\d,]+)', 'i');
    return money(html.match(re)?.[1] || '');
  };
  const firstApron = threshold('FIRST APRON');
  const secondApron = threshold('SECOND APRON');
  const tax = threshold('LUXURY TAX|TAX THRESHOLD|OVER THE TAX');
  const cap = Number(html.match(/(?:OVER THE CAP[\s\S]{0,200}?)?Maximum:\s*\$([\d,]+)/i)?.[1]?.replaceAll(',', '')) || null;
  return { caps, thresholds: { salaryCap: cap, luxuryTax: tax || null, firstApron: firstApron || null, secondApron: secondApron || null } };
}

function apronStatus(total, t) {
  if (!total) return '不明';
  if (t.secondApron && total > t.secondApron) return '第2エプロン超';
  if (t.firstApron && total > t.firstApron) return '第1エプロン超';
  if (t.luxuryTax && total > t.luxuryTax) return 'ラグジュアリータックス超';
  if (t.salaryCap && total > t.salaryCap) return 'サラリーキャップ超';
  return 'キャップ内';
}

function translateTransaction(description = '') {
  const role = s => s
    .replace(/\bGs\b/g, 'G')
    .replace(/\bFs\b/g, 'F')
    .replace(/\bCs\b/g, 'C')
    .replace(/\bG\s+(?=[A-Z])/g, 'G（ガード）')
    .replace(/\bF\s+(?=[A-Z])/g, 'F（フォワード）')
    .replace(/\bC\s+(?=[A-Z])/g, 'C（センター）')
    .replace(/\s+and\s+/gi, 'と');
  const translateSentence = raw => {
    const s = raw.trim().replace(/[.]$/, '');
    let m;
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
    if ((m = s.match(/^Signed (.+?) off waivers after getting waived by (.+)$/i))) return `${m[2]}からウェイブされた${role(m[1])}を獲得。`;
    if ((m = s.match(/^Converted the contract of (.+?) to (.+)$/i))) return `${role(m[1])}の契約を${m[2]}へ切り替え。`;
    if ((m = s.match(/^Hired (.+)$/i))) return `${m[1]}を招聘。`;
    return role(s)
      .replace(/three-team trade/gi, '3チーム間トレード')
      .replace(/four-team trade/gi, '4チーム間トレード')
      .replace(/draft considerations/gi, 'ドラフト関連の権利')
      .replace(/draft pick/gi, 'ドラフト指名権')
      .replace(/cash considerations/gi, '金銭')
      .replace(/future considerations/gi, '将来の権利') + '。';
  };
  const protectedText = description.replaceAll('L.A.', 'L§A§').replaceAll('D.C.', 'D§C§');
  return protectedText.split(/(?<=\.)\s+/).filter(Boolean).map(x => translateSentence(x.replaceAll('L§A§', 'L.A.').replaceAll('D§C§', 'D.C.'))).join(' ')
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

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const teamPayload = await get(`${ESPN}/teams?limit=100`);
  const teams = teamPayload.sports[0].leagues[0].teams.map(x => x.team).filter(x => x.isActive && !x.isAllStar);
  const season = teamPayload.sports[0].leagues[0].season?.displayName || `${new Date().getUTCFullYear() - 1}-${String(new Date().getUTCFullYear()).slice(-2)}`;
  const seasonStart = Number(season.slice(0, 4));

  const rosters = await mapLimit(teams, 6, async team => {
    const payload = await get(`${ESPN}/teams/${team.abbreviation.toLowerCase()}/roster`);
    return payload.athletes.map(a => ({
      id: a.id,
      team: team.abbreviation,
      name: a.fullName,
      jersey: a.jersey || '—',
      position: a.position?.abbreviation || '—',
      status: a.status?.name || '—',
      age: a.age ?? null,
      height: a.displayHeight || '',
      weight: a.displayWeight || '',
      salary: a.contract?.salary ?? null,
      incomingTradeValue: a.contract?.incomingTradeValue ?? null,
      outgoingTradeValue: a.contract?.outgoingTradeValue ?? null,
      yearsRemaining: a.contract?.yearsRemaining ?? null,
      tradeRestricted: Boolean(a.contract?.tradeRestriction),
      headshot: a.headshot?.href || '',
      profile: a.links?.find(l => l.rel?.includes('playercard') && l.rel?.includes('desktop'))?.href || ''
    }));
  });

  let capData = { caps: {}, thresholds: {} };
  let capWarning = null;
  try {
    capData = extractSpotrac(await get(`https://www.spotrac.com/nba/cap/_/year/${seasonStart}`, 'text'));
  } catch (e) {
    capWarning = `Spotrac取得失敗: ${e.message}`;
  }

  const thresholds = {
    salaryCap: capData.thresholds.salaryCap || ({ '2025-26': 154647000 }[season] ?? null),
    luxuryTax: capData.thresholds.luxuryTax || ({ '2025-26': 187895000 }[season] ?? null),
    firstApron: capData.thresholds.firstApron || null,
    secondApron: capData.thresholds.secondApron || null
  };
  const players = rosters.flat();
  const teamRows = teams.map(team => {
    const roster = players.filter(p => p.team === team.abbreviation);
    const reported = capData.caps[team.abbreviation];
    const rosterSalary = roster.reduce((sum, p) => sum + (p.salary || 0), 0);
    const total = reported?.totalCap || rosterSalary;
    return {
      id: team.id,
      abbreviation: team.abbreviation,
      name: team.displayName,
      logo: team.logos?.find(l => l.rel?.includes('default'))?.href || '',
      color: `#${team.color || '1d428a'}`,
      playerCount: roster.length,
      rosterSalary,
      totalCap: reported?.totalCap || null,
      activeCap: reported?.activeCap || null,
      deadCap: reported?.deadCap || null,
      capSpace: reported?.capSpace ?? null,
      apronStatus: apronStatus(total, thresholds),
      capSource: reported ? 'Spotrac' : 'ESPNロスター合計（概算）'
    };
  });

  const txFirst = await get(`${ESPN}/transactions?limit=200`);
  const transactions = (txFirst.transactions || []).map((x, i) => ({
    id: `${x.date}-${x.team?.abbreviation || 'NBA'}-${i}`,
    date: x.date,
    team: x.team?.abbreviation || 'NBA',
    teamName: x.team?.displayName || 'NBA',
    description: x.description,
    descriptionJa: translateTransaction(x.description),
    type: /trade|traded|acquired/i.test(x.description) ? 'トレード' : /signed|contract|waived|released/i.test(x.description) ? '契約・ウェイブ' : 'その他'
  }));

  const data = {
    meta: {
      updatedAt: new Date().toISOString(),
      season,
      sources: ['ESPN roster / contract / transactions API', 'Spotrac team cap tracker'],
      notes: ['サラリーはESPNのロスター契約値。チーム総額・デッドキャップ・エプロン判定はSpotrac取得成功時のみ正確なチーム配賦額を使用。', '情報提供目的です。契約判断はNBA公式発表・CBA・各チーム発表でも確認してください。'],
      warning: capWarning
    },
    thresholds,
    teams: teamRows,
    players,
    transactions
  };
  await fs.writeFile(path.join(outDir, 'nba-data.json'), JSON.stringify(data, null, 2), 'utf8');
  console.log(`更新完了: ${teamRows.length}チーム / ${players.length}選手 / ${transactions.length}件`);

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { writeNbaData } = await import('./supabase.mjs');
      await writeNbaData(data);
      console.log('Supabase: 書き込み完了');
    } catch (e) {
      console.warn('Supabase書き込みスキップ:', e.message);
    }
  }
}

main().catch(async e => {
  console.error(e);
  process.exitCode = 1;
});
