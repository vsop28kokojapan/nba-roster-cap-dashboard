import type { NBAData, ContractType, HistoricalSnapshot, HistoricalPlayer, HistoricalTeam, SeasonAwards, AwardEntry, SeasonStandings, StandingEntry } from './types';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// 2-way contract fixed salaries by season start year (e.g. 2024 → 2024-25)
const TWO_WAY_SALARIES: Record<number, number> = {
  2025: 576152,
  2024: 568422,
  2023: 556688,
  2022: 508891,
  2021: 462629,
  2020: 449115,
  2019: 435093,
  2018: 421632,
  2017: 204349,
};

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

// ESPNロスターAPIは直接配列 or ポジション別グループ({position,items})の2形式がある
function flattenAthletes(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0] as Record<string, unknown>;
  if (Array.isArray(first.items)) {
    return raw.flatMap(g => {
      const grp = g as Record<string, unknown>;
      return Array.isArray(grp.items) ? (grp.items as Record<string, unknown>[]) : [];
    });
  }
  return raw as Record<string, unknown>[];
}

function extractCoach(payload: Record<string, unknown>): string | null {
  const arr = payload.coach as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const head = arr.find(c => (c.specialties as string[] | undefined)?.includes('head')) ?? arr[0];
  const name = `${head.firstName ?? ''} ${head.lastName ?? ''}`.trim();
  return name || null;
}

function detectContractType(
  espnType: unknown,
  salary: number | null,
  seasonStart: number
): ContractType {
  const ct = String(espnType ?? '').toLowerCase();
  // ESPN API integer or string clues
  if (ct === '3' || ct.includes('two') || ct.includes('2way') || ct.includes('twoway')) return '2-way';
  if (ct === '4' || ct.includes('10day') || ct.includes('tenday')) return '10-day';
  if (ct.includes('exhibit')) return 'exhibit-10';
  // Salary-based 2-way detection (±$60K of the fixed 2-way salary for this season)
  const twoWay = TWO_WAY_SALARIES[seasonStart];
  if (salary != null && twoWay && Math.abs(salary - twoWay) < 60000) return '2-way';
  return null;
}

function parseTxDate(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  } catch { /* fall through */ }
  if (/^\d{8}$/.test(dateStr)) {
    return { year: parseInt(dateStr.slice(0, 4)), month: parseInt(dateStr.slice(4, 6)) };
  }
  return null;
}

type TxEntry = { date: string; team: string; description: string };

function computeTenure(
  players: Array<{ id: string; name: string; team: string }>,
  transactions: TxEntry[],
  currentSeasonStart: number
): Map<string, { years: number; joinedSeason: string }> {
  const result = new Map<string, { years: number; joinedSeason: string }>();
  // oldest → newest
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const player of players) {
    const parts = player.name.split(' ');
    const lastName = parts[parts.length - 1].toLowerCase();
    if (!lastName || lastName.length < 2) continue;

    // Find transactions where this player arrived at their current team
    const arrivals = sorted.filter(tx => {
      if (tx.team !== player.team) return false;
      const desc = tx.description.toLowerCase();
      if (!desc.includes(lastName)) return false;
      // Must be an arrival event, not a departure
      return /sign|acqui|draft/.test(desc) && !/waiv|releas/.test(desc);
    });

    if (arrivals.length === 0) continue;

    // Most recent arrival = when they (re-)joined
    const latest = arrivals[arrivals.length - 1];
    const parsed = parseTxDate(latest.date);
    if (!parsed) continue;

    const { year, month } = parsed;
    // Off-season (Jul-Sep): transaction belongs to the upcoming season
    // In-season (Oct-Jun): transaction belongs to the current season (started prior Oct)
    const joinSeasonStart = month >= 7 ? year : year - 1;
    const years = Math.max(1, currentSeasonStart - joinSeasonStart + 1);
    const joinedSeason = `${joinSeasonStart}-${String(joinSeasonStart + 1).slice(-2)}`;
    result.set(player.id, { years, joinedSeason });
  }
  return result;
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

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

