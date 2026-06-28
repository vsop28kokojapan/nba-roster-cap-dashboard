import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(StealthPlugin());

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

// ── RealGM: future draft picks ─────────────────────────────────────────────

// Section heading → ESPN abbreviation
const SECTION_ABBR = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GS', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NO', 'New York Knicks': 'NY',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia Sixers': 'PHI',
  'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SA', 'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTAH',
  'Washington Wizards': 'WSH',
};

// Short team name in pick descriptions → ESPN abbreviation
const PICK_ABBR = {
  'Atlanta': 'ATL', 'Boston': 'BOS', 'Brooklyn': 'BKN', 'Charlotte': 'CHA',
  'Chicago': 'CHI', 'Cleveland': 'CLE', 'Dallas': 'DAL', 'Denver': 'DEN',
  'Detroit': 'DET', 'Golden State': 'GS', 'Houston': 'HOU', 'Indiana': 'IND',
  'L.A. Clippers': 'LAC', 'Los Angeles Clippers': 'LAC',
  'L.A. Lakers': 'LAL', 'Los Angeles Lakers': 'LAL',
  'Memphis': 'MEM', 'Miami': 'MIA', 'Milwaukee': 'MIL', 'Minnesota': 'MIN',
  'New Orleans': 'NO', 'New York': 'NY', 'Oklahoma City': 'OKC', 'Orlando': 'ORL',
  'Philadelphia': 'PHI', 'Phoenix': 'PHX', 'Portland': 'POR', 'Sacramento': 'SAC',
  'San Antonio': 'SA', 'Toronto': 'TOR', 'Utah': 'UTAH', 'Washington': 'WSH',
};

function fromAbbr(text) {
  const primary = text.split(/\s+or\s+/i)[0].trim();
  if (PICK_ABBR[primary]) return PICK_ABBR[primary];
  for (const [n, a] of Object.entries(PICK_ABBR)) {
    if (primary.startsWith(n) || n.startsWith(primary)) return a;
  }
  return primary;
}

function extractProtection(detail) {
  let m = detail.match(/protected for selections?\s+(\d+)\s*(?:through|-)\s*(\d+)/i);
  if (m) return `Top-${m[2]}プロテクト`;
  m = detail.match(/barred from selections?\s+\d+\s*(?:through|-)\s*(\d+)/i);
  if (m) return `Top-${m[1]}プロテクト`;
  m = detail.match(/protected for selection\s+1\b/i);
  if (m) return '1位プロテクト';
  return null;
}

function parsePickText(text, targetYears) {
  if (!text || /^No picks/i.test(text)) return { picks: [], gone: new Set() };
  const picks = [], gone = new Set();
  for (const entry of text.split(/\n\n+/)) {
    const lines = entry.trim().split('\n');
    const header = lines[0] || '';
    const detail = lines.slice(1).join(' ');
    const m = header.match(/^(\d{4})\s+(first|second)\s+round\s+draft\s+pick\s+(from|to)\s+(.+)/i);
    if (!m) continue;
    const year = parseInt(m[1]);
    if (!targetYears.has(year)) continue;
    const round = m[2].toLowerCase() === 'first' ? 1 : 2;
    const dir = m[3].toLowerCase(); // 'from' or 'to'
    const teamText = m[4];
    const swap = /\bswap\b/i.test(teamText) || /\bswap\b/i.test(header);
    if (dir === 'to' && !swap) { gone.add(`${year}-${round}`); continue; }
    if (dir === 'from' && !swap) {
      const tradeRef = (detail.match(/\[([^\]]+)\]/g) || []).pop()?.replace(/[\[\]]/g, '') || '';
      picks.push({ year, round, from: fromAbbr(teamText), protection: extractProtection(detail), tradeRef, rawDetail: detail });
    }
  }
  return { picks, gone };
}

