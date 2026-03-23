/**
 * RESET PERFORMANCES & MATCHES
 *
 * Limpa todos os dados de performances e partidas do banco,
 * zerando as estatísticas dos jogadores para começar do zero.
 *
 * Usage:
 *   npm run db:reset
 *
 * O que este script faz:
 *   1. Deleta todas as player_performances
 *   2. Deleta todas as matches
 *   3. Zera pontos/avg/kda de todos os jogadores
 *   4. Reseta status das rounds para 'upcoming'
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('\n🧹 ===== RESET DE PERFORMANCES E MATCHES =====\n');
  console.log('⚠️  Este script irá:');
  console.log('   1. Deletar TODAS as player_performances');
  console.log('   2. Deletar TODAS as matches');
  console.log('   3. Zerar pontos/avg/kda de todos os jogadores');
  console.log('   4. Resetar status das rounds para "upcoming"');
  console.log('\n   Aguarde 5 segundos para cancelar (Ctrl+C)...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 1: Deletar todas as performances
  console.log('🗑️  Step 1: Deletando player_performances...');
  const { error: perfError } = await adminSupabase
    .from('player_performances')
    .delete()
    .neq('id', 0); // Match all rows

  if (perfError) {
    console.error('❌ Erro ao deletar performances:', perfError.message);
    process.exit(1);
  }
  console.log(`   ✅ Performances deletadas`);

  // Step 2: Deletar todas as matches
  console.log('🗑️  Step 2: Deletando matches...');
  const { error: matchError } = await adminSupabase
    .from('matches')
    .delete()
    .neq('id', 0); // Match all rows

  if (matchError) {
    console.error('❌ Erro ao deletar matches:', matchError.message);
    process.exit(1);
  }
  console.log(`   ✅ Matches deletadas`);

  // Step 3: Zerar stats dos jogadores
  console.log('🔄 Step 3: Zerando estatísticas dos jogadores...');
  const { error: playersError } = await adminSupabase
    .from('players')
    .update({
      points: 0,
      avg_points: 0,
      kda: '0/0/0'
    })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all rows

  if (playersError) {
    console.error('❌ Erro ao zerar stats dos jogadores:', playersError.message);
    process.exit(1);
  }
  console.log('   ✅ Stats dos jogadores zeradas');

  // Step 4: Resetar rounds para upcoming
  console.log('🔄 Step 4: Resetando rounds para "upcoming"...');
  const { error: roundsError } = await adminSupabase
    .from('rounds')
    .update({ status: 'upcoming' })
    .neq('status', 'upcoming'); // Only update non-upcoming

  if (roundsError) {
    console.error('❌ Erro ao resetar rounds:', roundsError.message);
    process.exit(1);
  }
  console.log('   ✅ Rounds resetadas para "upcoming"');

  // Verificação final
  console.log('\n📊 Verificação final...');

  const { count: remainingPerf } = await adminSupabase
    .from('player_performances')
    .select('id', { count: 'exact', head: true });

  const { count: remainingMatches } = await adminSupabase
    .from('matches')
    .select('id', { count: 'exact', head: true });

  const { data: players } = await adminSupabase
    .from('players')
    .select('id, name, points, avg_points')
    .limit(5);

  console.log(`   Performances restantes: ${remainingPerf || 0}`);
  console.log(`   Matches restantes: ${remainingMatches || 0}`);
  console.log(`   Amostra de jogadores (primeiros 5):`);
  players?.forEach(p => {
    console.log(`     - ${p.name}: points=${p.points}, avg=${p.avg_points}`);
  });

  console.log('\n✅ Reset concluído! Banco limpo e pronto para importação.\n');
}

main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error.message);
  process.exit(1);
});
