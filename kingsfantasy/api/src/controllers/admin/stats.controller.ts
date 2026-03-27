import { Response } from 'express';
import { supabase } from '../../config/supabase';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * STATS CONTROLLER
 * 
 * Fornece estatísticas gerais do sistema para dashboard admin
 */

/**
 * Obter estatísticas gerais do dashboard
 * GET /api/admin/stats/dashboard
 */
export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('📊 Fetching dashboard stats...');

    // Buscar estatísticas em paralelo
    const [
      { count: totalUsers },
      { count: totalMatches },
      { count: totalPerformances },
      { data: pendingRounds },
      { data: activeRounds },
      { data: latestMatch }
    ] = await Promise.all([
      // Total de usuários
      supabase.from('user_teams').select('id', { count: 'exact', head: true }),
      
      // Total de partidas
      supabase.from('matches').select('id', { count: 'exact', head: true }),
      
      // Total de performances
      supabase.from('player_performances').select('id', { count: 'exact', head: true }),
      
      // Rodadas pendentes
      supabase
        .from('rounds')
        .select('id')
        .eq('status', 'upcoming'),

      // Rodadas ativas (live no DB)
      supabase
        .from('rounds')
        .select('id, is_market_open')
        .eq('status', 'live'),
      
      // Última partida inserida
      supabase
        .from('matches')
        .select('id, created_at, scheduled_time')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    // Determinar status do mercado
    let marketStatus = 'closed';
    if (activeRounds && activeRounds.length > 0) {
      const hasOpenMarket = activeRounds.some((r: any) => r.is_market_open === true);
      marketStatus = hasOpenMarket ? 'open' : 'closed';
    }

    // Buscar configurações do sistema
    const { data: configs } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['enable_analyst_rating', 'budget', 'max_possible_score']);

    const configMap = new Map(configs?.map(c => [c.key, c.value]) || []);

    const stats = {
      users: {
        total: totalUsers || 0,
        label: 'Usuários Cadastrados'
      },
      matches: {
        total: totalMatches || 0,
        label: 'Partidas Registradas',
        latest: latestMatch ? {
          id: latestMatch.id,
          created_at: latestMatch.created_at,
          scheduled_time: latestMatch.scheduled_time
        } : null
      },
      performances: {
        total: totalPerformances || 0,
        label: 'Performances Inseridas'
      },
      rounds: {
        pending: pendingRounds?.length || 0,
        active: activeRounds?.length || 0,
        label: 'Rodadas'
      },
      market: {
        status: marketStatus,
        label: marketStatus === 'open' ? 'Mercado Aberto' : 'Mercado Fechado'
      },
      system: {
        analyst_rating_enabled: configMap.get('enable_analyst_rating') === 'true',
        budget: parseFloat(configMap.get('budget') || '60'),
        max_score: parseFloat(configMap.get('max_possible_score') || '100')
      }
    };

    console.log('✅ Dashboard stats fetched successfully');

    return res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Exception in getDashboardStats:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar estatísticas',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Obter estatísticas detalhadas de uma rodada
 * GET /api/admin/stats/round/:roundId
 */
export async function getRoundStats(req: AuthenticatedRequest, res: Response) {
  try {
    const { roundId } = req.params;

    // Buscar dados da rodada
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', parseInt(roundId))
      .single();

    if (roundError || !round) {
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada',
        round_id: roundId
      });
    }

    // Buscar partidas da rodada
    const { data: matches } = await supabase
      .from('matches')
      .select('id, games_count')
      .eq('round_id', parseInt(roundId));

    const matchIds = matches?.map(m => m.id) || [];

    // Buscar performances das partidas
    const { count: performancesCount } = await supabase
      .from('player_performances')
      .select('id', { count: 'exact', head: true })
      .in('match_id', matchIds.length > 0 ? matchIds : [0]); // Evitar erro se não houver matches

    const stats = {
      round: {
        id: round.id,
        season: round.season,
        round_number: round.round_number,
        status: round.status,
        is_market_open: round.is_market_open
      },
      matches: {
        total: matches?.length || 0,
        label: 'Partidas Registradas'
      },
      performances: {
        total: performancesCount || 0,
        expected: (matches || []).reduce((sum: number, m: any) => sum + (Number(m.games_count || 1) * 10), 0),
        label: 'Performances Inseridas'
      },
      completion: {
        percentage: (() => {
          const expected = (matches || []).reduce((sum: number, m: any) => sum + (Number(m.games_count || 1) * 10), 0);
          return expected > 0 ? ((performancesCount || 0) / expected) * 100 : 0;
        })(),
        label: 'Completude da Rodada'
      }
    };

    return res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Exception in getRoundStats:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar estatísticas da rodada',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
