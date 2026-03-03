import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

interface LeaguepediaTeam {
  Name: string;
}

const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';

/**
 * Fetch all teams from Leaguepedia for a specific tournament
 */
async function fetchTeams(overviewPage: string): Promise<string[]> {
  console.log(`📡 Fetching teams for: ${overviewPage}`);
  
  const params = {
    action: 'cargoquery',
    format: 'json',
    tables: 'Teams',
    fields: 'Name',
    where: `OverviewPage="${overviewPage}"`,
    limit: 50
  };

  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params });
    
    if (!response.data.cargoquery) {
      throw new Error('No cargoquery data in response');
    }
    
    const teams: string[] = response.data.cargoquery.map((item: any) => item.title.Name as string);
    const uniqueTeams: string[] = [...new Set(teams)]; // Remove duplicates
    
    return uniqueTeams;
  } catch (error: any) {
    console.error('❌ Error fetching teams:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Kings Lendas Season 1 - Team Fetcher\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const overviewPage = 'IDL Kings Lendas Season 1';
  
  try {
    const teams = await fetchTeams(overviewPage);
    
    console.log(`\n✅ Found ${teams.length} teams:\n`);
    teams.forEach((team, i) => {
      console.log(`   ${i + 1}. ${team}`);
    });
    
    // Save to file
    const outputPath = path.join(__dirname, 'teams-season3.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(teams, null, 2),
      'utf-8'
    );
    
    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return teams;
  } catch (error: any) {
    console.error('\n❌ Failed to fetch teams:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { fetchTeams };
