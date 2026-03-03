import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

interface LeaguepediaPlayer {
  Link: string;      // Nome do jogador no Leaguepedia
  Team: string;      // Time atual
  Role: string;      // TOP/JUNGLE/MID/ADC/SUPPORT
}

const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';

/**
 * Fetch all players from Leaguepedia for a specific tournament
 */
async function fetchPlayers(overviewPage: string): Promise<LeaguepediaPlayer[]> {
  console.log(`📡 Fetching players for: ${overviewPage}`);
  
  const params = {
    action: 'cargoquery',
    format: 'json',
    tables: 'TournamentRosters',
    fields: 'Link,Team,Role',
    where: `OverviewPage="${overviewPage}"`,
    limit: 500
  };

  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params });
    
    if (!response.data.cargoquery) {
      throw new Error('No cargoquery data in response');
    }
    
    const players = response.data.cargoquery.map((item: any) => ({
      Link: item.title.Link as string,
      Team: item.title.Team as string,
      Role: item.title.Role as string
    }));
    
    return players;
  } catch (error: any) {
    console.error('❌ Error fetching players:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Kings Lendas Season 1 - Player Roster Fetcher\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const overviewPage = 'IDL Kings Lendas Season 1';
  
  try {
    const players = await fetchPlayers(overviewPage);
    
    console.log(`\n✅ Found ${players.length} players\n`);
    
    // Group by team
    const byTeam = players.reduce((acc, p) => {
      if (!acc[p.Team]) acc[p.Team] = [];
      acc[p.Team].push(p);
      return acc;
    }, {} as Record<string, LeaguepediaPlayer[]>);
    
    console.log('📊 Players by team:\n');
    Object.entries(byTeam).forEach(([team, teamPlayers]) => {
      console.log(`${team}:`);
      teamPlayers.forEach(p => {
        console.log(`  - ${p.Link.padEnd(20)} (${p.Role})`);
      });
      console.log('');
    });
    
    // Save to file
    const outputPath = path.join(__dirname, 'players-season3.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(players, null, 2),
      'utf-8'
    );
    
    console.log(`💾 Saved to: ${outputPath}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return players;
  } catch (error: any) {
    console.error('\n❌ Failed to fetch players:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { fetchPlayers, LeaguepediaPlayer };
