// Script 6: Criar rodadas adicionais (status: pending)
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { RoundCreationResult } from './utils/types';

async function seedMoreRounds() {
  logger.box([
    '📅 Kings Lendas Fantasy - Rounds Seeding',
    'Criando rodadas adicionais (status: upcoming)...',
  ]);

  const results: RoundCreationResult[] = [];

  try {
    // FASE 1: Verificar rodadas existentes
    logger.section('FASE 1: Verificando Rodadas Existentes');
    
    const { data: existingRounds, error: fetchError } = await supabase
      .from('rounds')
      .select('*')
      .eq('season', constants.CURRENT_SEASON)
      .order('round_number', { ascending: true });
    
    if (fetchError) throw fetchError;
    
    const existingCount = existingRounds?.length || 0;
    const existingNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
    
    logger.info(`Temporada atual: ${constants.CURRENT_SEASON}`);
    logger.info(`Rodadas existentes: ${existingCount}`);
    
    if (existingCount > 0) {
      logger.info('Rodadas encontradas:');
      existingRounds?.forEach(r => {
        logger.raw(`  • Rodada ${r.round_number} - Status: ${r.status}`);
      });
    }

    // FASE 2: Criar rodadas faltantes
    logger.section('FASE 2: Criando Rodadas Faltantes');
    
    logger.info(`Meta: ${constants.TOTAL_ROUNDS} rodadas totais`);
    logger.info(`Rodadas a criar: ${constants.TOTAL_ROUNDS - existingCount}`);

    let createdCount = 0;
    let skippedCount = 0;

    for (let roundNumber = 1; roundNumber <= constants.TOTAL_ROUNDS; roundNumber++) {
      // Verificar se rodada já existe
      if (existingNumbers.has(roundNumber)) {
        logger.info(`Rodada ${roundNumber} - Já existe, pulando`);
        skippedCount++;
        
        results.push({
          roundNumber,
          season: constants.CURRENT_SEASON,
          status: 'pending',
          action: 'skipped',
        });
        
        continue;
      }

      // Criar rodada
      // Placeholder dates (can be updated later via admin panel)
      const placeholderDate = new Date(2026, 1, 7 + (roundNumber - 1) * 7); // Weekly intervals starting Feb 7
      const endDate = new Date(placeholderDate.getTime() + 6 * 24 * 60 * 60 * 1000); // +6 days
      const marketCloseDate = new Date(placeholderDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before
      
      const { error } = await supabase
        .from('rounds')
        .insert({
          round_number: roundNumber,
          season: constants.CURRENT_SEASON,
          status: 'upcoming',
          start_date: placeholderDate.toISOString(),
          end_date: endDate.toISOString(),
          market_close_time: marketCloseDate.toISOString(),
          is_market_open: false,
        });

      if (error) {
        logger.error(`Erro ao criar Rodada ${roundNumber}: ${error.message}`);
      } else {
        logger.success(`Rodada ${roundNumber} criada (status: pending)`);
        createdCount++;
        
        results.push({
          roundNumber,
          season: constants.CURRENT_SEASON,
          status: 'pending',
          action: 'created',
        });
      }
    }

    // FASE 3: Verificar total final
    logger.section('FASE 3: Verificando Total Final');
    
    const { data: finalRounds, error: verifyError } = await supabase
      .from('rounds')
      .select('*')
      .eq('season', constants.CURRENT_SEASON)
      .order('round_number', { ascending: true });
    
    if (verifyError) throw verifyError;
    
    const finalCount = finalRounds?.length || 0;
    
    logger.info(`Total de rodadas na temporada ${constants.CURRENT_SEASON}: ${finalCount}/${constants.TOTAL_ROUNDS}`);

    if (finalCount === constants.TOTAL_ROUNDS) {
      logger.success('✅ Todas as rodadas esperadas estão criadas!');
    } else {
      logger.warning(`⚠️  Esperado: ${constants.TOTAL_ROUNDS}, Atual: ${finalCount}`);
    }

    // Mostrar estrutura final
    if (finalRounds && finalRounds.length > 0) {
      logger.subsection('Estrutura final das rodadas:');
      finalRounds.forEach(r => {
        const icon = r.status === 'upcoming' ? '⏳' : r.status === 'open' ? '🔓' : r.status === 'closed' ? '🔒' : '✅';
        const dateInfo = r.start_date 
          ? `${new Date(r.start_date).toLocaleDateString('pt-BR')}` 
          : 'Sem data definida';
        
        logger.raw(`  ${icon} Rodada ${r.round_number} - ${r.status.toUpperCase()} - ${dateInfo}`);
      });
    }

    // Resumo Final
    logger.section('📊 RESUMO');
    
    logger.success(`Rodadas criadas: ${createdCount}`);
    logger.info(`Rodadas puladas (já existiam): ${skippedCount}`);
    logger.info(`Total na temporada ${constants.CURRENT_SEASON}: ${finalCount}`);

    logger.blank();
    logger.info('ℹ️  Informações Importantes:');
    logger.raw('');
    logger.raw('  • Todas as rodadas foram criadas com status "upcoming"');
    logger.raw('  • Datas placeholder definidas (podem ser ajustadas no Admin Panel)');
    logger.raw('  • Use o Admin Panel para:');
    logger.raw('    - Definir datas definitivas de início/fim de cada rodada');
    logger.raw('    - Definir data de fechamento do mercado');
    logger.raw('    - Alterar status conforme rodadas acontecem');
    logger.raw('');

    logger.blank();
    logger.success('Criação de rodadas concluída!');

  } catch (error: any) {
    logger.error('Erro durante criação de rodadas:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
seedMoreRounds();
