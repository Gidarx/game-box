export type GameMode = 'solo' | 'equipes';

export type GamePhase =
  | 'lobby'
  | 'trivia_all'
  | 'box_select'
  | 'ranking_challenge'
  | 'card_open'
  | 'duel'
  | 'reveal'
  | 'wildcard'
  | 'game_over';

export type BoxRarity = 'comum' | 'raro' | 'lendario';
export type BoxRisk = 'baixo' | 'medio' | 'alto';
export type BoxType = 'viagem' | 'tech' | 'experiencia' | 'meme' | 'pegadinha' | 'misterio';
export type WildcardType = 'FREEZE' | 'STEAL' | 'SHIELD' | 'SWAP';

export interface Player {
  id: string;
  name: string;
  teamId: string | null;
  socketId: string;
  isReady: boolean;
  isConnected: boolean;
  isBot?: boolean;
  score: number;
  device?: string;
}

export interface InventoryItem {
  boxId: number;
  prizeLabel: string;
  points: number;
  rarity: BoxRarity;
  shielded: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
  score: number;
  inventory: InventoryItem[];
  wildcards: WildcardType[];
  shields: number;
  frozenUntilRound: number | null;
  stealUsed: boolean;
}

export interface Box {
  id: number;
  prizeLabel: string;
  points: number;
  rarity: BoxRarity;
  risk: BoxRisk;
  type: BoxType;
  icon: string;
  isOpen: boolean;
  openedByTeamId?: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  timeLimit: number;
}

export interface RankingChallenge {
  question: string;
  items: string[];
  correctOrder: number[];
}

export interface WildcardCard {
  type: WildcardType;
  name: string;
  description: string;
  icon: string;
}

export interface ScoringSettings {
  triviaWinPoints: number;
  duelWinPoints: number;
}

export interface PublicMetrics {
  startedAt: number;
  triviaRoundsResolved: number;
  duelRoundsResolved: number;
  avgRoundDurationMs: number;
  triviaAccuracyRate: number;
  totalTriviaPointsAwarded: number;
  totalDuelPointsAwarded: number;
  cardTypeCount: Record<string, number>;
  deadliestCards: Array<{ word: string; impact: number }>;
  teamWinRates: Record<string, {
    triviaWins: number;
    duelWins: number;
    totalWins: number;
    winRate: number;
    teamName: string;
  }>;
  duelStats: {
    total: number;
    wins: number;
    noWinner: number;
    chooserTimeouts: number;
    resolvedByTimeout: number;
  };
  scoringAdjustments: Array<{
    at: number;
    previous: number;
    next: number;
    reason: string;
  }>;
}

export interface GameState {
  roomCode: string;
  hostSocketId: string | null;
  mode: GameMode;
  phase: GamePhase;
  round: number;
  maxRounds: number;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  boxes: Box[];
  boxCount: number;
  currentQuestion: Question | null;
  currentRanking: RankingChallenge | null;
  triviaWinnerId: string | null;
  attackerTeamId: string | null;
  selectedBoxId: number | null;
  lastRevealedBoxId: number | null;
  cardGrid: Array<{ id: number; status: 'hidden' | 'revealed' | 'locked'; word: string | null; type: string | null }>;
  lockedKeys: number;
  chances: number;
  maxChances: number;
  scoring: ScoringSettings;
  autoBalanceScoring: boolean;
  questionCategories: string[];
  currentWildcard: WildcardCard | null;
  timerEndAt: number | null;
  duelOpponentId: string | null;
  duelSelectEndAt: number | null;
  boxesOpened: number;
  metrics: PublicMetrics;
  answeredCount: number;
  eligibleCount: number;
}

export interface RoomSettings {
  mode: GameMode;
  boxCount: number;
  maxRounds: number;
  questionCategories?: string[];
  autoBalanceScoring?: boolean;
  scoring?: ScoringSettings;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'solo',
  boxCount: 13,
  maxRounds: 30,
  questionCategories: ['all'],
  autoBalanceScoring: true,
  scoring: {
    triviaWinPoints: 10,
    duelWinPoints: 120,
  },
};
