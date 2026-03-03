
export enum Role {
  TOP = 'TOP',
  JNG = 'JUNGLE',
  MID = 'MID',
  ADC = 'ADC',
  SUP = 'SUPPORT'
}

export interface Champion {
  name: string;
  image: string;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: string;
  teamLogo: string;
  price: number;
  points: number;
  avgPoints: number;
  kda: string;
  image: string;
  lastChampion?: Champion;
  selectedChampion?: Champion;
}

export interface UserShield {
  shape: string;
  color: string;
  symbol: string;
}

export interface UserPreferences {
  publicProfile: boolean;
  marketNotifications: boolean;
  compactMode: boolean;
}

export interface UserTeam {
  id: string;
  userId: string;
  userName: string;
  name: string;
  avatar: string;
  level: number;
  honor: number;
  favoriteTeam?: string;
  shield?: UserShield;
  players: {
    [key in Role]?: Player;
  };
  budget: number;
  totalPoints: number;
  preferences?: UserPreferences;
}

export interface RankingEntry {
  rank: number;
  userName: string;
  teamName: string;
  points: number;
  trend: 'up' | 'down' | 'stable';
  avatar?: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  icon: string;
  isPublic: boolean;
  isVerified: boolean;
  createdBy?: string;
  memberCount?: number;
  logoUrl?: string;
  createdAt?: string;
}

export interface LeagueMember {
  id: string;
  leagueId: string;
  userId: string;
  joinedAt: string;
}

export type Page = 'dashboard' | 'market' | 'squad' | 'ranking' | 'ai-coach' | 'profile' | 'admin';
