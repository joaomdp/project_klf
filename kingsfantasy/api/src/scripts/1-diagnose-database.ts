// Script 1: Diagnóstico completo do banco de dados
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { DiagnosticResult } from './utils/types';

async function diagnoseDatabase() {
  logger.box([
    '🔍 Kings Lendas Fantasy - Database Diagnostic',
    'Verificando estado atual do banco de dados...',
  ]);

  const results: DiagnosticResult[] = [];

  try {
    // 1. Teams
    logger.step(1, 12, 'Verificando TEAMS...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*');
    
    if (teamsError) throw teamsError;
    
    const teamsCount = teams?.length || 0;
    const teamsHaveRelativeUrls = teams?.some(t => !t.image_url?.startsWith('http')) || false;
    
    results.push({
      table: 'teams',
      count: teamsCount,
      status: teamsCount === constants.TOTAL_TEAMS && !teamsHaveRelativeUrls ? 'ok' : 'warning',
      message: teamsHaveRelativeUrls 
        ? `${teamsCount} times (URLs relativas detectadas)` 
        : `${teamsCount}/${constants.TOTAL_TEAMS} times`,
      sample: teams?.slice(0, 3),
    });

    // 2. Players
    logger.step(2, 12, 'Verificando PLAYERS...');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');
    
    if (playersError) throw playersError;
    
    const playersCount = players?.length || 0;
    const prices = players?.map(p => p.price) || [];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const playersHaveRelativeUrls = players?.some(p => !p.image_url?.startsWith('http')) || false;
    const pricesNeedRebalance = minPrice < constants.MIN_PLAYER_PRICE || maxPrice > constants.MAX_PLAYER_PRICE;
    
    results.push({
      table: 'players',
      count: playersCount,
      status: pricesNeedRebalance || playersHaveRelativeUrls ? 'warning' : 'ok',
      message: `${playersCount} jogadores | Preços: ${minPrice.toFixed(1)}-${maxPrice.toFixed(1)} (esperado: ${constants.MIN_PLAYER_PRICE}-${constants.MAX_PLAYER_PRICE})`,
      sample: players?.slice(0, 3),
    });

    // 3. Champions
    logger.step(3, 12, 'Verificando CHAMPIONS...');
    const { data: champions, error: championsError } = await supabase
      .from('champions')
      .select('*');
    
    if (championsError) throw championsError;
    
    const championsCount = champions?.length || 0;
    const championsMissing = constants.TOTAL_CHAMPIONS_EXPECTED - championsCount;
    
    results.push({
      table: 'champions',
      count: championsCount,
      status: championsCount === constants.TOTAL_CHAMPIONS_EXPECTED ? 'ok' : 'warning',
      message: championsMissing > 0 
        ? `${championsCount}/${constants.TOTAL_CHAMPIONS_EXPECTED} (faltam ${championsMissing})` 
        : `${championsCount} campeões`,
      sample: champions?.slice(0, 3),
    });

    // 4. Rounds
    logger.step(4, 12, 'Verificando ROUNDS...');
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('*')
      .eq('season', constants.CURRENT_SEASON);
    
    if (roundsError) throw roundsError;
    
    const roundsCount = rounds?.length || 0;
    
    results.push({
      table: 'rounds',
      count: roundsCount,
      status: roundsCount === constants.TOTAL_ROUNDS ? 'ok' : 'warning',
      message: `${roundsCount}/${constants.TOTAL_ROUNDS} rodadas (temporada ${constants.CURRENT_SEASON})`,
      sample: rounds?.slice(0, 3),
    });

    // 5. Leagues
    logger.step(5, 12, 'Verificando LEAGUES...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('*');
    
    if (leaguesError) throw leaguesError;
    
    const leaguesCount = leagues?.length || 0;
    
    results.push({
      table: 'leagues',
      count: leaguesCount,
      status: leaguesCount === constants.TOTAL_LEAGUES ? 'ok' : 'warning',
      message: `${leaguesCount}/${constants.TOTAL_LEAGUES} ligas`,
      sample: leagues?.slice(0, 3),
    });

    // 6. System Config
    logger.step(6, 12, 'Verificando SYSTEM_CONFIG...');
    const { data: configs, error: configsError } = await supabase
      .from('system_config')
      .select('*');
    
    if (configsError) throw configsError;
    
    const configsCount = configs?.length || 0;
    const budgetConfig = configs?.find(c => c.key === 'initial_budget');
    const maxPriceConfig = configs?.find(c => c.key === 'max_player_price');
    const ratingConfig = configs?.find(c => c.key === 'enable_analyst_rating');
    
    const budgetNeedsUpdate = budgetConfig && parseFloat(budgetConfig.value) !== constants.INITIAL_BUDGET;
    const maxPriceNeedsUpdate = maxPriceConfig && parseFloat(maxPriceConfig.value) !== constants.MAX_PLAYER_PRICE;
    const ratingSystemMissing = !ratingConfig;
    
    results.push({
      table: 'system_config',
      count: configsCount,
      status: budgetNeedsUpdate || maxPriceNeedsUpdate || ratingSystemMissing ? 'warning' : 'ok',
      message: `${configsCount} configs | Budget: ${budgetConfig?.value || 'N/A'} (esperado: ${constants.INITIAL_BUDGET}) | Rating System: ${ratingSystemMissing ? 'Ausente' : 'Configurado'}`,
      sample: configs?.slice(0, 5),
    });

    // 7. User Teams
    logger.step(7, 12, 'Verificando USER_TEAMS...');
    const { data: userTeams, error: userTeamsError } = await supabase
      .from('user_teams')
      .select('*');
    
    if (userTeamsError) throw userTeamsError;
    
    const userTeamsCount = userTeams?.length || 0;
    const userTeamsWithOldBudget = userTeams?.filter(ut => ut.available_budget > 100).length || 0;
    
    results.push({
      table: 'user_teams',
      count: userTeamsCount,
      status: userTeamsWithOldBudget > 0 ? 'warning' : 'ok',
      message: userTeamsWithOldBudget > 0 
        ? `${userTeamsCount} times | ${userTeamsWithOldBudget} com budget antigo (>100)` 
        : `${userTeamsCount} times de usuários`,
    });

    // 8. Matches
    logger.step(8, 12, 'Verificando MATCHES...');
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*');
    
    if (matchesError) throw matchesError;
    
    const matchesCount = matches?.length || 0;
    
    results.push({
      table: 'matches',
      count: matchesCount,
      status: 'ok',
      message: `${matchesCount} partidas (será populado via admin panel)`,
    });

    // 9. Player Performances
    logger.step(9, 12, 'Verificando PLAYER_PERFORMANCES...');
    const { data: performances, error: performancesError } = await supabase
      .from('player_performances')
      .select('*');
    
    if (performancesError) throw performancesError;
    
    const performancesCount = performances?.length || 0;
    
    results.push({
      table: 'player_performances',
      count: performancesCount,
      status: 'ok',
      message: `${performancesCount} performances (será populado via admin panel)`,
    });

    // 10. User Team Players
    logger.step(10, 12, 'Verificando USER_TEAM_PLAYERS...');
    
    let userTeamPlayersCount = 0;
    let userTeamPlayersExists = true;
    
    try {
      const { data: userTeamPlayers, error: userTeamPlayersError } = await supabase
        .from('user_team_players')
        .select('*');
      
      if (userTeamPlayersError) {
        if (userTeamPlayersError.message.includes('does not exist')) {
          userTeamPlayersExists = false;
        } else {
          throw userTeamPlayersError;
        }
      } else {
        userTeamPlayersCount = userTeamPlayers?.length || 0;
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('not find the table')) {
        userTeamPlayersExists = false;
      } else {
        throw error;
      }
    }
    
    results.push({
      table: 'user_team_players',
      count: userTeamPlayersCount,
      status: 'ok',
      message: userTeamPlayersExists ? `${userTeamPlayersCount} escalações de jogadores` : 'Tabela não existe (opcional)',
    });

    // 11. League Configs
    logger.step(11, 12, 'Verificando LEAGUE_CONFIGS...');
    
    let leagueConfigsCount = 0;
    let leagueConfigsExists = true;
    
    try {
      const { data: leagueConfigs, error: leagueConfigsError } = await supabase
        .from('league_configs')
        .select('*');
      
      if (leagueConfigsError) {
        if (leagueConfigsError.message.includes('does not exist')) {
          leagueConfigsExists = false;
        } else {
          throw leagueConfigsError;
        }
      } else {
        leagueConfigsCount = leagueConfigs?.length || 0;
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('not find the table')) {
        leagueConfigsExists = false;
      } else {
        throw error;
      }
    }
    
    results.push({
      table: 'league_configs',
      count: leagueConfigsCount,
      status: 'ok',
      message: leagueConfigsExists ? `${leagueConfigsCount} configurações de liga` : 'Tabela não existe (opcional)',
    });

    // 12. Market History
    logger.step(12, 12, 'Verificando MARKET_HISTORY...');
    
    let marketHistoryCount = 0;
    let marketHistoryExists = true;
    
    try {
      const { data: marketHistory, error: marketHistoryError } = await supabase
        .from('market_history')
        .select('*');
      
      if (marketHistoryError) {
        if (marketHistoryError.message.includes('does not exist')) {
          marketHistoryExists = false;
        } else {
          throw marketHistoryError;
        }
      } else {
        marketHistoryCount = marketHistory?.length || 0;
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('not find the table')) {
        marketHistoryExists = false;
      } else {
        throw error;
      }
    }
    
    results.push({
      table: 'market_history',
      count: marketHistoryCount,
      status: 'ok',
      message: marketHistoryExists ? `${marketHistoryCount} registros de histórico` : 'Tabela não existe (opcional)',
    });

    // Exibir Resultados
    logger.section('📊 RESUMO DO DIAGNÓSTICO');

    results.forEach(result => {
      const statusIcon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      logger.raw(`${statusIcon} ${result.table.toUpperCase().padEnd(25)} | ${result.message}`);
    });

    // Identificar problemas
    logger.section('🔧 AÇÕES RECOMENDADAS');

    const warnings = results.filter(r => r.status === 'warning');
    const errors = results.filter(r => r.status === 'error');

    if (errors.length > 0) {
      logger.error(`${errors.length} erro(s) crítico(s) encontrado(s)!`);
      errors.forEach(e => logger.item(e.message || '', 'error'));
    }

    if (warnings.length > 0) {
      logger.warning(`${warnings.length} aviso(s) encontrado(s):`);
      
      if (pricesNeedRebalance) {
        logger.item('Execute: npm run db:rebalance (ajustar preços para 8-15)', 'warning');
      }
      
      if (teamsHaveRelativeUrls || playersHaveRelativeUrls) {
        logger.item('Execute: npm run db:fix-urls (converter URLs para absolutas)', 'warning');
      }
      
      if (championsMissing > 0) {
        logger.item(`Execute: npm run db:update-champions (adicionar ${championsMissing} campeões faltantes)`, 'warning');
      }
      
      if (roundsCount < constants.TOTAL_ROUNDS) {
        logger.item(`Execute: npm run db:seed-rounds (criar ${constants.TOTAL_ROUNDS - roundsCount} rodadas)`, 'warning');
      }
      
      if (budgetNeedsUpdate || maxPriceNeedsUpdate || ratingSystemMissing) {
        logger.item('Execute: npm run db:update-configs (atualizar configurações do sistema)', 'warning');
      }
      
      if (userTeamsWithOldBudget > 0) {
        logger.item('Execute: npm run db:rebalance (ajustar budgets de times de usuários)', 'warning');
      }
    }

    if (warnings.length === 0 && errors.length === 0) {
      logger.success('Banco de dados está em perfeito estado!');
      logger.info('Nenhuma ação necessária.');
    } else {
      logger.blank();
      logger.info('Para executar todas as correções de uma vez:');
      logger.raw('  npm run db:seed-all');
    }

    logger.blank();
    logger.success('Diagnóstico completo!');

  } catch (error: any) {
    logger.error('Erro durante diagnóstico:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
diagnoseDatabase();
