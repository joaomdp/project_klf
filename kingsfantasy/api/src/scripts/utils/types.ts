// Tipos TypeScript para o sistema Kings Lendas Fantasy

export interface Team {
  id: string;
  name: string;
  logo_url: string;  // Actual column name in database
  created_at?: string;
}

export interface Player {
  id: string;
  name: string;  // Nome do jogador
  team_id: string;
  role: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';
  price: number;
  image: string;  // Nome do arquivo de imagem
  points?: number;
  avg_points?: number;
  kda?: string;
  is_captain?: boolean;
  created_at?: string;
}

export interface Champion {
  id: string;
  key_name: string; // ID do Riot (ex: "Ahri", "LeeSin") - actual column name
  name: string; // Nome traduzido
  image_url: string;
  splash_url?: string;
  roles?: string[];
  created_at?: string;
}

export interface Round {
  id: string;
  round_number: number;
  season: number;
  status: 'pending' | 'open' | 'closed' | 'finished' | 'upcoming';
  start_date: string | null;
  end_date: string | null;
  market_close_time: string | null;  // Actual column name
  is_market_open: boolean;  // Actual column name
  created_at?: string;
  updated_at?: string;
}

export interface League {
  id: string;
  name: string;
  type: 'global' | 'team';
  team_id: string | null;
  max_participants: number;
  created_at?: string;
}

export interface SystemConfig {
  id?: string;
  key: string;
  value: string;
  description: string;
  created_at?: string;
}

export interface UserTeam {
  id: string;
  user_id: string;
  team_name: string;
  available_budget: number;
  total_points: number;
  league_id: string;
  created_at?: string;
}

export interface Match {
  id: string;
  round_id: string;
  team1_id: string;
  team2_id: string;
  winner_id: string | null;
  match_date: string | null;
  status: 'scheduled' | 'live' | 'finished';
  created_at?: string;
}

export interface PlayerPerformance {
  id: string;
  player_id: string;
  match_id: string;
  round_id: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number; // Creep Score
  champion_id: string;
  points: number;
  analyst_rating?: number | null; // 0-100 scale (Ilha das Lendas)
  created_at?: string;
}

export interface UserTeamPlayer {
  id: string;
  user_team_id: string;
  player_id: string;
  round_id: string;
  created_at?: string;
}

// Tipos auxiliares para os scripts

export interface DiagnosticResult {
  table: string;
  count: number;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  sample?: any[];
}

export interface ValidationResult {
  category: string;
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface PriceRebalanceResult {
  playerId: string;
  nickname: string;
  oldPrice: number;
  newPrice: number;
  tier: string;
}

export interface ChampionUpdateResult {
  championId: string;
  name: string;
  action: 'inserted' | 'skipped' | 'updated';
  imageUrl: string;
}

export interface ConfigUpdateResult {
  key: string;
  oldValue?: string;
  newValue: string;
  action: 'inserted' | 'updated';
}

export interface ImageUrlFixResult {
  type: 'team' | 'player';
  id: string;
  name: string;
  oldUrl: string;
  newUrl: string;
}

export interface RoundCreationResult {
  roundNumber: number;
  season: number;
  status: string;
  action: 'created' | 'skipped';
}

export interface AnalystRatingSetupResult {
  columnExists: boolean;
  constraintApplied: boolean;
  validationTests: {
    test: string;
    passed: boolean;
    message: string;
  }[];
}

// Tipo para Data Dragon API
export interface DataDragonChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];  // e.g. ["Mage", "Support"]
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DataDragonResponse {
  type: string;
  format: string;
  version: string;
  data: {
    [key: string]: DataDragonChampion;
  };
}

// Tipo para resultado de script master
export interface ScriptExecutionResult {
  scriptName: string;
  scriptNumber: number;
  success: boolean;
  duration: number; // milliseconds
  error?: string;
  summary?: string;
}
