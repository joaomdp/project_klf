import { supabase } from '../config/supabase';

/**
 * MAPPER SERVICE
 * 
 * Responsável por mapear dados do Leaguepedia para IDs do banco de dados
 * Mantém caches em memória para performance
 */

interface PlayerPerformanceInput {
  match_id: number;
  player_id: string;
  champion_id: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold_earned: number;
  damage_dealt: number;
  wards_placed: number;
  first_blood: boolean;
  triple_kill: boolean;
  quadra_kill: boolean;
  penta_kill: boolean;
  is_winner: boolean;
}

class MapperService {
  // Caches de mapeamento (nome → id)
  private playerNameToId: Map<string, string> = new Map();
  private championNameToId: Map<string, number> = new Map();
  private teamNameToId: Map<string, string> = new Map();
  
  // Flag para saber se caches foram inicializados
  private initialized = false;
  
  /**
   * Inicializar todos os caches de mapeamento
   */
  async initializeCaches(): Promise<void> {
    if (this.initialized) {
      console.log('ℹ️  Caches já inicializados');
      return;
    }
    
    console.log('🔄 Inicializando caches de mapeamento...');
    
    try {
      // Cache de jogadores - use player_mappings for Leaguepedia name resolution
      const { data: playerMappings, error: mappingsError } = await supabase
        .from('player_mappings')
        .select(`
          leaguepedia_name,
          player_id,
          season,
          is_active
        `)
        .eq('is_active', true);
      
      if (mappingsError) {
        console.warn('⚠️  player_mappings table not found, falling back to direct name matching');
      } else {
        // Add mappings from player_mappings table
        playerMappings?.forEach(pm => {
          this.playerNameToId.set(this.normalize(pm.leaguepedia_name), pm.player_id);
        });
      }
      
      // Also load players directly for backwards compatibility
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name');
      
      if (playersError) throw playersError;
      
      players?.forEach(p => {
        // Only add if not already mapped via player_mappings
        const normalized = this.normalize(p.name);
        if (!this.playerNameToId.has(normalized)) {
          this.playerNameToId.set(normalized, p.id);
        }
      });
      
      // Cache de campeões
      const { data: champions, error: championsError } = await supabase
        .from('champions')
        .select('id, name, key_name');
      
      if (championsError) throw championsError;
      
      champions?.forEach(c => {
        this.championNameToId.set(this.normalize(c.name), c.id);
        this.championNameToId.set(this.normalize(c.key_name), c.id);
      });
      
      // Cache de times - use team_mappings for Leaguepedia name resolution
      const { data: teamMappings, error: teamMappingsError } = await supabase
        .from('team_mappings')
        .select(`
          leaguepedia_name,
          team_id,
          season,
          is_active
        `)
        .eq('is_active', true);
      
      if (teamMappingsError) {
        console.warn('⚠️  team_mappings table not found, falling back to direct name matching');
      } else {
        // Add mappings from team_mappings table
        teamMappings?.forEach(tm => {
          this.teamNameToId.set(this.normalize(tm.leaguepedia_name), tm.team_id);
        });
      }
      
      // Also load teams directly for backwards compatibility
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name');
      
      if (teamsError) throw teamsError;
      
      teams?.forEach(t => {
        // Only add if not already mapped via team_mappings
        const normalized = this.normalize(t.name);
        if (!this.teamNameToId.has(normalized)) {
          this.teamNameToId.set(normalized, t.id);
        }
      });
      
      this.initialized = true;
      
      console.log(`✅ Caches inicializados:`);
      console.log(`   - ${players?.length || 0} jogadores`);
      console.log(`   - ${champions?.length || 0} campeões`);
      console.log(`   - ${teams?.length || 0} times`);
      
    } catch (error: any) {
      console.error('❌ Erro ao inicializar caches:', error.message);
      throw error;
    }
  }
  
  /**
   * Normalizar string para comparação (lowercase, trim, remove acentos)
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  }
  
  /**
   * Mapear nome do jogador → ID do banco
   */
  getPlayerId(leaguepediaName: string): string | null {
    if (!this.initialized) {
      throw new Error('Caches não inicializados. Chame initializeCaches() primeiro.');
    }
    
    const normalized = this.normalize(leaguepediaName);
    const id = this.playerNameToId.get(normalized);
    
    if (!id) {
      console.warn(`⚠️  Jogador não encontrado no banco: "${leaguepediaName}"`);
    }
    
    return id || null;
  }
  
  /**
   * Mapear nome do campeão → ID do banco
   */
  getChampionId(championName: string): number | null {
    if (!this.initialized) {
      throw new Error('Caches não inicializados. Chame initializeCaches() primeiro.');
    }
    
    const normalized = this.normalize(championName);
    const id = this.championNameToId.get(normalized);
    
    if (!id) {
      console.warn(`⚠️  Campeão não encontrado no banco: "${championName}"`);
    }
    
    return id || null;
  }
  
  /**
   * Mapear nome do time → ID do banco
   */
  getTeamId(teamName: string): string | null {
    if (!this.initialized) {
      throw new Error('Caches não inicializados. Chame initializeCaches() primeiro.');
    }
    
    const normalized = this.normalize(teamName);
    const id = this.teamNameToId.get(normalized);
    
    if (!id) {
      console.warn(`⚠️  Time não encontrado no banco: "${teamName}"`);
    }
    
    return id || null;
  }
  
  /**
   * Mapear performance do Leaguepedia para formato do banco
   */
  mapPlayerPerformance(lpStats: any, matchId: number, winnerId: string): PlayerPerformanceInput | null {
    const playerId = this.getPlayerId(lpStats.Link);
    const championId = this.getChampionId(lpStats.Champion);
    const teamId = this.getTeamId(lpStats.Team);
    
    if (!playerId) {
      console.warn(`⚠️  Pulando performance: jogador "${lpStats.Link}" não encontrado`);
      return null;
    }
    
    if (!championId) {
      console.warn(`⚠️  Pulando performance: campeão "${lpStats.Champion}" não encontrado`);
      return null;
    }
    
    if (!teamId) {
      console.warn(`⚠️  Pulando performance: time "${lpStats.Team}" não encontrado`);
      return null;
    }
    
    const isWinner = teamId === winnerId;
    
    return {
      match_id: matchId,
      player_id: playerId,
      champion_id: championId,
      kills: parseInt(lpStats.Kills) || 0,
      deaths: parseInt(lpStats.Deaths) || 0,
      assists: parseInt(lpStats.Assists) || 0,
      cs: parseInt(lpStats.CS) || 0,
      gold_earned: parseInt(lpStats.Gold) || 0,
      damage_dealt: parseInt(lpStats.DamageToChampions) || 0,
      wards_placed: 0, // Leaguepedia não tem esse dado normalmente
      first_blood: false, // Precisaria buscar de outra tabela
      triple_kill: false,
      quadra_kill: false,
      penta_kill: false,
      is_winner: isWinner
    };
  }
  
  /**
   * Limpar caches (útil para testes ou reload)
   */
  clearCaches(): void {
    this.playerNameToId.clear();
    this.championNameToId.clear();
    this.teamNameToId.clear();
    this.initialized = false;
    console.log('🧹 Caches limpos');
  }
  
  /**
   * Obter estatísticas dos caches
   */
  getCacheStats() {
    return {
      initialized: this.initialized,
      players: this.playerNameToId.size,
      champions: this.championNameToId.size,
      teams: this.teamNameToId.size
    };
  }
}

export const mapperService = new MapperService();
