/**
 * Test Season 1 Import (Dry Run)
 * 
 * This script tests the import process for Season 1 data from Leaguepedia
 * without actually inserting data into the database (dry run mode).
 */

import { supabase } from '../src/config/supabase';
import axios from 'axios';

const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';
const TOURNAMENT_NAME = 'IDL Kings Lendas Season 1';

interface LeaguepediaMatch {
  Team1: string;
  Team2: string;
  DateTime_UTC: string;
  Team1Score: string;
  Team2Score: string;
  Winner: string;
  MatchId: string;
}

interface LeaguepediaScoreboardGame {
  Team1: string;
  Team2: string;
  Team1Players: string;
  Team2Players: string;
  Team1Score: string;
  Team2Score: string;
  DateTime_UTC: string;
  MatchId: string;
}

async function fetchLeaguepediaMatches(): Promise<LeaguepediaMatch[]> {
  console.log(`📥 Fetching matches for: ${TOURNAMENT_NAME}\n`);
  
  const query = `
    [[Tournament::${TOURNAMENT_NAME}]]
    |?Team1=Team1
    |?Team2=Team2
    |?DateTime UTC=DateTime_UTC
    |?Team1Score=Team1Score
    |?Team2Score=Team2Score
    |?Winner=Winner
    |?MatchId=MatchId
    |limit=500
  `;
  
  const params = {
    action: 'cargoquery',
    format: 'json',
    tables: 'MatchSchedule',
    fields: 'Team1, Team2, DateTime_UTC, Team1Score, Team2Score, Winner, MatchId',
    where: `Tournament="${TOURNAMENT_NAME}"`,
    limit: '500'
  };
  
  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params });
    
    if (!response.data?.cargoquery) {
      console.error('❌ No data returned from Leaguepedia');
      return [];
    }
    
    const matches = response.data.cargoquery.map((item: any) => item.title);
    console.log(`✅ Found ${matches.length} matches\n`);
    return matches;
  } catch (error: any) {
    console.error('❌ Error fetching matches:', error.message);
    return [];
  }
}

async function fetchMatchGameData(matchId: string): Promise<LeaguepediaScoreboardGame[]> {
  const params = {
    action: 'cargoquery',
    format: 'json',
    tables: 'ScoreboardGames',
    fields: 'Team1, Team2, Team1Players, Team2Players, Team1Score, Team2Score, DateTime_UTC, MatchId',
    where: `MatchId="${matchId}"`,
    limit: '10'
  };
  
  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params });
    
    if (!response.data?.cargoquery) {
      return [];
    }
    
    return response.data.cargoquery.map((item: any) => item.title);
  } catch (error: any) {
    console.error(`❌ Error fetching game data for ${matchId}:`, error.message);
    return [];
  }
}

async function testImport() {
  console.log('🧪 Season 1 Import Test (Dry Run)\n');
  console.log('=' + '='.repeat(59));
  console.log('⚠️  This is a DRY RUN - no data will be inserted');
  console.log('=' + '='.repeat(59));
  console.log('');
  
  // Step 1: Fetch current database state
  console.log('⏳ Step 1: Fetching current database state...\n');
  
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name');
  
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, team_id');
  
  if (teamsError || playersError) {
    console.error('❌ Error fetching database state');
    return;
  }
  
  console.log(`✅ Found ${teams?.length || 0} teams in database`);
  console.log(`✅ Found ${players?.length || 0} players in database\n`);
  
  // Create lookup maps
  const teamMap = new Map(teams?.map(t => [t.name.toLowerCase(), t.id]) || []);
  const playerMap = new Map(players?.map(p => [p.name.toLowerCase(), p.id]) || []);
  
  // Step 2: Fetch matches from Leaguepedia
  console.log('⏳ Step 2: Fetching matches from Leaguepedia...\n');
  
  const matches = await fetchLeaguepediaMatches();
  
  if (matches.length === 0) {
    console.error('❌ No matches found. Import test failed.');
    return;
  }
  
  // Step 3: Analyze first 3 matches in detail
  console.log('⏳ Step 3: Analyzing first 3 matches in detail...\n');
  
  const matchesToAnalyze = matches.slice(0, 3);
  
  for (let i = 0; i < matchesToAnalyze.length; i++) {
    const match = matchesToAnalyze[i];
    
    console.log(`\n📋 Match ${i + 1}/${matchesToAnalyze.length}`);
    console.log('-'.repeat(60));
    console.log(`Team 1: ${match.Team1}`);
    console.log(`Team 2: ${match.Team2}`);
    console.log(`Date: ${match.DateTime_UTC}`);
    console.log(`Score: ${match.Team1Score} - ${match.Team2Score}`);
    console.log(`Winner: ${match.Winner || 'N/A'}`);
    console.log(`Match ID: ${match.MatchId}`);
    
    // Check if teams exist in database
    const team1Id = teamMap.get(match.Team1.toLowerCase());
    const team2Id = teamMap.get(match.Team2.toLowerCase());
    
    console.log(`\nTeam Mapping:`);
    console.log(`  ${match.Team1}: ${team1Id ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`  ${match.Team2}: ${team2Id ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    // Fetch game data for this match
    if (match.MatchId) {
      console.log(`\nFetching game data...`);
      const gameData = await fetchMatchGameData(match.MatchId);
      
      if (gameData.length > 0) {
        console.log(`✅ Found ${gameData.length} game(s) for this match`);
        
        // Analyze first game
        const game = gameData[0];
        const team1Players = game.Team1Players.split(',').map(p => p.trim());
        const team2Players = game.Team2Players.split(',').map(p => p.trim());
        
        console.log(`\nPlayers in Game 1:`);
        console.log(`  Team 1 (${game.Team1}):`);
        team1Players.forEach(player => {
          const playerId = playerMap.get(player.toLowerCase());
          console.log(`    - ${player}: ${playerId ? '✅ FOUND' : '❌ NOT FOUND'}`);
        });
        
        console.log(`  Team 2 (${game.Team2}):`);
        team2Players.forEach(player => {
          const playerId = playerMap.get(player.toLowerCase());
          console.log(`    - ${player}: ${playerId ? '✅ FOUND' : '❌ NOT FOUND'}`);
        });
      } else {
        console.log(`⚠️  No game data found for this match`);
      }
    }
  }
  
  // Step 4: Summary
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 IMPORT TEST SUMMARY');
  console.log('=' + '='.repeat(59));
  console.log(`Total matches found: ${matches.length}`);
  console.log(`Teams in database: ${teams?.length || 0}`);
  console.log(`Players in database: ${players?.length || 0}`);
  
  // Check how many matches can be imported
  let importableMatches = 0;
  for (const match of matches) {
    const team1Id = teamMap.get(match.Team1.toLowerCase());
    const team2Id = teamMap.get(match.Team2.toLowerCase());
    if (team1Id && team2Id) {
      importableMatches++;
    }
  }
  
  console.log(`Importable matches: ${importableMatches}/${matches.length}`);
  
  if (importableMatches === matches.length) {
    console.log('\n✅ All matches can be imported!');
  } else {
    console.log(`\n⚠️  ${matches.length - importableMatches} matches have missing team mappings`);
  }
  
  console.log('\n📋 Next steps:');
  if (importableMatches > 0) {
    console.log('   1. Review the test results above');
    console.log('   2. Run: cd api && npx tsx scripts/import-season1-full.ts');
    console.log('   3. Verify imported data\n');
  } else {
    console.log('   1. Fix team/player mappings');
    console.log('   2. Run this test again\n');
  }
}

testImport().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
