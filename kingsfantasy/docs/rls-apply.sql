-- ============================================================================
-- RLS APPLY SCRIPT — Kings Lendas Fantasy
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Abra Supabase Dashboard → SQL Editor
-- 2. Cole este arquivo inteiro
-- 3. Clique em RUN
-- 4. Depois rode docs/rls-audit.sql pra confirmar que todas as tabelas
--    estão com status "✅ OK"
--
-- Este script é IDEMPOTENTE — pode rodar várias vezes sem efeito colateral.
-- CREATE POLICY IF NOT EXISTS não existe no Postgres, então usamos DROP + CREATE.
-- ============================================================================

BEGIN;

-- ============================================================================
-- user_teams — usuário só escreve o próprio time, leitura é pública (ranking)
-- ============================================================================
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_teams_select_public" ON public.user_teams;
CREATE POLICY "user_teams_select_public"
  ON public.user_teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "user_teams_insert_own" ON public.user_teams;
CREATE POLICY "user_teams_insert_own"
  ON public.user_teams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_teams_update_own" ON public.user_teams;
CREATE POLICY "user_teams_update_own"
  ON public.user_teams FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_teams_delete_own" ON public.user_teams;
CREATE POLICY "user_teams_delete_own"
  ON public.user_teams FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- players / teams / matches / rounds / champions — read-only público
-- (escrita só via service_role no backend — service_role bypassa RLS)
-- ============================================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_read_all" ON public.players;
CREATE POLICY "players_read_all" ON public.players FOR SELECT USING (true);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_read_all" ON public.teams;
CREATE POLICY "teams_read_all" ON public.teams FOR SELECT USING (true);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_read_all" ON public.matches;
CREATE POLICY "matches_read_all" ON public.matches FOR SELECT USING (true);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rounds_read_all" ON public.rounds;
CREATE POLICY "rounds_read_all" ON public.rounds FOR SELECT USING (true);

ALTER TABLE public.champions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "champions_read_all" ON public.champions;
CREATE POLICY "champions_read_all" ON public.champions FOR SELECT USING (true);

ALTER TABLE public.round_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "round_scores_read_all" ON public.round_scores;
CREATE POLICY "round_scores_read_all" ON public.round_scores FOR SELECT USING (true);

ALTER TABLE public.player_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_performances_read_all" ON public.player_performances;
CREATE POLICY "player_performances_read_all" ON public.player_performances FOR SELECT USING (true);

-- system_config (nome correto da tabela usada em server.ts)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_config_read_all" ON public.system_config;
CREATE POLICY "system_config_read_all" ON public.system_config FOR SELECT USING (true);

-- ============================================================================
-- leagues / league_members — leitura pública, criação autenticada
-- ============================================================================
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leagues_read_all" ON public.leagues;
CREATE POLICY "leagues_read_all"
  ON public.leagues FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "leagues_insert_authenticated" ON public.leagues;
CREATE POLICY "leagues_insert_authenticated"
  ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "leagues_update_creator" ON public.leagues;
CREATE POLICY "leagues_update_creator"
  ON public.leagues FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "leagues_delete_creator" ON public.leagues;
CREATE POLICY "leagues_delete_creator"
  ON public.leagues FOR DELETE
  USING (auth.uid() = created_by);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_members_read_all" ON public.league_members;
CREATE POLICY "league_members_read_all"
  ON public.league_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "league_members_insert_self" ON public.league_members;
CREATE POLICY "league_members_insert_self"
  ON public.league_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "league_members_delete_self" ON public.league_members;
CREATE POLICY "league_members_delete_self"
  ON public.league_members FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- otp_codes — tabela para armazenamento persistente de códigos OTP
-- (substitui o Map em memória do server.ts)
-- Apenas service_role lê/escreve; anon não tem acesso nenhum.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.otp_codes (
  email       text        PRIMARY KEY,
  code        text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- Sem policy = anon não vê nada. service_role (backend) bypassa RLS.

COMMIT;

-- ============================================================================
-- Depois de rodar: re-execute docs/rls-audit.sql e confirme todas "✅ OK".
-- ============================================================================
