-- ============================================================================
-- RLS AUDIT SCRIPT — Kings Lendas Fantasy
-- Rode no SQL Editor do Supabase (https://supabase.com/dashboard → SQL)
-- ============================================================================
-- Tabelas acessadas diretamente pelo frontend com ANON_KEY:
--   user_teams, players, teams, matches, leagues, league_members,
--   round_scores, player_performances
--
-- Se qualquer uma destas NÃO tiver RLS habilitada, a ANON_KEY permite
-- leitura/escrita ampla. Este script diagnostica o estado atual.
-- ============================================================================


-- 1. Status RLS de cada tabela sensível
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ OK'
    ELSE '❌ CRÍTICO — HABILITAR'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_teams', 'players', 'teams', 'matches', 'leagues',
    'league_members', 'round_scores', 'player_performances',
    'rounds', 'champions', 'config'
  )
ORDER BY rowsecurity, tablename;


-- 2. Listar todas as policies existentes
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS operation,
  roles,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- 3. Tabelas SEM nenhuma policy (mesmo com RLS habilitada fica inacessível)
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename
  AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;


-- ============================================================================
-- POLICIES RECOMENDADAS (descomente e rode APÓS revisar)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────
-- user_teams: usuário só lê/escreve o próprio time
-- ──────────────────────────────────────────────────────────────────────
-- ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "user_teams_select_public"
--   ON public.user_teams FOR SELECT
--   USING (true); -- ranking/ligas precisam ler times públicos
--
-- CREATE POLICY "user_teams_insert_own"
--   ON public.user_teams FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "user_teams_update_own"
--   ON public.user_teams FOR UPDATE
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "user_teams_delete_own"
--   ON public.user_teams FOR DELETE
--   USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────
-- players / teams / matches / rounds / champions / config: read-only público
-- (escrita só via service_role no backend)
-- ──────────────────────────────────────────────────────────────────────
-- ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "players_read_all" ON public.players FOR SELECT USING (true);
--
-- ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "teams_read_all" ON public.teams FOR SELECT USING (true);
--
-- ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "matches_read_all" ON public.matches FOR SELECT USING (true);
--
-- ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "rounds_read_all" ON public.rounds FOR SELECT USING (true);
--
-- ALTER TABLE public.champions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "champions_read_all" ON public.champions FOR SELECT USING (true);
--
-- ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "config_read_all" ON public.config FOR SELECT USING (true);
--
-- ALTER TABLE public.round_scores ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "round_scores_read_all" ON public.round_scores FOR SELECT USING (true);
--
-- ALTER TABLE public.player_performances ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "player_performances_read_all" ON public.player_performances FOR SELECT USING (true);


-- ──────────────────────────────────────────────────────────────────────
-- leagues / league_members: leitura pública, membro só gerencia si mesmo
-- ──────────────────────────────────────────────────────────────────────
-- ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "leagues_read_all" ON public.leagues FOR SELECT USING (true);
-- CREATE POLICY "leagues_insert_authenticated"
--   ON public.leagues FOR INSERT
--   WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);
-- CREATE POLICY "leagues_update_creator"
--   ON public.leagues FOR UPDATE
--   USING (auth.uid() = created_by);
--
-- ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "league_members_read_all"
--   ON public.league_members FOR SELECT USING (true);
-- CREATE POLICY "league_members_insert_self"
--   ON public.league_members FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "league_members_delete_self"
--   ON public.league_members FOR DELETE
--   USING (auth.uid() = user_id);


-- ============================================================================
-- Depois de aplicar: re-rodar a query #1 e confirmar que TODAS as tabelas
-- retornam ✅ OK.
-- ============================================================================
