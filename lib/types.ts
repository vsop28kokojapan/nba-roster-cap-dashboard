export type ContractType = '2-way' | '10-day' | 'exhibit-10' | 'standard' | null;

export interface Thresholds {
  salaryCap: number;
  luxuryTax: number;
  firstApron: number;
  secondApron: number;
}

export interface Team {
  id: string;
  abbreviation: string;
  name: string;
  logo: string;
  color: string;
  playerCount: number;
  rosterSalary: number;
  totalCap: number | null;
  activeCap: number | null;
  deadCap: number | null;
  capSpace: number | null;
  apronStatus: string;
  capSource: string;
  coach: string | null;
}

export interface Player {
  id: string;
  team: string;
  name: string;
  jersey: string;
  position: string;
  status: string;
  age: number | null;
  height: string;
  weight: string;
  salary: number | null;
  incomingTradeValue: number | null;
  outgoingTradeValue: number | null;
  yearsRemaining: number | null;
  tradeRestricted: boolean;
  headshot: string;
  profile: string;
  contractType: ContractType;
  yearsWithTeam: number | null;
  teamJoinedSeason: string | null;
  contractYears?: { year: number; salary: number }[];
}

export interface Transaction {
  id: string;
  date: string;
  team: string;
  teamName: string;
  description: string;
  descriptionJa: string;
  type: string;
}

export interface AwardEntry {
  athleteId: string;
  athleteName: string;
}

export interface SeasonAwards {
  season: string;
  mvp?: AwardEntry;
  dpoy?: AwardEntry;
  roy?: AwardEntry;
  mip?: AwardEntry;
  sixthMan?: AwardEntry;
  finalsMvp?: AwardEntry;
  nbaCupMvp?: AwardEntry;
  clutchPlayer?: AwardEntry;
  allNba1: AwardEntry[];
  allNba2: AwardEntry[];
  allNba3: AwardEntry[];
  allDefense1: AwardEntry[];
  allDefense2: AwardEntry[];
  allRookie1: AwardEntry[];
}

export interface StandingEntry {
  rank: number;
  abbr: string;
  name: string;
  wins: number;
  losses: number;
  logo: string;
}

export interface SeasonStandings {
  season: string;
  east: StandingEntry[];
  west: StandingEntry[];
}

export interface DraftPickEntry {
  overall: number;
  round: number;
  pick: number;
  playerName: string;
  traded: boolean;
  tradeNote: string | null;
}

export interface NBAData {
  meta: {
    updatedAt: string;
    season: string;
    sources: string[];
    notes: string[];
    warning: string | null;
  };
  thresholds: Thresholds;
  teams: Team[];
  players: Player[];
  transactions: Transaction[];
  draftPicks: Record<string, DraftPickEntry[]>;
  awards: SeasonAwards[];
  standings: SeasonStandings[];
  futurePicks?: Record<string, FuturePickAsset[]> | null;
}

// ── 履歴データ型 ──────────────────────────────────────────────

export interface HistoricalTeam {
  abbreviation: string;
  name: string;
  logo: string;
  color: string;
  playerCount: number;
  rosterSalary: number;
  totalCap: number | null;
  activeCap: number | null;
  deadCap: number | null;
  capSpace: number | null;
  apronStatus: string;
  capSource: string;
  coach: string | null;
}

export interface HistoricalPlayer {
  id: string;
  team: string;
  name: string;
  position: string;
  salary: number | null;
  yearsRemaining: number | null;
  contractType: ContractType;
}

export interface FuturePickAsset {
  year: number;
  round: number;
  from: string | null;
  protection: string | null;
  trade: {
    descriptionEn?: string;
    descriptionJa?: string | null;
    tradeRef?: string;
    date?: string;
    teams?: string[];
    espnUrl?: string;
  } | null;
}

export interface HistoricalSnapshot {
  season: string;
  fetchedAt: string;
  thresholds: {
    salaryCap: number | null;
    luxuryTax: number | null;
    firstApron: number | null;
    secondApron: number | null;
  };
  teams: HistoricalTeam[];
  players: HistoricalPlayer[];
}
