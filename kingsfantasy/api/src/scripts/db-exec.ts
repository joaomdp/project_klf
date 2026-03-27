/**
 * DB-EXEC: Executor de queries no Supabase via adminSupabase
 *
 * Uso: npx ts-node src/scripts/db-exec.ts
 *
 * Este script executa o reset completo OU queries ad-hoc
 * usando o client adminSupabase (service_role_key) que já existe no projeto.
 */
import { adminSupabase } from '../config/supabase';

// ─── Helpers ────────────────────────────────────────────
async function query(table: string, select = '*', filters?: Record<string, any>) {
  let q = adminSupabase.from(table).select(select);
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      q = q.eq(key, value);
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function count(table: string) {
  const { count: c, error } = await adminSupabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return c || 0;
}

// ─── Reset Completo ─────────────────────────────────────
async function resetToInitialState() {
  console.log('\n🔄 RESET COMPLETO - Voltando ao estado inicial...\n');

  // 1. Remover round_scores
  console.log('1️⃣  Removendo round_scores...');
  const { error: e1 } = await adminSupabase.from('round_scores').delete().neq('id', 0);
  if (e1) console.error('   ❌', e1.message);
  else console.log(`   ✅ round_scores limpos`);

  // 2. Remover champion_usage
  console.log('2️⃣  Removendo champion_usage...');
  const { data: cuRows } = await adminSupabase.from('champion_usage').select('player_id').limit(1);
  if (cuRows && cuRows.length > 0) {
    const { error: e2 } = await adminSupabase.from('champion_usage').delete().not('player_id', 'is', null);
    if (e2) console.error('   ❌', e2.message);
    else console.log(`   ✅ champion_usage limpos`);
  } else {
    console.log(`   ✅ champion_usage já vazio`);
  }

  // 3. Rebalancear preços dos jogadores (8-15)
  console.log('3️⃣  Rebalanceando preços dos jogadores (8 - 15)...');
  const { data: players, error: e3 } = await adminSupabase.from('players').select('id, price').order('price', { ascending: true });
  if (e3) throw e3;

  if (players && players.length > 0) {
    const prices = players.map(p => Number(p.price));
    const currentMin = Math.min(...prices);
    const currentMax = Math.max(...prices);
    const currentRange = currentMax - currentMin;
    const newMin = 8, newMax = 15, newRange = 7;

    console.log(`   Range atual: [${currentMin}, ${currentMax}]`);

    let updated = 0;
    for (const player of players) {
      const oldPrice = Number(player.price);
      const newPrice = currentRange > 0
        ? parseFloat((newMin + ((oldPrice - currentMin) / currentRange) * newRange).toFixed(1))
        : 11.5;

      const { error } = await adminSupabase.from('players').update({ price: newPrice, points: 0, avg_points: 0 }).eq('id', player.id);
      if (!error) updated++;
    }
    console.log(`   ✅ ${updated}/${players.length} jogadores rebalanceados [8, 15]`);
  }

  // 4. Sincronizar preços no lineup JSON dos user_teams
  console.log('4️⃣  Sincronizando preços nos lineups...');
  const { data: freshPlayers } = await adminSupabase.from('players').select('id, price');
  const priceMap = new Map((freshPlayers || []).map(p => [String(p.id), Number(p.price)]));

  const { data: teams, error: e4 } = await adminSupabase.from('user_teams').select('id, lineup');
  if (e4) throw e4;

  let lineupsSynced = 0;
  for (const team of (teams || [])) {
    const lineup = team.lineup || {};
    if (Object.keys(lineup).length === 0) continue;

    const updatedLineup: Record<string, any> = {};
    let changed = false;

    for (const [role, player] of Object.entries(lineup) as [string, any][]) {
      if (!player || !player.id) {
        updatedLineup[role] = player;
        continue;
      }
      const realPrice = priceMap.get(String(player.id));
      if (realPrice !== undefined && realPrice !== Number(player.price)) {
        updatedLineup[role] = { ...player, price: realPrice };
        changed = true;
      } else {
        updatedLineup[role] = player;
      }
    }

    if (changed) {
      await adminSupabase.from('user_teams').update({ lineup: updatedLineup }).eq('id', team.id);
      lineupsSynced++;
    }
  }
  console.log(`   ✅ ${lineupsSynced} lineups atualizados com preços reais`);

  // 5. Resetar user_teams (budget, pontos)
  console.log('5️⃣  Resetando user_teams (budget=60, pontos=0)...');
  const { error: e5 } = await adminSupabase
    .from('user_teams')
    .update({ budget: 60, total_points: 0 })
    .neq('id', 0);
  if (e5) console.error('   ❌', e5.message);
  else console.log(`   ✅ user_teams resetados`);

  // 6. Resetar rodadas
  console.log('6️⃣  Resetando rodadas (status=upcoming, mercado fechado)...');
  const { error: e6 } = await adminSupabase
    .from('rounds')
    .update({ status: 'upcoming', is_market_open: false, updated_at: new Date().toISOString() })
    .neq('id', 0);
  if (e6) console.error('   ❌', e6.message);
  else console.log(`   ✅ rodadas resetadas`);

  // 7. Limpar snapshots
  console.log('7️⃣  Limpando snapshots...');
  const { error: e7 } = await adminSupabase.from('system_config').delete().like('key', 'snapshot_round_%');
  if (e7) console.error('   ❌', e7.message);
  else console.log(`   ✅ snapshots removidos`);

  // 8. Verificação final
  console.log('\n📊 VERIFICAÇÃO FINAL:');

  const playerCount = await count('players');
  const { data: priceStats } = await adminSupabase.from('players').select('price');
  const allPrices = (priceStats || []).map(p => Number(p.price));
  console.log(`   Players: ${playerCount} | Preços: [${Math.min(...allPrices)}, ${Math.max(...allPrices)}]`);

  const teamCount = await count('user_teams');
  const { data: budgetCheck } = await adminSupabase.from('user_teams').select('budget, total_points');
  const allBudget60 = (budgetCheck || []).every(t => Number(t.budget) === 60);
  const allPoints0 = (budgetCheck || []).every(t => Number(t.total_points) === 0);
  console.log(`   User Teams: ${teamCount} | Budget=60: ${allBudget60 ? '✅' : '❌'} | Points=0: ${allPoints0 ? '✅' : '❌'}`);

  const roundCount = await count('rounds');
  const scoreCount = await count('round_scores');
  console.log(`   Rounds: ${roundCount} | Round Scores: ${scoreCount}`);

  console.log('\n✅ RESET COMPLETO!\n');
}

// ─── Entry Point ────────────────────────────────────────
const command = process.argv[2] || 'reset';

(async () => {
  try {
    switch (command) {
      case 'reset':
        await resetToInitialState();
        break;
      default:
        console.log('Comandos disponíveis: reset');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  process.exit(0);
})();
