/**
 * Find Correct Tournament Name
 * 
 * Searches for the correct tournament name in Leaguepedia for Kings Lendas Season 1
 */

import axios from 'axios';

const LEAGUEPEDIA_API = 'https://lol.fandom.com/api.php';

async function findTournament() {
  console.log('🔍 Searching for Kings Lendas tournaments in Leaguepedia\n');
  
  // Search for tournaments with "Kings Lendas" in the name
  const searchTerms = [
    'Kings Lendas',
    'IDL Kings',
    'Kings Lendas Season 1',
    'IDL Kings Lendas'
  ];
  
  for (const searchTerm of searchTerms) {
    console.log(`\n📋 Searching for: "${searchTerm}"`);
    console.log('-'.repeat(60));
    
    const params = {
      action: 'cargoquery',
      format: 'json',
      tables: 'Tournaments',
      fields: 'Name, DateStart, DateEnd, League, Region',
      where: `Name LIKE "%${searchTerm}%"`,
      limit: '50'
    };
    
    try {
      const response = await axios.get(LEAGUEPEDIA_API, { params });
      
      if (response.data?.cargoquery && response.data.cargoquery.length > 0) {
        const tournaments = response.data.cargoquery.map((item: any) => item.title);
        
        console.log(`✅ Found ${tournaments.length} tournament(s):\n`);
        
        tournaments.forEach((t: any, i: number) => {
          console.log(`${i + 1}. ${t.Name}`);
          console.log(`   Date: ${t.DateStart} to ${t.DateEnd}`);
          console.log(`   League: ${t.League || 'N/A'}`);
          console.log(`   Region: ${t.Region || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No tournaments found');
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }
  
  // Also try to find by date range - try 2024 first (maybe year was wrong)
  console.log('\n📋 Searching by date range (June-August 2024)');
  console.log('-'.repeat(60));
  
  const dateParams2024 = {
    action: 'cargoquery',
    format: 'json',
    tables: 'Tournaments',
    fields: 'Name, DateStart, DateEnd, League, Region',
    where: 'DateStart >= "2024-06-01" AND DateStart <= "2024-09-01"',
    limit: '50',
    order_by: 'DateStart'
  };
  
  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params: dateParams2024 });
    
    if (response.data?.cargoquery && response.data.cargoquery.length > 0) {
      const tournaments = response.data.cargoquery.map((item: any) => item.title);
      
      console.log(`✅ Found ${tournaments.length} tournament(s) in 2024:\n`);
      
      tournaments.forEach((t: any, i: number) => {
        console.log(`${i + 1}. ${t.Name}`);
        console.log(`   Date: ${t.DateStart} to ${t.DateEnd}`);
        console.log(`   League: ${t.League || 'N/A'}`);
        console.log(`   Region: ${t.Region || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No tournaments found in this date range (2024)');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  // Try 2025
  console.log('\n📋 Searching by date range (June-August 2025)');
  console.log('-'.repeat(60));
  
  const dateParams = {
    action: 'cargoquery',
    format: 'json',
    tables: 'Tournaments',
    fields: 'Name, DateStart, DateEnd, League, Region',
    where: 'DateStart >= "2025-06-01" AND DateStart <= "2025-09-01"',
    limit: '50',
    order_by: 'DateStart'
  };
  
  try {
    const response = await axios.get(LEAGUEPEDIA_API, { params: dateParams });
    
    if (response.data?.cargoquery && response.data.cargoquery.length > 0) {
      const tournaments = response.data.cargoquery.map((item: any) => item.title);
      
      console.log(`✅ Found ${tournaments.length} tournament(s) in this period:\n`);
      
      tournaments.forEach((t: any, i: number) => {
        console.log(`${i + 1}. ${t.Name}`);
        console.log(`   Date: ${t.DateStart} to ${t.DateEnd}`);
        console.log(`   League: ${t.League || 'N/A'}`);
        console.log(`   Region: ${t.Region || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No tournaments found in this date range');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

findTournament().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
