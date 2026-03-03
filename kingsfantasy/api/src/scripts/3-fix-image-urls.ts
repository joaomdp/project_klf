// Script 3: Converter URLs de imagens de relativas para absolutas
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { ImageUrlFixResult } from './utils/types';

async function fixImageUrls() {
  logger.box([
    '🖼️  Kings Lendas Fantasy - Image URL Fixer',
    'Convertendo URLs relativas para absolutas...',
  ]);

  const results: ImageUrlFixResult[] = [];

  try {
    // FASE 1: Corrigir URLs dos Times
    logger.section('FASE 1: Corrigindo URLs dos Times');
    
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*');
    
    if (teamsError) throw teamsError;
    
    if (!teams || teams.length === 0) {
      logger.warning('Nenhum time encontrado!');
    } else {
      logger.info(`${teams.length} times encontrados`);
      
      let teamsFixed = 0;
      let teamsSkipped = 0;

      for (const team of teams) {
        // Verificar se URL já é absoluta
        if (team.logo_url && team.logo_url.startsWith('http')) {
          logger.item(`${team.name} - URL já absoluta, pulando`, 'info');
          teamsSkipped++;
          continue;
        }

        // Construir URL absoluta
        const filename = team.logo_url || `${team.name.toLowerCase().replace(/\s+/g, '')}-logo.png`;
        const newUrl = `${constants.SUPABASE_STORAGE_URL}/${constants.TEAMS_BUCKET}/${filename}`;

        // Atualizar no banco
        const { error } = await supabase
          .from('teams')
          .update({ logo_url: newUrl })
          .eq('id', team.id);

        if (error) {
          logger.error(`Erro ao atualizar ${team.name}: ${error.message}`);
        } else {
          logger.item(`${team.name} - Atualizado`, 'success');
          teamsFixed++;
          
          results.push({
            type: 'team',
            id: team.id,
            name: team.name,
            oldUrl: team.logo_url || '',
            newUrl,
          });
        }
      }

      logger.success(`Times corrigidos: ${teamsFixed}`);
      logger.info(`Times pulados (já corretos): ${teamsSkipped}`);
    }

    // FASE 2: Corrigir URLs dos Jogadores
    logger.section('FASE 2: Corrigindo URLs dos Jogadores');
    
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');
    
    if (playersError) throw playersError;
    
    if (!players || players.length === 0) {
      logger.warning('Nenhum jogador encontrado!');
    } else {
      logger.info(`${players.length} jogadores encontrados`);
      
      let playersFixed = 0;
      let playersSkipped = 0;

      for (const player of players) {
        // Verificar se URL já é absoluta
        if (player.image && player.image.startsWith('http')) {
          playersSkipped++;
          continue;
        }

        // Construir URL absoluta
        const filename = player.image || `${player.name.toLowerCase()}.webp`;
        const newUrl = `${constants.SUPABASE_STORAGE_URL}/${constants.PLAYERS_BUCKET}/${filename}`;

        // Atualizar no banco
        const { error } = await supabase
          .from('players')
          .update({ image: newUrl })
          .eq('id', player.id);

        if (error) {
          logger.error(`Erro ao atualizar ${player.name}: ${error.message}`);
        } else {
          playersFixed++;
          
          results.push({
            type: 'player',
            id: player.id,
            name: player.name,
            oldUrl: player.image || '',
            newUrl,
          });
        }
      }

      logger.success(`Jogadores corrigidos: ${playersFixed}`);
      logger.info(`Jogadores pulados (já corretos): ${playersSkipped}`);
    }

    // Resumo Final
    logger.section('📊 RESUMO');
    
    const teamResults = results.filter(r => r.type === 'team');
    const playerResults = results.filter(r => r.type === 'player');
    
    logger.info(`Total de URLs corrigidas: ${results.length}`);
    logger.raw(`  • Times: ${teamResults.length}`);
    logger.raw(`  • Jogadores: ${playerResults.length}`);

    if (results.length > 0) {
      logger.subsection('Exemplos de conversão:');
      
      if (teamResults.length > 0) {
        const example = teamResults[0];
        logger.raw(`  ANTES: ${example.oldUrl || '(vazio)'}`);
        logger.raw(`  DEPOIS: ${example.newUrl}`);
      }
    }

    logger.blank();
    logger.success('Correção de URLs concluída com sucesso!');

  } catch (error: any) {
    logger.error('Erro durante correção de URLs:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
fixImageUrls();
