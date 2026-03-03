// Constantes do sistema Kings Lendas Fantasy

// Supabase
export const SUPABASE_URL = 'https://xfkjdzeclvdyjxjpllbb.supabase.co';
export const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

// Storage Buckets
export const TEAMS_BUCKET = 'teams';
export const PLAYERS_BUCKET = 'players';

// Budget System (Riot Fantasy Standard)
export const INITIAL_BUDGET = 60;
export const MIN_PLAYER_PRICE = 8;
export const MAX_PLAYER_PRICE = 15;

// Player Configuration
export const TOTAL_PLAYERS = 50;
export const PLAYERS_PER_TEAM = 5;
export const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const;

// Champion Configuration
export const TOTAL_CHAMPIONS_EXPECTED = 172; // Após adicionar os 5 faltantes
export const MISSING_CHAMPIONS = ['Hwei', 'Smolder', 'Briar', 'Naafiri', 'Milio'];

// Round Configuration
export const CURRENT_SEASON = 4;
export const TOTAL_ROUNDS = 5; // 1 existente + 4 a criar
export const ROUNDS_TO_CREATE = 4;

// Team Configuration
export const MIN_TEAMS_EXPECTED = 10;  // Minimum teams needed
export const TOTAL_TEAMS = 18;  // Actual teams in database (CBLOL 2026: 10 real + 8 test/extra)

// League Configuration
export const TOTAL_LEAGUES = 11; // 1 global + 10 por time

// System Config
export const TOTAL_CONFIGS_EXPECTED = 28; // 24 existentes + 4 novos

// Riot Data Dragon
export const DDRAGON_VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
export const DDRAGON_CHAMPION_DATA_URL = (version: string) => 
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion.json`;
export const DDRAGON_CHAMPION_IMAGE_URL = (version: string, championId: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`;

// Scoring System - Analyst Rating (0-100 scale)
export const ANALYST_RATING_MIN = 0;
export const ANALYST_RATING_MAX = 100;
export const ANALYST_RATING_WEIGHT = 0.30; // 30% peso
export const OBJECTIVE_STATS_WEIGHT = 0.70; // 70% peso
export const MAX_POSSIBLE_SCORE = 100; // Para normalização

// Analyst Rating Interpretation (0-100)
export const RATING_SCALE = {
  WEAK: { min: 0, max: 40, label: 'Fraco / Abaixo da média' },
  OK: { min: 41, max: 60, label: 'Ok / Performance padrão' },
  GOOD: { min: 61, max: 80, label: 'Bom / Acima da média' },
  EXCELLENT: { min: 81, max: 100, label: 'Excelente / Destaque' },
};

// Price Distribution Tiers (após rebalanceamento 8-15)
export const PRICE_TIERS = {
  S: { min: 14.5, max: 15.0, label: 'Stars', percentile: 10 },
  A_PLUS: { min: 13.0, max: 14.4, label: 'Very Good', percentile: 20 },
  A: { min: 11.5, max: 12.9, label: 'Good', percentile: 40 },
  B: { min: 10.0, max: 11.4, label: 'Average', percentile: 70 },
  C: { min: 8.0, max: 9.9, label: 'Rookies', percentile: 100 },
};

// Timezone
export const TIMEZONE = 'America/Sao_Paulo';

// Validation Thresholds
export const MIN_VALID_LINEUPS = 1; // Pelo menos 1 lineup válida deve existir com budget 60