async function fetchDraftPicks(
  seasonStart: number,
  teamIdToAbbr: Map<string, string>
): Promise<Record<string, import('./types').DraftPickEntry[]>> {
  const draftYear = seasonStart + 1; // 2025-26 season → 2026 draft
  try {
    const rounds = await get(`${ESPN_CORE}/seasons/${draftYear}/draft/rounds`);
    if (!rounds.items?.length) return {};

    const allPickRefs: { ref: string; meta: Omit<import('./types').DraftPickEntry, 'playerName'>; teamId: string }[] = [];
    for (const rnd of rounds.items as Record<string, unknown>[]) {
      const picks = (rnd.picks as Record<string, unknown>[]) ?? [];
      for (const p of picks) {
        const athRef = (p.athlete as Record<string, string> | undefined)?.['$ref'];
        const teamRef = (p.team as Record<string, string> | undefined)?.['$ref'];
        const teamId = teamRef?.split('/teams/')?.[1]?.split('?')?.[0] ?? '';
        if (!athRef || !teamId) continue;
        allPickRefs.push({
          ref: athRef,
          meta: {
            overall: p.overall as number,
            round: p.round as number,
            pick: p.pick as number,
            traded: Boolean(p.traded),
            tradeNote: (p.tradeNote as string) || null,
          },
          teamId,
        });
      }
    }

    const resolved = await mapLimit(allPickRefs, 10, async item => {
      try {
        const ath = await get(item.ref);
        return { ...item, playerName: (ath.fullName as string) || '—' };
      } catch {
        return { ...item, playerName: '—' };
      }
    });

    const result: Record<string, import('./types').DraftPickEntry[]> = {};
    for (const r of resolved) {
      const abbr = teamIdToAbbr.get(r.teamId);
      if (!abbr) continue;
      if (!result[abbr]) result[abbr] = [];
      result[abbr].push({ playerName: r.playerName, ...r.meta });
    }
    return result;
  } catch {
    return {};
  }
}

const AWARD_KEY_MAP: Record<string, string> = {
  'MVP': 'mvp',
  'Defensive Player of the Year': 'dpoy',
  'Rookie of the Year': 'roy',
  'Most Improved Player': 'mip',
  'Sixth Man of the Year': 'sixthMan',
  'Finals MVP': 'finalsMvp',
  'NBA Cup MVP': 'nbaCupMvp',
  'Clutch Player of the Year': 'clutchPlayer',
  'All-NBA 1st Team': 'allNba1',
  'All-NBA 2nd Team': 'allNba2',
  'All-NBA 3rd Team': 'allNba3',
  'All-Defensive 1st Team': 'allDefense1',
  'All-Defensive 2nd Team': 'allDefense2',
  'All-Rookie 1st Team': 'allRookie1',
};
const ARRAY_AWARD_KEYS = new Set(['allNba1','allNba2','allNba3','allDefense1','allDefense2','allRookie1']);

async function fetchSeasonAwards(year: number): Promise<SeasonAwards> {
  const season = `${year - 1}-${String(year).slice(-2)}`;
  const result: SeasonAwards = { season, allNba1: [], allNba2: [], allNba3: [], allDefense1: [], allDefense2: [], allRookie1: [] };
  try {
    const awardsData = await get(`${ESPN_CORE}/seasons/${year}/awards?limit=50`);
    const awardRefs = ((awardsData.items as Record<string, string>[] | undefined) ?? []).map(i => i['$ref']).filter(Boolean);

    const details = await mapLimit(awardRefs, 8, async (ref: string) => {
      try {
        const award = await get(ref) as Record<string, unknown>;
        const winnerRefs = ((award.winners as Array<{ athlete?: { '$ref': string } }>) ?? [])
          .map(w => w.athlete?.['$ref'])
          .filter((r): r is string => Boolean(r));
        const winners = await mapLimit(winnerRefs, 5, async (athRef: string) => {
          const id = athRef.match(/athletes\/(\d+)/)?.[1] ?? '';
          try {
            const ath = await get(athRef) as Record<string, unknown>;
            return { athleteId: id, athleteName: String(ath.fullName ?? '—') } as AwardEntry;
          } catch {
            return { athleteId: id, athleteName: '—' } as AwardEntry;
          }
        });
        return { name: String(award.name ?? ''), winners };
      } catch { return null; }
    });

    for (const d of details) {
      if (!d) continue;
      const key = AWARD_KEY_MAP[d.name];
      if (!key) continue;
      if (ARRAY_AWARD_KEYS.has(key)) {
        (result as unknown as Record<string, AwardEntry[]>)[key] = d.winners;
      } else {
        (result as unknown as Record<string, AwardEntry | undefined>)[key] = d.winners[0];
      }
    }
  } catch { /* awards unavailable */ }
  return result;
}

