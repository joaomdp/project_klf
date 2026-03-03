// Script 2: Rebalancear preços dos jogadores de 21k-30k para 8-15
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { Player, PriceRebalanceResult } from './utils/types';

async function rebalancePrices() {
  logger.box([
    '💰 Kings Lendas Fantasy - Price Rebalancing',
    'Rebalanceando preços: 21k-30k → 8-15',
    'Mantendo proporções relativas...',
  ]);

  try {
    // FASE 1: Buscar todos os jogadores
    logger.section('FASE 1: Analisando Preços Atuais');
    
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('price', { ascending: false });
    
    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      logger.error('Nenhum jogador encontrado no banco de dados!');
      process.exit(1);
    }

    const prices = players.map(p => p.price);
    const currentMin = Math.min(...prices);
    const currentMax = Math.max(...prices);
    
    logger.info(`Total de jogadores: ${players.length}`);
    logger.info(`Preço atual MIN: ${currentMin.toFixed(2)}`);
    logger.info(`Preço atual MAX: ${currentMax.toFixed(2)}`);
    logger.info(`Range atual: ${(currentMax - currentMin).toFixed(2)}`);

    // FASE 2: Calcular novos preços mantendo proporções
    logger.section('FASE 2: Calculando Novos Preços');
    
    const newMin = constants.MIN_PLAYER_PRICE;
    const newMax = constants.MAX_PLAYER_PRICE;
    const currentRange = currentMax - currentMin;
    const newRange = newMax - newMin;
    
    logger.info(`Novo range: ${newMin} - ${newMax}`);
    logger.info(`Fórmula: newPrice = ${newMin} + ((oldPrice - ${currentMin}) / ${currentRange}) × ${newRange}`);

    const rebalanceResults: PriceRebalanceResult[] = [];

    for (const player of players) {
      // Calcular novo preço mantendo proporção
      const proportion = (player.price - currentMin) / currentRange;
      const newPrice = parseFloat((newMin + (proportion * newRange)).toFixed(1));
      
      // Determinar tier
      let tier = 'C';
      if (newPrice >= 14.5) tier = 'S';
      else if (newPrice >= 13.0) tier = 'A+';
      else if (newPrice >= 11.5) tier = 'A';
      else if (newPrice >= 10.0) tier = 'B';
      
      rebalanceResults.push({
        playerId: player.id,
        nickname: player.name,
        oldPrice: player.price,
        newPrice,
        tier,
      });
    }

    // Mostrar preview dos top 10 e bottom 10
    logger.subsection('Preview - Top 10 jogadores:');
    rebalanceResults.slice(0, 10).forEach((r, idx) => {
      const nickname = r.nickname || 'Unknown';
      logger.raw(`  ${idx + 1}. ${nickname.padEnd(20)} | ${r.oldPrice.toFixed(1)} → ${r.newPrice.toFixed(1)} [Tier ${r.tier}]`);
    });

    logger.subsection('Preview - Bottom 10 jogadores:');
    rebalanceResults.slice(-10).forEach((r, idx) => {
      const nickname = r.nickname || 'Unknown';
      logger.raw(`  ${players.length - 9 + idx}. ${nickname.padEnd(20)} | ${r.oldPrice.toFixed(1)} → ${r.newPrice.toFixed(1)} [Tier ${r.tier}]`);
    });

    // FASE 3: Aplicar novos preços no banco
    logger.section('FASE 3: Atualizando Banco de Dados');
    
    let successCount = 0;
    let errorCount = 0;

    for (const result of rebalanceResults) {
      const { error } = await supabase
        .from('players')
        .update({ price: result.newPrice })
        .eq('id', result.playerId);
      
      if (error) {
        logger.error(`Erro ao atualizar ${result.nickname}: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }

    logger.success(`${successCount}/${rebalanceResults.length} jogadores atualizados`);
    if (errorCount > 0) {
      logger.error(`${errorCount} erros encontrados`);
    }

    // FASE 4: Atualizar budgets dos user_teams
    logger.section('FASE 4: Atualizando Budgets de Times de Usuários');
    
    const { data: userTeams, error: userTeamsError } = await supabase
      .from('user_teams')
      .select('*');
    
    if (userTeamsError) throw userTeamsError;

    if (!userTeams || userTeams.length === 0) {
      logger.info('Nenhum time de usuário encontrado (esperado no início)');
    } else {
      logger.info(`${userTeams.length} times de usuários encontrados`);
      
      const teamsWithOldBudget = userTeams.filter(ut => ut.available_budget > 100);
      
      if (teamsWithOldBudget.length > 0) {
        logger.info(`Ajustando budget de ${teamsWithOldBudget.length} times...`);
        
        for (const team of teamsWithOldBudget) {
          const { error } = await supabase
            .from('user_teams')
            .update({ available_budget: constants.INITIAL_BUDGET })
            .eq('id', team.id);
          
          if (error) {
            logger.error(`Erro ao atualizar time ${team.team_name}: ${error.message}`);
          }
        }
        
        logger.success(`Budgets atualizados para ${constants.INITIAL_BUDGET}`);
      } else {
        logger.info('Todos os budgets já estão corretos');
      }
    }

    // FASE 5: Validar que pelo menos um lineup válido existe
    logger.section('FASE 5: Validando Viabilidade de Lineups');
    
    const { data: updatedPlayers, error: validationError } = await supabase
      .from('players')
      .select('*')
      .order('price', { ascending: true });
    
    if (validationError) throw validationError;

    // Tentar montar o lineup mais barato (1 de cada role)
    const roles = constants.ROLES;
    const cheapestLineup: any[] = [];
    let totalCost = 0;

    for (const role of roles) {
      const cheapestInRole = updatedPlayers?.find(p => p.role === role);
      if (cheapestInRole) {
        cheapestLineup.push(cheapestInRole);
        totalCost += cheapestInRole.price;
      }
    }

    logger.info('Lineup mais barato possível:');
    cheapestLineup.forEach(p => {
      const nickname = p.name || 'Unknown';
      const role = p.role || 'UNKNOWN';
      logger.raw(`  • ${role.padEnd(8)} - ${nickname.padEnd(20)} (${p.price.toFixed(1)})`);
    });
    logger.raw(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.raw(`  TOTAL: ${totalCost.toFixed(1)}/${constants.INITIAL_BUDGET}`);

    if (totalCost <= constants.INITIAL_BUDGET) {
      logger.success('✅ Pelo menos 1 lineup válido existe dentro do budget!');
    } else {
      logger.error('❌ ERRO: Lineup mais barato ultrapassa o budget!');
      logger.error('Ajuste os preços ou aumente o budget inicial.');
      process.exit(1);
    }

    // Resumo final
    logger.section('📊 RESUMO');
    
    const tierCounts = {
      S: rebalanceResults.filter(r => r.tier === 'S').length,
      'A+': rebalanceResults.filter(r => r.tier === 'A+').length,
      A: rebalanceResults.filter(r => r.tier === 'A').length,
      B: rebalanceResults.filter(r => r.tier === 'B').length,
      C: rebalanceResults.filter(r => r.tier === 'C').length,
    };

    logger.info('Distribuição por Tier:');
    logger.raw(`  • Tier S (14.5-15.0): ${tierCounts.S} jogadores`);
    logger.raw(`  • Tier A+ (13.0-14.4): ${tierCounts['A+']} jogadores`);
    logger.raw(`  • Tier A (11.5-12.9): ${tierCounts.A} jogadores`);
    logger.raw(`  • Tier B (10.0-11.4): ${tierCounts.B} jogadores`);
    logger.raw(`  • Tier C (8.0-9.9): ${tierCounts.C} jogadores`);

    logger.blank();
    logger.success('Rebalanceamento de preços concluído com sucesso!');

  } catch (error: any) {
    logger.error('Erro durante rebalanceamento:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
rebalancePrices();