async function scrapeRealGMPicks() {
  const currentYear = new Date().getFullYear();
  const targetYears = new Set([1,2,3,4,5].map(n => currentYear + n));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 }, locale: 'en-US',
    });
    const page = await ctx.newPage();

    // Establish session via homepage first, then navigate to correct URL
    console.log('RealGM: セッション確立中...');
    await page.goto('https://basketball.realgm.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    console.log('RealGM: 指名権ページ読み込み中...');
    await page.goto('https://basketball.realgm.com/nba/draft/future_drafts/detailed', {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await page.waitForTimeout(6000);

    // Extract team sections (h2/h3 heading → table with Incoming column)
    const teamData = await page.evaluate(() => {
      const result = [];
      let currentTeam = null;
      for (const el of document.querySelectorAll('h2,h3,table')) {
        if (el.tagName === 'H2' || el.tagName === 'H3') {
          currentTeam = el.textContent?.trim() || null;
        } else if (el.tagName === 'TABLE' && currentTeam) {
          const headers = Array.from(el.querySelectorAll('th')).map(h => h.textContent?.trim());
          if (headers.includes('Incoming')) {
            result.push({
              team: currentTeam,
              rows: Array.from(el.querySelectorAll('tbody tr')).map(tr => {
                const c = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
                return { year: c[0], incoming: c[1], outgoing: c[2] };
              }),
            });
            currentTeam = null;
          }
        }
      }
      return result;
    });

    if (teamData.length === 0) {
      console.warn('RealGM: データ取得失敗（ページ未ロード）');
      return null;
    }
    console.log(`RealGM: ${teamData.length} チーム取得`);

    const byTeam = {};
    for (const { team, rows } of teamData) {
      const clean = team.replace(/\s+Future Traded Pick Details\s*$/i, '').trim();
      const abbr = SECTION_ABBR[clean];
      if (!abbr) continue;

      const gone = new Set();
      const tradedIn = [];
      for (const row of rows) {
        const { picks: inPicks, gone: outGone } = parsePickText(row.incoming || '', targetYears);
        const { gone: moreGone } = parsePickText(row.outgoing || '', targetYears);
        for (const k of outGone) gone.add(k);
        for (const k of moreGone) gone.add(k);
        tradedIn.push(...inPicks);
      }

      const picks = [];
      // Own picks not traded away
      for (const year of [...targetYears].sort()) {
        for (const round of [1, 2]) {
          if (!gone.has(`${year}-${round}`)) {
            picks.push({ year, round, from: null, protection: null, trade: null });
          }
        }
      }
      // Incoming traded picks
      for (const p of tradedIn) {
        picks.push({
          year: p.year, round: p.round, from: p.from, protection: p.protection,
          trade: p.tradeRef
            ? { descriptionJa: null, descriptionEn: p.rawDetail.slice(0, 400), tradeRef: p.tradeRef }
            : null,
        });
      }
      picks.sort((a, b) => a.year - b.year || a.round - b.round);
      byTeam[abbr] = picks;
    }

    console.log(`RealGM: ${Object.keys(byTeam).length} チームの指名権取得完了`);
    return byTeam;
  } catch (e) {
    console.warn('RealGM scraping failed:', e.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ── Load existing trade details (preserve manually added trade info) ─────────

async function loadExistingPickTrades() {
  try {
    const raw = await fs.readFile(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'draft-picks.json'),
      'utf8'
    );
    const existing = JSON.parse(raw);
    // Build a map: "TEAM-YEAR-ROUND-FROM" → trade details
    const tradeMap = new Map();
    for (const [abbr, picks] of Object.entries(existing)) {
      if (abbr.startsWith('_')) continue;
      for (const pick of picks) {
        if (pick.trade) {
          const key = `${abbr}-${pick.year}-${pick.round}-${pick.from}`;
          tradeMap.set(key, pick.trade);
        }
      }
    }
    return tradeMap;
  } catch {
    return new Map();
  }
}

// ── ESPN supplemental: draft picks / awards / standings ────────────────────

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

async function fetchDraftPicks(seasonStart, teamIdToAbbr) {
  const draftYear = seasonStart + 1;
  try {
    const rounds = await get(`${ESPN_CORE}/seasons/${draftYear}/draft/rounds`);
    if (!rounds.items?.length) return {};
    const allPickRefs = [];
    for (const rnd of rounds.items) {
      for (const p of (rnd.picks ?? [])) {
        const athRef = p.athlete?.['$ref'];
        const teamId = p.team?.['$ref']?.split('/teams/')?.[1]?.split('?')?.[0] ?? '';
        if (!athRef || !teamId) continue;
        allPickRefs.push({ ref: athRef, meta: { overall: p.overall, round: p.round, pick: p.pick, traded: Boolean(p.traded), tradeNote: p.tradeNote || null }, teamId });
      }
    }
    const resolved = await mapLimit(allPickRefs, 10, async item => {
      try { const a = await get(item.ref); return { ...item, playerName: a.fullName || '—' }; }
      catch { return { ...item, playerName: '—' }; }
    });
    const result = {};
    for (const r of resolved) {
      const abbr = teamIdToAbbr.get(r.teamId);
      if (!abbr) continue;
      if (!result[abbr]) result[abbr] = [];
      result[abbr].push({ playerName: r.playerName, ...r.meta });
    }
    return result;
  } catch { return {}; }
}

const AWARD_KEY_MAP = {
  'MVP': 'mvp', 'Defensive Player of the Year': 'dpoy', 'Rookie of the Year': 'roy',
  'Most Improved Player': 'mip', 'Sixth Man of the Year': 'sixthMan', 'Finals MVP': 'finalsMvp',
  'NBA Cup MVP': 'nbaCupMvp', 'Clutch Player of the Year': 'clutchPlayer',
  'All-NBA 1st Team': 'allNba1', 'All-NBA 2nd Team': 'allNba2', 'All-NBA 3rd Team': 'allNba3',
  'All-Defensive 1st Team': 'allDefense1', 'All-Defensive 2nd Team': 'allDefense2',
  'All-Rookie 1st Team': 'allRookie1',
};
const ARRAY_AWARD_KEYS = new Set(['allNba1','allNba2','allNba3','allDefense1','allDefense2','allRookie1']);

async function fetchSeasonAwards(year) {
  const season = `${year - 1}-${String(year).slice(-2)}`;
  const result = { season, allNba1: [], allNba2: [], allNba3: [], allDefense1: [], allDefense2: [], allRookie1: [] };
  try {
    const awardsData = await get(`${ESPN_CORE}/seasons/${year}/awards?limit=50`);
    const awardRefs = (awardsData.items ?? []).map(i => i['$ref']).filter(Boolean);
    const details = await mapLimit(awardRefs, 8, async ref => {
      try {
        const award = await get(ref);
        const winnerRefs = (award.winners ?? []).map(w => w.athlete?.['$ref']).filter(Boolean);
        const winners = await mapLimit(winnerRefs, 5, async athRef => {
          const id = athRef.match(/athletes\/(\d+)/)?.[1] ?? '';
          try { const a = await get(athRef); return { athleteId: id, athleteName: a.fullName || '—' }; }
          catch { return { athleteId: id, athleteName: '—' }; }
        });
        return { name: String(award.name ?? ''), winners };
      } catch { return null; }
    });
    for (const d of details) {
      if (!d) continue;
      const key = AWARD_KEY_MAP[d.name];
      if (!key) continue;
      if (ARRAY_AWARD_KEYS.has(key)) result[key] = d.winners;
      else result[key] = d.winners[0];
    }
  } catch { /* awards unavailable */ }
  return result;
}

async function fetchSeasonStandings(year) {
  const season = `${year - 1}-${String(year).slice(-2)}`;
  try {
    const data = await get(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${year}`);
    const parseConf = conf => {
      const entries = conf.standings?.entries ?? [];
      return entries.map(e => {
        const team = e.team ?? {};
        const statsNum = {};
        for (const s of (e.stats ?? [])) if (s.name && s.value !== undefined) statsNum[s.name] = s.value;
        const logos = team.logos ?? [];
        return {
          rank: Math.round(statsNum.playoffSeed ?? 99),
          abbr: String(team.abbreviation ?? ''),
          name: String(team.displayName ?? ''),
          wins: Math.round(statsNum.wins ?? 0),
          losses: Math.round(statsNum.losses ?? 0),
          logo: logos.find(l => l.rel?.includes('default'))?.href ?? '',
        };
      }).sort((a, b) => a.rank - b.rank);
    };
    const [east, west] = data.children ?? [];
    return { season, east: east ? parseConf(east) : [], west: west ? parseConf(west) : [] };
  } catch { return { season, east: [], west: [] }; }
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

  // ── RealGM future picks ──
  let futurePicks = null;
  try {
    const [scraped, tradeMap] = await Promise.all([
      scrapeRealGMPicks(),
      loadExistingPickTrades(),
    ]);
    if (scraped) {
      // Restore manually entered trade details
      for (const [abbr, picks] of Object.entries(scraped)) {
        for (const pick of picks) {
          const key = `${abbr}-${pick.year}-${pick.round}-${pick.from}`;
          if (tradeMap.has(key)) pick.trade = tradeMap.get(key);
        }
      }
      futurePicks = scraped;
      // Also write to public/draft-picks.json for local fallback
      const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'draft-picks.json');
      await fs.writeFile(outPath, JSON.stringify({ _meta: { updatedAt: new Date().toISOString() }, ...scraped }, null, 2), 'utf8');
      console.log('draft-picks.json 更新完了');
    }
  } catch (e) {
    console.warn('指名権スクレイピングスキップ:', e.message);
  }

  const espnYear = seasonStart + 1;
  const teamIdToAbbr = new Map(teams.map(t => [String(t.id), t.abbreviation]));

  const [txFirst, draftPicks, awardsArr, standingsArr] = await Promise.all([
    get(`${ESPN}/transactions?limit=200`),
    fetchDraftPicks(seasonStart, teamIdToAbbr),
    Promise.all([espnYear, espnYear - 1, espnYear - 2].map(y => fetchSeasonAwards(y).catch(() => null))),
    Promise.all([espnYear, espnYear - 1, espnYear - 2].map(y => fetchSeasonStandings(y).catch(() => null))),
  ]);
  const awards = awardsArr.filter(a => a !== null);
  const standings = standingsArr.filter(s => s !== null);

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
      sources: ['ESPN roster / contract / transactions API', 'Spotrac team cap tracker', ...(futurePicks ? ['RealGM future draft picks'] : [])],
      notes: ['サラリーはESPNのロスター契約値。チーム総額・デッドキャップ・エプロン判定はSpotrac取得成功時のみ正確なチーム配賦額を使用。', '情報提供目的です。契約判断はNBA公式発表・CBA・各チーム発表でも確認してください。'],
      warning: capWarning
    },
    thresholds,
    teams: teamRows,
    players,
    transactions,
    draftPicks,
    awards,
    standings,
    futurePicks: futurePicks ?? null,
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