async function fetchSeasonStandings(year: number): Promise<SeasonStandings> {
  const season = `${year - 1}-${String(year).slice(-2)}`;
  try {
    const data = await get(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${year}`);
    const parseConf = (conf: Record<string, unknown>): StandingEntry[] => {
      const entries = ((conf.standings as Record<string, unknown>)?.entries as Record<string, unknown>[]) ?? [];
      const parsed = entries.map((e) => {
        const team = e.team as Record<string, unknown>;
        const statsArr = (e.stats as Array<{ name: string; value?: number; displayValue?: string }>) ?? [];
        const statsNum: Record<string, number> = {};
        const statsStr: Record<string, string> = {};
        for (const s of statsArr) {
          if (s.name && s.value !== undefined) statsNum[s.name] = s.value;
          if (s.name && s.displayValue !== undefined) statsStr[s.name] = s.displayValue;
        }
        const logos = team.logos as Array<{ rel?: string[]; href: string }> | undefined;
        return {
          rank: Math.round(statsNum.playoffSeed ?? 99),
          abbr: String(team.abbreviation ?? ''),
          name: String(team.displayName ?? ''),
          wins: Math.round(statsNum.wins ?? 0),
          losses: Math.round(statsNum.losses ?? 0),
          logo: logos?.find(l => l.rel?.includes('default'))?.href ?? '',
        };
      });
      return parsed.sort((a, b) => a.rank - b.rank);
    };
    const [east, west] = (data.children as Record<string, unknown>[]) ?? [];
    return { season, east: east ? parseConf(east) : [], west: west ? parseConf(west) : [] };
  } catch {
    return { season, east: [], west: [] };
  }
}

// ── 現行シーズンデータ取得 ─────────────────────────────────────

export async function fetchNbaData(): Promise<NBAData> {
  const teamPayload = await get(`${ESPN}/teams?limit=100`);
  const teams = teamPayload.sports[0].leagues[0].teams
    .map((x: { team: unknown }) => x.team as Record<string, unknown>)
    .filter((x: Record<string, unknown>) => x.isActive && !x.isAllStar);
  const season: string =
    teamPayload.sports[0].leagues[0].season?.displayName ||
    `${new Date().getUTCFullYear() - 1}-${String(new Date().getUTCFullYear()).slice(-2)}`;
  const seasonStart = Number(season.slice(0, 4));

  const rosterPayloads = new Map<string, Record<string, unknown>>();
  const rosters = await mapLimit(teams, 6, async (team: Record<string, unknown>) => {
    const abbr = (team.abbreviation as string).toLowerCase();
    const payload = await get(`${ESPN}/teams/${abbr}/roster`);
    rosterPayloads.set(team.abbreviation as string, payload);
    return flattenAthletes(payload.athletes).map(a => {
      // ESPN roster API returns `contracts` (array), not singular `contract`
      const contractsArr = (a.contracts as Array<{ salary: number; season: { year: number } }>) ?? [];
      const sortedContracts = [...contractsArr].sort((x, y) => x.season.year - y.season.year);
      // Current season contract = the entry matching espnYear; fallback to latest
      const currentEntry = sortedContracts.find(c => c.season?.year === espnYear)
        ?? sortedContracts.filter(c => c.salary > 0).at(-1);
      const salary = currentEntry?.salary ?? null;
      // Future years (current season onward, salary > 0)
      const contractYears = sortedContracts
        .filter(c => c.season?.year >= espnYear && c.salary > 0)
        .map(c => ({ year: c.season.year, salary: c.salary }));
      const yearsRemaining = Math.max(0, contractYears.length - 1);
      const espnType = null; // not available in contracts array format
      return {
        id: a.id as string,
        team: team.abbreviation as string,
        name: a.fullName as string,
        jersey: (a.jersey as string) || '—',
        position: ((a.position as Record<string, string> | undefined)?.abbreviation) || '—',
        status: ((a.status as Record<string, string> | undefined)?.name) || '—',
        age: (a.age as number | null) ?? null,
        height: (a.displayHeight as string) || '',
        weight: (a.displayWeight as string) || '',
        salary,
        incomingTradeValue: null,
        outgoingTradeValue: null,
        yearsRemaining,
        tradeRestricted: false,
        headshot: ((a.headshot as Record<string, string> | undefined)?.href) || '',
        profile:
          ((a.links as Array<{ rel?: string[]; href: string }> | undefined)
            ?.find(l => l.rel?.includes('playercard') && l.rel?.includes('desktop'))
            ?.href) || '',
        contractType: detectContractType(espnType, salary, seasonStart),
        contractYears,
        yearsWithTeam: null as number | null,
        teamJoinedSeason: null as string | null,
      };
    });
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
    salaryCap: capData.thresholds.salaryCap || ({ 2025: 154647000 } as Record<number, number>)[seasonStart] || null,
    luxuryTax: capData.thresholds.luxuryTax || null,
    firstApron: capData.thresholds.firstApron || null,
    secondApron: capData.thresholds.secondApron || null,
  };

  // Fetch current + past 4 seasons of transactions for tenure calculation (5 parallel calls)
  const [currentTxPayload, ...pastTxArrays] = await Promise.all([
    get(`${ESPN}/transactions?limit=200`),
    ...[1, 2, 3, 4].map(offset =>
      get(`${ESPN}/transactions?limit=200&season=${seasonStart - offset}`)
        .then(d => (d.transactions || []) as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[])
    ),
  ]);
  const currentTxRaw = (currentTxPayload.transactions || []) as Record<string, unknown>[];

  const allTxEntries: TxEntry[] = [...currentTxRaw, ...pastTxArrays.flat()].map(x => ({
    date: String(x.date ?? ''),
    team: (x.team as Record<string, string> | undefined)?.abbreviation ?? '',
    description: String(x.description ?? ''),
  }));

  // Apply tenure to each player
  const players = rosters.flat();
  const tenureMap = computeTenure(players, allTxEntries, seasonStart);
  for (const p of players) {
    const t = tenureMap.get(p.id);
    if (t) { p.yearsWithTeam = t.years; p.teamJoinedSeason = t.joinedSeason; }
  }

  const teamRows = teams.map((team: Record<string, unknown>) => {
    const abbr = team.abbreviation as string;
    const roster = players.filter(p => p.team === abbr);
    const reported = capData.caps[abbr];
    const rosterSalary = roster.reduce((sum, p) => sum + (p.salary || 0), 0);
    const total = reported?.totalCap || rosterSalary;
    const logos = team.logos as Array<{ rel?: string[]; href: string }> | undefined;
    const rosterPayload = rosterPayloads.get(abbr) ?? {};
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
      coach: extractCoach(rosterPayload),
    };
  });

  const transactions = currentTxRaw.map((x, i) => ({
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

  // ESPN internal team ID → abbreviation map (for draft picks resolution)
  const teamIdToAbbr = new Map<string, string>(
    teams.map((t: Record<string, unknown>) => [String(t.id), t.abbreviation as string])
  );

  // Fetch draft picks, awards (3 seasons), and standings (3 seasons) in parallel
  const espnYear = seasonStart + 1; // e.g. 2025-26 → year 2026
  const [draftPicks, awardsArr, standingsArr] = await Promise.all([
    fetchDraftPicks(seasonStart, teamIdToAbbr),
    Promise.all([espnYear, espnYear - 1, espnYear - 2].map(y => fetchSeasonAwards(y).catch(() => null))),
    Promise.all([espnYear, espnYear - 1, espnYear - 2].map(y => fetchSeasonStandings(y).catch(() => null))),
  ]);
  const awards = awardsArr.filter((a): a is SeasonAwards => a !== null);
  const standings = standingsArr.filter((s): s is SeasonStandings => s !== null);

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
    draftPicks,
    awards,
    standings,
  };
}

// ── 過去シーズンデータ取得 ─────────────────────────────────────

export async function fetchHistoricalSeason(year: number): Promise<HistoricalSnapshot> {
  const season = `${year}-${String(year + 1).slice(-2)}`;

  const teamPayload = await get(`${ESPN}/teams?limit=100&season=${year}`);
  const teams = teamPayload.sports[0].leagues[0].teams
    .map((x: { team: unknown }) => x.team as Record<string, unknown>)
    .filter((x: Record<string, unknown>) => x.isActive && !x.isAllStar);

  // ESPNの過去シーズンはstart-year / end-year 両方試す。直接配列とポジション別グループ両対応。
  const espnYears = [year, year + 1];
  const histRosterPayloads = new Map<string, Record<string, unknown>>();

  const rosters = await mapLimit(teams, 6, async (team: Record<string, unknown>) => {
    const abbr = (team.abbreviation as string).toLowerCase();
    try {
      let bestPayload: Record<string, unknown> = {};
      let athletes: Record<string, unknown>[] = [];
      for (const ey of espnYears) {
        const payload = await get(`${ESPN}/teams/${abbr}/roster?season=${ey}`).catch(() => ({})) as Record<string, unknown>;
        const flat = flattenAthletes(payload.athletes);
        if (flat.length > 0) {
          athletes = flat;
          bestPayload = payload;
          break;
        }
        // keep first payload for coach extraction even if no athletes
        if (!Object.keys(bestPayload).length) bestPayload = payload;
      }
      histRosterPayloads.set(team.abbreviation as string, bestPayload);
      return athletes.map(a => {
        const contract = a.contract as Record<string, unknown> | undefined;
        const salary = (contract?.salary as number | null) ?? null;
        return {
          id: String(a.id),
          team: team.abbreviation as string,
          name: String(a.fullName ?? ''),
          position: ((a.position as Record<string, string> | undefined)?.abbreviation) || '—',
          salary,
          yearsRemaining: (contract?.yearsRemaining as number | null) ?? null,
          contractType: detectContractType(contract?.contractType ?? contract?.type, salary, year),
        } as HistoricalPlayer;
      });
    } catch {
      return [] as HistoricalPlayer[];
    }
  });

  let capData: ReturnType<typeof extractSpotrac> = { caps: {}, thresholds: { salaryCap: null, luxuryTax: null, firstApron: null, secondApron: null } };
  try {
    capData = extractSpotrac(
      await get(`https://www.spotrac.com/nba/cap/_/year/${year}`, 'text')
    );
  } catch { /* Spotrac historical might be unavailable */ }

  const thresholdsHist = {
    salaryCap: capData.thresholds.salaryCap || null,
    luxuryTax: capData.thresholds.luxuryTax || null,
    firstApron: capData.thresholds.firstApron || null,
    secondApron: capData.thresholds.secondApron || null,
  };

  const players = rosters.flat();
  const histTeams: HistoricalTeam[] = teams.map((team: Record<string, unknown>) => {
    const abbr = team.abbreviation as string;
    const roster = players.filter(p => p.team === abbr);
    const reported = capData.caps[abbr];
    const rosterSalary = roster.reduce((sum, p) => sum + (p.salary || 0), 0);
    const total = reported?.totalCap || rosterSalary;
    const logos = team.logos as Array<{ rel?: string[]; href: string }> | undefined;
    const rp = histRosterPayloads.get(abbr) ?? {};
    return {
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
      apronStatus: apronStatus(total, thresholdsHist),
      capSource: reported ? 'Spotrac' : 'ESPNロスター合計（概算）',
      coach: extractCoach(rp),
    };
  });

  return {
    season,
    fetchedAt: new Date().toISOString(),
    thresholds: thresholdsHist,
    teams: histTeams,
    players,
  };
}
