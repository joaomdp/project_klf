// Script 5: Atualizar configurações do sistema
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { SystemConfig, ConfigUpdateResult } from './utils/types';

async function updateConfigs() {
  logger.box([
    '⚙️  Kings Lendas Fantasy - System Config Update',
    'Atualizando configurações do sistema...',
  ]);

  const results: ConfigUpdateResult[] = [];

  try {
    // Configurações a serem criadas/atualizadas
    const configs: SystemConfig[] = [
      // ===== EXISTENTES (UPDATE) =====
      {
        key: 'initial_budget',
        value: constants.INITIAL_BUDGET.toString(),
        description: 'Initial budget for user teams (Riot Fantasy standard)',
      },
      {
        key: 'max_player_price',
        value: constants.MAX_PLAYER_PRICE.toString(),
        description: 'Maximum player price',
      },
      {
        key: 'points_per_kill',
        value: '1.5',
        description: 'Points per kill',
      },
      {
        key: 'points_per_death',
        value: '-1.0',
        description: 'Points per death (negative)',
      },
      {
        key: 'points_per_assist',
        value: '1.0',
        description: 'Points per assist',
      },
      {
        key: 'points_per_cs',
        value: '0.01',
        description: 'Points per CS',
      },
      
      // ===== NOVOS (INSERT) =====
      {
        key: 'min_player_price',
        value: constants.MIN_PLAYER_PRICE.toString(),
        description: 'Minimum player price',
      },
      {
        key: 'season_name',
        value: 'Kings Lendas Season 4',
        description: 'Current season name',
      },
      
      // ===== DIVERSITY BONUS (v2 Balanced Economy) =====
      {
        key: 'diversity_5_teams',
        value: '20',
        description: 'Diversity bonus % for 5 unique teams (v2)',
      },
      {
        key: 'diversity_4_teams',
        value: '15',
        description: 'Diversity bonus % for 4 unique teams (v2)',
      },
      {
        key: 'diversity_3_teams',
        value: '10',
        description: 'Diversity bonus % for 3 unique teams (v2)',
      },
      {
        key: 'diversity_2_teams',
        value: '5',
        description: 'Diversity bonus % for 2 unique teams (v2)',
      },
      {
        key: 'diversity_1_team',
        value: '0',
        description: 'Diversity bonus % for 1 team (v2)',
      },

      // ===== SISTEMA DE RATING (INSERT) =====
      {
        key: 'enable_analyst_rating',
        value: 'false',
        description: 'Enable hybrid scoring with Ilha das Lendas analyst ratings (0-100 scale)',
      },
      {
        key: 'analyst_rating_weight',
        value: constants.ANALYST_RATING_WEIGHT.toString(),
        description: 'Weight of analyst rating in hybrid score (0.0-1.0)',
      },
      {
        key: 'objective_stats_weight',
        value: constants.OBJECTIVE_STATS_WEIGHT.toString(),
        description: 'Weight of objective stats in hybrid score (0.0-1.0)',
      },
      {
        key: 'max_possible_score',
        value: constants.MAX_POSSIBLE_SCORE.toString(),
        description: 'Maximum theoretical score for rating normalization',
      },
      {
        key: 'analyst_rating_scale',
        value: '0-100',
        description: 'Scale for analyst ratings: 0-40 weak, 41-60 ok, 61-80 good, 81-100 excellent',
      },
    ];

    // FASE 1: Buscar configs existentes
    logger.section('FASE 1: Verificando Configurações Existentes');
    
    const { data: existingConfigs, error: fetchError } = await supabase
      .from('system_config')
      .select('*');
    
    if (fetchError) throw fetchError;
    
    logger.info(`${existingConfigs?.length || 0} configurações encontradas no banco`);

    // Criar mapa de configs existentes
    const existingConfigsMap = new Map(
      existingConfigs?.map(c => [c.key, c]) || []
    );

    // FASE 2: Atualizar/Inserir configurações
    logger.section('FASE 2: Atualizando/Inserindo Configurações');

    for (const config of configs) {
      const existing = existingConfigsMap.get(config.key);

      if (existing) {
        // UPDATE: Config já existe
        if (existing.value === config.value) {
          logger.info(`${config.key} - Valor já correto (${config.value}), pulando`);
          continue;
        }

        logger.info(`${config.key}: "${existing.value}" → "${config.value}"`);
        
        const { error } = await supabase
          .from('system_config')
          .update({ 
            value: config.value,
            description: config.description,
          })
          .eq('key', config.key);

        if (error) {
          logger.error(`Erro ao atualizar ${config.key}: ${error.message}`);
        } else {
          logger.success(`${config.key} atualizado`);
          
          results.push({
            key: config.key,
            oldValue: existing.value,
            newValue: config.value,
            action: 'updated',
          });
        }
      } else {
        // INSERT: Config não existe
        logger.info(`${config.key}: Criando nova config = "${config.value}"`);
        
        const { error } = await supabase
          .from('system_config')
          .insert({
            key: config.key,
            value: config.value,
            description: config.description,
          });

        if (error) {
          logger.error(`Erro ao inserir ${config.key}: ${error.message}`);
        } else {
          logger.success(`${config.key} criado`);
          
          results.push({
            key: config.key,
            newValue: config.value,
            action: 'inserted',
          });
        }
      }
    }

    // FASE 3: Verificar configs críticos
    logger.section('FASE 3: Verificando Configurações Críticas');
    
    const { data: updatedConfigs, error: verifyError } = await supabase
      .from('system_config')
      .select('*')
      .in('key', configs.map(c => c.key));
    
    if (verifyError) throw verifyError;

    const criticalConfigs = [
      { key: 'initial_budget', expectedValue: constants.INITIAL_BUDGET.toString() },
      { key: 'max_player_price', expectedValue: constants.MAX_PLAYER_PRICE.toString() },
      { key: 'min_player_price', expectedValue: constants.MIN_PLAYER_PRICE.toString() },
      { key: 'enable_analyst_rating', expectedValue: 'false' },
      { key: 'analyst_rating_weight', expectedValue: constants.ANALYST_RATING_WEIGHT.toString() },
    ];

    let allCriticalOk = true;

    for (const critical of criticalConfigs) {
      const config = updatedConfigs?.find(c => c.key === critical.key);
      
      if (!config) {
        logger.error(`❌ ${critical.key} - NÃO ENCONTRADO!`);
        allCriticalOk = false;
      } else if (config.value !== critical.expectedValue) {
        logger.error(`❌ ${critical.key} - Valor incorreto: "${config.value}" (esperado: "${critical.expectedValue}")`);
        allCriticalOk = false;
      } else {
        logger.success(`✓ ${critical.key} = ${config.value}`);
      }
    }

    if (!allCriticalOk) {
      logger.error('Algumas configurações críticas estão incorretas!');
      process.exit(1);
    }

    // Resumo Final
    logger.section('📊 RESUMO');
    
    const updated = results.filter(r => r.action === 'updated');
    const inserted = results.filter(r => r.action === 'inserted');
    
    logger.success(`${updated.length} configurações atualizadas`);
    logger.success(`${inserted.length} configurações criadas`);
    logger.info(`Total de mudanças: ${results.length}`);

    if (updated.length > 0) {
      logger.subsection('Configurações atualizadas:');
      updated.forEach(r => {
        logger.raw(`  • ${r.key}: "${r.oldValue}" → "${r.newValue}"`);
      });
    }

    if (inserted.length > 0) {
      logger.subsection('Configurações criadas:');
      inserted.forEach(r => {
        logger.raw(`  • ${r.key} = "${r.newValue}"`);
      });
    }

    logger.blank();
    logger.success('Atualização de configurações concluída!');
    
    logger.subsection('ℹ️  Sistema de Rating de Analistas:');
    logger.info('O sistema de rating está PREPARADO mas DESABILITADO por padrão.');
    logger.info('Para ativar quando necessário:');
    logger.raw('');
    logger.raw('  UPDATE system_config');
    logger.raw("  SET value = 'true'");
    logger.raw("  WHERE key = 'enable_analyst_rating';");
    logger.raw('');

  } catch (error: any) {
    logger.error('Erro durante atualização de configurações:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
updateConfigs();
