import { supabase } from '../config/supabase';

async function debug() {
  const { data: players, error } = await supabase
    .from('players')
    .select('*')
    .order('price');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const roles = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  let total = 0;
  
  console.log('Cheapest player per role (current prices):');
  for (const role of roles) {
    const p = players?.find(x => x.role === role);
    if (p) {
      console.log(`  ${role.padEnd(8)}: ${p.name.padEnd(15)} - ${p.price}`);
      total += p.price;
    }
  }
  console.log(`\nTotal: ${total}`);
  console.log(`Target budget: 100`);
  console.log(`Over budget by: ${total - 100}`);
  
  console.log('\n=== Price distribution ===');
  const prices = players?.map(p => p.price) || [];
  console.log(`Min: ${Math.min(...prices)}`);
  console.log(`Max: ${Math.max(...prices)}`);
  console.log(`Range: ${Math.max(...prices) - Math.min(...prices)}`);
}

debug();
