-- ============================================
-- RESET COMPLETO - Volta ao estado inicial
-- Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. REMOVER TODOS OS SCORES DE RODADAS
-- ============================================
DELETE FROM round_scores;

-- ============================================
-- 2. REMOVER CHAMPION USAGE (tracking de campeões)
-- ============================================
DELETE FROM champion_usage;

-- ============================================
-- 3. RESETAR PREÇOS DOS JOGADORES
--    Rebalanceia proporcionalmente para 8-15
--    usando a mesma lógica do script 2-rebalance-prices.ts
-- ============================================
DO $$
DECLARE
  current_min NUMERIC;
  current_max NUMERIC;
  current_range NUMERIC;
  new_min NUMERIC := 8;
  new_max NUMERIC := 15;
  new_range NUMERIC := 7;
BEGIN
  SELECT MIN(price), MAX(price) INTO current_min, current_max FROM players;
  current_range := current_max - current_min;

  IF current_range > 0 THEN
    UPDATE players
    SET price = ROUND((new_min + ((price - current_min) / current_range) * new_range)::numeric, 1);
  ELSE
    -- Se todos os preços são iguais, colocar no meio
    UPDATE players SET price = 11.5;
  END IF;

  RAISE NOTICE 'Preços rebalanceados: range anterior [%, %] → [8, 15]', current_min, current_max;
END $$;

-- ============================================
-- 4. RESETAR PONTUAÇÕES DOS JOGADORES
-- ============================================
UPDATE players
SET points = 0,
    avg_points = 0;

-- ============================================
-- 5. SINCRONIZAR PREÇOS NO JSON lineup DOS USER_TEAMS
--    O lineup é um JSON com formato: {"top": {"id": "123", "price": 10, ...}, ...}
--    Precisamos atualizar o campo "price" dentro de cada slot para bater com a tabela players
-- ============================================
DO $$
DECLARE
  team_record RECORD;
  updated_lineup JSONB;
  role_key TEXT;
  player_obj JSONB;
  player_id TEXT;
  real_price NUMERIC;
BEGIN
  FOR team_record IN SELECT id, lineup FROM user_teams WHERE lineup IS NOT NULL AND lineup::text != '{}' LOOP
    updated_lineup := team_record.lineup::jsonb;

    FOR role_key IN SELECT jsonb_object_keys(updated_lineup) LOOP
      player_obj := updated_lineup -> role_key;

      IF player_obj IS NOT NULL AND player_obj ->> 'id' IS NOT NULL THEN
        player_id := player_obj ->> 'id';

        SELECT price INTO real_price FROM players WHERE id::text = player_id;

        IF real_price IS NOT NULL THEN
          updated_lineup := jsonb_set(
            updated_lineup,
            ARRAY[role_key, 'price'],
            to_jsonb(real_price)
          );
        END IF;
      END IF;
    END LOOP;

    UPDATE user_teams SET lineup = updated_lineup WHERE id = team_record.id;
  END LOOP;

  RAISE NOTICE 'Preços nos lineups sincronizados com tabela players';
END $$;

-- ============================================
-- 6. RESETAR USER_TEAMS (budget, pontos)
-- ============================================
UPDATE user_teams
SET budget = 60,
    total_points = 0,
    current_round_points = 0;

-- ============================================
-- 7. RESETAR TODAS AS RODADAS
-- ============================================
UPDATE rounds
SET status = 'upcoming',
    is_market_open = false,
    updated_at = NOW();

-- ============================================
-- 8. LIMPAR SNAPSHOTS DO SYSTEM_CONFIG
-- ============================================
DELETE FROM system_config
WHERE key LIKE 'snapshot_round_%';

-- ============================================
-- 9. VERIFICAÇÃO FINAL
-- ============================================
SELECT 'players' AS tabela,
       COUNT(*) AS total,
       MIN(price) AS min_price,
       MAX(price) AS max_price,
       AVG(price)::numeric(5,2) AS avg_price
FROM players;

SELECT 'user_teams' AS tabela,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE budget = 60) AS budget_60,
       COUNT(*) FILTER (WHERE total_points = 0) AS points_zero
FROM user_teams;

SELECT 'rounds' AS tabela,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'upcoming') AS upcoming
FROM rounds;

SELECT 'round_scores' AS tabela, COUNT(*) AS total FROM round_scores;
SELECT 'champion_usage' AS tabela, COUNT(*) AS total FROM champion_usage;
SELECT 'snapshots_removidos' AS info, COUNT(*) AS total FROM system_config WHERE key LIKE 'snapshot_round_%';
