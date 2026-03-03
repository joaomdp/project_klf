/**
 * Browse Recent Tournaments
 * 
 * Lists all recent tournaments to understand what's available in Leaguepedia
 */

import axios from 'axios';

const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';

async function browseTournaments() {
  console.log('🔍 Browsing Recent Tournaments in Leaguepedia\n');
  
  // Get recent tournaments
  const params = {
    action: 'cargoquery',
    format: 'json',
    tables: 'Tournaments',
    fields: 'Name, DateStart, DateEnd, League, Region',
    where: 'DateStart >= "2024-01-01"',
    limit: '100',
    order_by: 'DateStart DESC'
  };
  
  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params });
    
    if (response.data?.cargoquery && response.data.cargoquery.length > 0) {
      const tournaments = response.data.cargoquery.map((item: any) => item.title);
      
      console.log(`✅ Found ${tournaments.length} tournament(s) since 2024:\n`);
      
      // Group by region
      const byRegion: Record<string, any[]> = {};
      
      tournaments.forEach((t: any) => {
        const region = t.Region || 'Unknown';
        if (!byRegion[region]) {
          byRegion[region] = [];
        }
        byRegion[region].push(t);
      });
      
      // Show tournaments by region
      for (const [region, tourneys] of Object.entries(byRegion)) {
        console.log(`\n📍 ${region} (${tourneys.length} tournaments):`);
        console.log('='.repeat(60));
        
        tourneys.slice(0, 10).forEach((t: any, i: number) => {
          console.log(`${i + 1}. ${t.Name}`);
          console.log(`   Date: ${t.DateStart} to ${t.DateEnd}`);
          if (t.League) console.log(`   League: ${t.League}`);
          console.log('');
        });
        
        if (tourneys.length > 10) {
          console.log(`   ... and ${tourneys.length - 10} more\n`);
        }
      }
      
      // Look for Brazil-related tournaments
      console.log('\n🇧🇷 Searching specifically for Brazil-related tournaments:');
      console.log('='.repeat(60));
      
      const brazilTournaments = tournaments.filter((t: any) => 
        t.Region?.toLowerCase().includes('brazil') || 
        t.Region?.toLowerCase().includes('br') ||
        t.Name?.toLowerCase().includes('brazil') ||
        t.Name?.toLowerCase().includes('cblol') ||
        t.League?.toLowerCase().includes('brazil')
      );
      
      if (brazilTournaments.length > 0) {
        console.log(`\n✅ Found ${brazilTournaments.length} Brazil tournament(s):\n`);
        
        brazilTournaments.forEach((t: any, i: number) => {
          console.log(`${i + 1}. ${t.Name}`);
          console.log(`   Date: ${t.DateStart} to ${t.DateEnd}`);
          console.log(`   League: ${t.League || 'N/A'}`);
          console.log(`   Region: ${t.Region || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No Brazil-related tournaments found');
      }
      
    } else {
      console.log('⚠️  No tournaments found');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

browseTournaments().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
