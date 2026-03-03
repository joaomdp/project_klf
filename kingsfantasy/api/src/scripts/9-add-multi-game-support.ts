// Script 9: Adicionar suporte a partidas com múltiplos jogos
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';

async function addMultiGameSupport() {
  logger.box([
    '🎮 Kings Lendas Fantasy - Multi-game Support',
    'Preparando colunas e tabela para partidas com múltiplos jogos...',
  ]);

  try {
    logger.section('FASE 1: Verificando estrutura existente');

    let matchesHasGamesCount = false;
    let performancesHasGameNumber = false;
    let cardTableExists = false;

    try {
      const { error } = await supabase
        .from('matches')
        .select('games_count')
        .limit(1);
      if (!error) matchesHasGamesCount = true;
    } catch (checkError: any) {
      if (!String(checkError?.message || '').includes('games_count')) throw checkError;
    }

    try {
      const { error } = await supabase
        .from('player_performances')
        .select('game_number')
        .limit(1);
      if (!error) performancesHasGameNumber = true;
    } catch (checkError: any) {
      if (!String(checkError?.message || '').includes('game_number')) throw checkError;
    }

    try {
      const { error } = await supabase
        .from('player_card_points')
        .select('id')
        .limit(1);
      if (!error) cardTableExists = true;
    } catch (checkError: any) {
      if (!String(checkError?.message || '').includes('player_card_points')) throw checkError;
    }

    if (matchesHasGamesCount && performancesHasGameNumber && cardTableExists) {
      logger.success('Estrutura já existe. Nada a fazer.');
      return;
    }

    logger.section('FASE 2: SQL para criação manual');
    logger.warning('⚠️  Execute o SQL no Supabase SQL Editor:');
    logger.blank();
    logger.raw('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.raw('');
    logger.raw('-- Adicionar games_count em matches');
    logger.raw('ALTER TABLE matches');
    logger.raw('ADD COLUMN IF NOT EXISTS games_count INTEGER NOT NULL DEFAULT 1;');
    logger.raw('');
    logger.raw('-- Adicionar game_number em player_performances');
    logger.raw('ALTER TABLE player_performances');
    logger.raw('ADD COLUMN IF NOT EXISTS game_number INTEGER NOT NULL DEFAULT 1;');
    logger.raw('');
    logger.raw('-- Criar tabela player_card_points');
    logger.raw('CREATE TABLE IF NOT EXISTS player_card_points (');
    logger.raw('  id BIGSERIAL PRIMARY KEY,');
    logger.raw('  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,');
    logger.raw('  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,');
    logger.raw('  card_points DECIMAL(10,2) NOT NULL DEFAULT 0,');
    logger.raw('  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    logger.raw(');');
    logger.raw('');
    logger.raw('-- Evitar duplicidade por partida/jogador');
    logger.raw('CREATE UNIQUE INDEX IF NOT EXISTS player_card_points_match_player_idx');
    logger.raw('ON player_card_points (match_id, player_id);');
    logger.raw('');
    logger.raw('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.blank();

    logger.info('Após executar o SQL acima, rode este script novamente para validar.');
  } catch (error) {
    logger.error('Erro ao preparar suporte multi-game');
    logger.error(String(error));
  }
}

addMultiGameSupport();
