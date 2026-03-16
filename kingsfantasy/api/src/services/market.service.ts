import { adminSupabase, supabase } from '../config/supabase';

/**
 * MARKET SERVICE
 * 
 * Gerenciamento do mercado de transferências
 * 
 * Funcionalidades:
 * 1. Fechar mercado automaticamente 1h antes das rodadas
 * 2. Reabrir mercado (terças-feiras às 00h)
 * 3. Travar lineups dos usuários quando mercado fecha
 * 4. Validar se trocas podem ser feitas
 */

export interface MarketStatus {
  isOpen: boolean;
  currentRound?: {
    id: number;
    round_number: number;
    start_date: string;
    market_close_time: string;
  };
  nextCloseTime?: string;
  message: string;
}

class MarketService {
  private readonly NEXT_ROUND_STATUSES = ['upcoming', 'pending', 'active', 'open', 'live'];

  private readonly SCHEDULABLE_ROUND_STATUSES = ['upcoming', 'pending', 'active', 'open', 'live'];

  /**
   * Verifica status atual do mercado
   */
  async getMarketStatus(): Promise<MarketStatus> {
    try {
      const now = new Date();

      // 1) Prioriza qualquer rodada com mercado aberto (independente do status)
      const { data: openRounds, error: openRoundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('is_market_open', true)
        .order('market_close_time', { ascending: true })
        .limit(20);

      if (openRoundsError && openRoundsError.code !== 'PGRST116') throw openRoundsError;

      const currentlyOpenRound = (openRounds || []).find((item: any) => {
        const closeTime = new Date(item.market_close_time);
        return !Number.isNaN(closeTime.getTime()) && now < closeTime;
      });

      if (currentlyOpenRound) {
        const marketCloseTime = new Date(currentlyOpenRound.market_close_time);
        return {
          isOpen: true,
          currentRound: {
            id: currentlyOpenRound.id,
            round_number: currentlyOpenRound.round_number,
            start_date: currentlyOpenRound.start_date,
            market_close_time: currentlyOpenRound.market_close_time
          },
          nextCloseTime: currentlyOpenRound.market_close_time,
          message: `Mercado aberto até ${marketCloseTime.toLocaleString('pt-BR')}`
        };
      }

      // 2) Sem mercado aberto, busca próxima rodada elegível para contexto
      const { data: rounds, error } = await supabase
        .from('rounds')
        .select('*')
        .in('status', this.NEXT_ROUND_STATUSES)
        .order('start_date', { ascending: true })
        .limit(20);

      if (error && error.code !== 'PGRST116') throw error;

      if (!rounds || rounds.length === 0) {
        return {
          isOpen: false,
          message: 'Não há rodadas agendadas no momento'
        };
      }

      const round = rounds[0];
      const marketCloseTime = new Date(round.market_close_time);
      const isOpen = false;

      return {
        isOpen,
        currentRound: {
          id: round.id,
          round_number: round.round_number,
          start_date: round.start_date,
          market_close_time: round.market_close_time
        },
        nextCloseTime: round.market_close_time,
        message: isOpen 
          ? `Mercado aberto até ${marketCloseTime.toLocaleString('pt-BR')}`
          : 'Mercado fechado'
      };

    } catch (error) {
      console.error('❌ Error getting market status:', error);
      throw error;
    }
  }

  /**
   * Fecha o mercado para uma rodada específica
   */
  async closeMarket(roundId: number): Promise<void> {
    try {
      console.log(`🔒 Closing market for round ${roundId}...`);

      // 1. Atualizar status do mercado na rodada
      const { error: roundError } = await adminSupabase
        .from('rounds')
        .update({ 
          is_market_open: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', roundId);

      if (roundError) throw roundError;

      // 2. Travar todos os user_teams
      const { error: lockError } = await adminSupabase
        .from('user_teams')
        .update({
          is_locked: true,
          last_locked_at: new Date().toISOString()
        });

      if (lockError) throw lockError;

      console.log(`✅ Market closed for round ${roundId} and all teams locked`);

    } catch (error) {
      console.error('❌ Error closing market:', error);
      throw error;
    }
  }

  /**
   * Abre o mercado (executado automaticamente às terças 00h)
   */
  async openMarket(): Promise<{ opened: boolean; roundId?: number; reason?: string }> {
    try {
      console.log(`🔓 Opening market...`);

      // 1. Buscar próxima rodada upcoming
      const { data: nextRound, error: roundError } = await adminSupabase
        .from('rounds')
        .select('id, market_close_time')
        .in('status', this.SCHEDULABLE_ROUND_STATUSES)
        .order('start_date', { ascending: true })
        .limit(1)
        .single();

      if (roundError && roundError.code !== 'PGRST116') throw roundError;

      if (!nextRound) {
        console.log('⚠️  No upcoming rounds found, market remains closed');
        return { opened: false, reason: 'Nenhuma rodada elegível para abrir mercado' };
      }

      const now = new Date();
      const currentCloseTime = (nextRound as any).market_close_time
        ? new Date((nextRound as any).market_close_time)
        : null;
      const shouldExtendCloseTime = !currentCloseTime || Number.isNaN(currentCloseTime.getTime()) || currentCloseTime <= now;
      const nextCloseTime = shouldExtendCloseTime
        ? new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString()
        : (nextRound as any).market_close_time;

      // 2. Abrir mercado
      const { error: updateError } = await adminSupabase
        .from('rounds')
        .update({ 
          is_market_open: true,
          market_close_time: nextCloseTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', nextRound.id);

      if (updateError) throw updateError;

      // 3. Destravar todos os user_teams
      const { error: unlockError } = await adminSupabase
        .from('user_teams')
        .update({
          is_locked: false
        });

      if (unlockError) throw unlockError;

      console.log(`✅ Market opened for round ${nextRound.id} and all teams unlocked`);
      return { opened: true, roundId: nextRound.id };

    } catch (error) {
      console.error('❌ Error opening market:', error);
      throw error;
    }
  }

  /**
   * Verifica se deve fechar o mercado agora (1h antes da rodada)
   */
  async checkAndCloseMarket(): Promise<{ closed: boolean; roundId?: number }> {
    try {
      console.log('🔍 Checking if market should close...');

      const { data: rounds, error } = await adminSupabase
        .from('rounds')
        .select('*')
        .eq('is_market_open', true);

      if (error) throw error;

      if (!rounds || rounds.length === 0) {
        console.log('ℹ️  No open markets to check');
        return { closed: false };
      }

      const now = new Date();
      let closedAny = false;
      let closedRoundId: number | undefined;

      for (const round of rounds) {
        const marketCloseTime = new Date(round.market_close_time);

        // Se passou da hora de fechar
        if (now >= marketCloseTime) {
          await this.closeMarket(round.id);
          closedAny = true;
          closedRoundId = round.id;
          console.log(`✅ Market automatically closed for round ${round.id}`);
        }
      }

      return { closed: closedAny, roundId: closedRoundId };

    } catch (error) {
      console.error('❌ Error checking market close:', error);
      throw error;
    }
  }

  /**
   * Valida se uma troca pode ser feita
   */
  async validateTrade(userTeamId: number): Promise<{ valid: boolean; message: string }> {
    try {
      // 1. Verificar se mercado está aberto
      const marketStatus = await this.getMarketStatus();
      
      if (!marketStatus.isOpen) {
        return {
          valid: false,
          message: 'Mercado fechado. Não é possível fazer trocas no momento.'
        };
      }

      // 2. Verificar se o user_team está travado
      const { data: userTeam, error } = await supabase
        .from('user_teams')
        .select('is_locked')
        .eq('id', userTeamId)
        .single();

      if (error) throw error;

      if (userTeam.is_locked) {
        return {
          valid: false,
          message: 'Seu time está travado. Aguarde a próxima rodada.'
        };
      }

      return {
        valid: true,
        message: 'Troca permitida'
      };

    } catch (error) {
      console.error('❌ Error validating trade:', error);
      throw error;
    }
  }

  /**
   * Obtém tempo restante até fechar o mercado
   */
  async getTimeUntilMarketClose(): Promise<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null> {
    try {
      const status = await this.getMarketStatus();
      
      if (!status.isOpen || !status.nextCloseTime) {
        return null;
      }

      const now = new Date();
      const closeTime = new Date(status.nextCloseTime);
      const diffMs = closeTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        return null;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return { hours, minutes, seconds, totalSeconds };

    } catch (error) {
      console.error('❌ Error getting time until market close:', error);
      throw error;
    }
  }

  /**
   * Força abertura do mercado (apenas para testes/admin)
   */
  async forceOpenMarket(roundId: number): Promise<void> {
    console.log(`⚠️  ADMIN: Force opening market for round ${roundId}`);

    const { data: round, error: roundError } = await adminSupabase
      .from('rounds')
      .select('id, market_close_time')
      .eq('id', roundId)
      .single();

    if (roundError || !round) throw roundError || new Error('Rodada não encontrada');

    const now = new Date();
    const currentCloseTime = round.market_close_time ? new Date(round.market_close_time) : null;
    const shouldExtendCloseTime = !currentCloseTime || Number.isNaN(currentCloseTime.getTime()) || currentCloseTime <= now;
    const nextCloseTime = shouldExtendCloseTime
      ? new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString()
      : round.market_close_time;

    const { error } = await adminSupabase
      .from('rounds')
      .update({
        is_market_open: true,
        market_close_time: nextCloseTime,
        updated_at: now.toISOString()
      })
      .eq('id', roundId);

    if (error) throw error;

    const { error: unlockError } = await adminSupabase
      .from('user_teams')
      .update({ is_locked: false });

    if (unlockError) throw unlockError;

    console.log(`✅ Market force-opened`);
  }

  /**
   * Força fechamento do mercado (apenas para testes/admin)
   */
  async forceCloseMarket(roundId: number): Promise<void> {
    console.log(`⚠️  ADMIN: Force closing market for round ${roundId}`);
    await this.closeMarket(roundId);
  }
}

export const marketService = new MarketService();
