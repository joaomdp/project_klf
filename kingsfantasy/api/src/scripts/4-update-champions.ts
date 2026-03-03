// Script 4: Atualizar campeões do Data Dragon (Riot API)
import axios from 'axios';
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { DataDragonResponse, ChampionUpdateResult } from './utils/types';

async function updateChampions() {
  logger.box([
    '🎮 Kings Lendas Fantasy - Champions Update',
    'Buscando campeões do Riot Data Dragon...',
  ]);

  const results: ChampionUpdateResult[] = [];

  try {
    // FASE 1: Buscar versão mais recente do Data Dragon
    logger.section('FASE 1: Buscando Versão Mais Recente');
    
    const versionsResponse = await axios.get(constants.DDRAGON_VERSIONS_URL);
    const latestVersion = versionsResponse.data[0];
    
    logger.success(`Versão mais recente: ${latestVersion}`);

    // FASE 2: Buscar dados de campeões (pt_BR)
    logger.section('FASE 2: Buscando Dados de Campeões (Português)');
    
    const championsUrl = constants.DDRAGON_CHAMPION_DATA_URL(latestVersion);
    logger.info(`URL: ${championsUrl}`);
    
    const championsResponse = await axios.get<DataDragonResponse>(championsUrl);
    const championsData = championsResponse.data.data;
    
    const totalChampions = Object.keys(championsData).length;
    logger.success(`${totalChampions} campeões encontrados no Data Dragon`);

    // FASE 3: Buscar campeões existentes no banco
    logger.section('FASE 3: Comparando com Banco de Dados');
    
    const { data: existingChampions, error: fetchError } = await supabase
      .from('champions')
      .select('key_name');
    
    if (fetchError) throw fetchError;
    
    const existingIds = new Set(existingChampions?.map(c => c.key_name) || []);
    logger.info(`${existingIds.size} campeões já existem no banco`);

    // FASE 4: Identificar e inserir novos campeões
    logger.section('FASE 4: Inserindo Novos Campeões');
    
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [championId, championData] of Object.entries(championsData)) {
      // Verificar se já existe
      if (existingIds.has(championId)) {
        skippedCount++;
        continue;
      }

      // Construir URL da imagem
      const imageUrl = constants.DDRAGON_CHAMPION_IMAGE_URL(latestVersion, championData.image.full);
      const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`;

      // Inserir no banco
      const { error } = await supabase
        .from('champions')
        .insert({
          key_name: championId,
          name: championData.name,
          image_url: imageUrl,
          splash_url: splashUrl,
          roles: championData.tags || [],
        });

      if (error) {
        logger.error(`Erro ao inserir ${championData.name}: ${error.message}`);
        errorCount++;
        
        results.push({
          championId,
          name: championData.name,
          action: 'skipped',
          imageUrl,
        });
      } else {
        logger.success(`${championData.name} (${championId}) inserido`);
        insertedCount++;
        
        results.push({
          championId,
          name: championData.name,
          action: 'inserted',
          imageUrl,
        });
      }
    }

    // FASE 5: Verificar campeões específicos faltantes
    logger.section('FASE 5: Verificando Campeões Faltantes Específicos');
    
    const missingChampions = constants.MISSING_CHAMPIONS;
    logger.info(`Verificando: ${missingChampions.join(', ')}`);

    for (const championName of missingChampions) {
      // Buscar no Data Dragon (case-insensitive)
      const found = Object.entries(championsData).find(([id, data]) => 
        data.name.toLowerCase() === championName.toLowerCase() ||
        id.toLowerCase() === championName.toLowerCase()
      );

      if (found) {
        const [id, data] = found;
        const inserted = results.find(r => r.championId === id && r.action === 'inserted');
        
        if (inserted) {
          logger.success(`${championName} ✓ Inserido`);
        } else if (existingIds.has(id)) {
          logger.info(`${championName} ✓ Já existia no banco`);
        }
      } else {
        logger.warning(`${championName} ✗ Não encontrado no Data Dragon`);
      }
    }

    // Resumo Final
    logger.section('📊 RESUMO');
    
    logger.info(`Campeões no Data Dragon: ${totalChampions}`);
    logger.info(`Campeões já existentes: ${existingIds.size}`);
    logger.success(`Novos campeões inseridos: ${insertedCount}`);
    logger.info(`Campeões pulados: ${skippedCount}`);
    
    if (errorCount > 0) {
      logger.error(`Erros durante inserção: ${errorCount}`);
    }

    // Verificar total final
    const { data: finalChampions, error: finalError } = await supabase
      .from('champions')
      .select('key_name');
    
    if (finalError) throw finalError;
    
    const finalCount = finalChampions?.length || 0;
    logger.info(`Total final no banco: ${finalCount}/${constants.TOTAL_CHAMPIONS_EXPECTED}`);

    if (finalCount >= constants.TOTAL_CHAMPIONS_EXPECTED) {
      logger.success('✅ Todos os campeões esperados estão no banco!');
    } else {
      const missing = constants.TOTAL_CHAMPIONS_EXPECTED - finalCount;
      logger.warning(`⚠️  Ainda faltam ${missing} campeões`);
    }

    if (insertedCount > 0) {
      logger.subsection('Campeões inseridos:');
      results.filter(r => r.action === 'inserted').slice(0, 10).forEach(r => {
        logger.raw(`  • ${r.name} (${r.championId})`);
      });
      
      if (insertedCount > 10) {
        logger.raw(`  ... e mais ${insertedCount - 10} campeões`);
      }
    }

    logger.blank();
    logger.success('Atualização de campeões concluída!');

  } catch (error: any) {
    logger.error('Erro durante atualização de campeões:');
    logger.error(error.message);
    
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`URL: ${error.config?.url}`);
    }
    
    process.exit(1);
  }
}

// Executar
updateChampions();
