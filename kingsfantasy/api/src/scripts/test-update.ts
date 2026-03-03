// Test script to verify we can update player prices
import { supabase } from '../config/supabase';

async function testUpdate() {
  console.log('Testing player price update...\n');
  
  // Get one player
  const { data: players, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .limit(1);
  
  if (fetchError) {
    console.error('Error fetching player:', fetchError);
    return;
  }
  
  if (!players || players.length === 0) {
    console.error('No players found');
    return;
  }
  
  const player = players[0];
  console.log('Player before update:');
  console.log(`  ID: ${player.id}`);
  console.log(`  Name: ${player.name}`);
  console.log(`  Price: ${player.price}`);
  
  // Try to update price
  const newPrice = player.price + 0.1;
  console.log(`\nAttempting to update price to: ${newPrice}`);
  
  const { data: updateResult, error: updateError } = await supabase
    .from('players')
    .update({ price: newPrice })
    .eq('id', player.id)
    .select();
  
  if (updateError) {
    console.error('\n❌ Update failed:');
    console.error(updateError);
    return;
  }
  
  console.log('\n✅ Update succeeded');
  console.log('Updated data:', updateResult);
  
  // Verify by fetching again
  const { data: verifyData } = await supabase
    .from('players')
    .select('price')
    .eq('id', player.id)
    .single();
  
  console.log(`\nVerification: Price is now ${verifyData?.price}`);
  console.log(verifyData?.price === newPrice ? '✅ Update confirmed' : '❌ Update not persisted');
}

testUpdate();
