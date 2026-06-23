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
}
