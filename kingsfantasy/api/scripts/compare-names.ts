import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from api directory
config({ path: resolve(__dirname, '../.env') });

import { supabase } from '../src/config/supabase';
import fs from 'fs/promises';
import path from 'path';
import levenshtein from 'fast-levenshtein';

interface LeaguepediaPlayer {
  Link: string;
  Team: string;
  Role: string;
}

interface DBPlayer {
  id: string;
  name: string;
  role: string;
  team_id: string;
  team_name?: string;
}

interface PlayerMatch {
  leaguepedia_name: string;
  leaguepedia_team: string;
  leaguepedia_role: string;
  db_name: string;
  db_id: string;
  db_team: string;
  db_role: string;
  confidence: number;
  match_type: 'exact' | 'fuzzy' | 'manual';
}

interface TeamMatch {
  leaguepedia_name: string;
  db_name: string;
  db_id: string;
  confidence: number;
}

/**
 * Normalize string for comparison (lowercase, remove accents, remove special chars)
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .replace(/[^a-z0-9]/g, '');       // Remove caracteres especiais
}

/**
 * Calculate confidence score for player match
 */
function calculatePlayerConfidence(
  lpName: string,
  dbName: string,
  lpTeam: string,
  dbTeam: string,
  lpRole: string,
  dbRole: string
): number {
  const lpNorm = normalize(lpName);
  const dbNorm = normalize(dbName);
  const lpTeamNorm = normalize(lpTeam);
  const dbTeamNorm = normalize(dbTeam);
  
  // Exact name match
  if (lpNorm === dbNorm) {
    if (lpTeamNorm === dbTeamNorm && lpRole.toUpperCase() === dbRole.toUpperCase()) {
      return 1.0; // 100% - nome, time e role idênticos
    }
    return 0.95; // 95% - nome idêntico, time/role diferente
  }
  
  // Fuzzy match baseado em Levenshtein distance
  const distance = levenshtein.get(lpNorm, dbNorm);
  const maxLen = Math.max(lpNorm.length, dbNorm.length);
  const similarity = 1 - (distance / maxLen);
  
  // Ajustar confidence baseado em time e role
  let confidence = similarity;
  
  if (lpTeamNorm === dbTeamNorm) {
    confidence += 0.1; // Bonus de 10% se mesmo time
  }
  
  if (lpRole.toUpperCase() === dbRole.toUpperCase()) {
    confidence += 0.05; // Bonus de 5% se mesma role
  }
  
  return Math.min(confidence, 0.99); // Max 99% para fuzzy
}

/**
 * Calculate confidence score for team match
 */
function calculateTeamConfidence(lpName: string, dbName: string): number {
  const lpNorm = normalize(lpName);
  const dbNorm = normalize(dbName);
  
  // Exact match
  if (lpNorm === dbNorm) {
    return 1.0;
  }
  
  // Fuzzy match
  const distance = levenshtein.get(lpNorm, dbNorm);
  const maxLen = Math.max(lpNorm.length, dbNorm.length);
  const similarity = 1 - (distance / maxLen);
  
  return Math.min(similarity, 0.99);
}

async function main() {
  console.log('🚀 Kings Lendas Season 1 - Name Comparison Tool\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // ===== LOAD DATA =====
    console.log('🔍 Loading data...\n');
    
    // Load Leaguepedia data
    const teamsPath = path.join(__dirname, 'teams-season3.json');
    const playersPath = path.join(__dirname, 'players-season3.json');
    
    const lpTeamsRaw = await fs.readFile(teamsPath, 'utf-8');
    const lpTeams: string[] = JSON.parse(lpTeamsRaw);
    
    const lpPlayersRaw = await fs.readFile(playersPath, 'utf-8');
    const lpPlayers: LeaguepediaPlayer[] = JSON.parse(lpPlayersRaw);
    
    // Load DB data
    const { data: dbTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');
    
    if (teamsError) throw teamsError;
    
    const { data: dbPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, name, role, team_id');
    
    if (playersError) throw playersError;
    
    // Enrich players with team names
    const teamMap = new Map(dbTeams?.map(t => [t.id, t.name]) || []);
    const enrichedDBPlayers: DBPlayer[] = (dbPlayers || []).map(p => ({
      ...p,
      team_name: teamMap.get(p.team_id) || 'Unknown'
    }));
    
    console.log('📊 Statistics:');
    console.log(`   Leaguepedia: ${lpTeams.length} teams, ${lpPlayers.length} players`);
    console.log(`   Database: ${dbTeams?.length || 0} teams, ${dbPlayers?.length || 0} players\n`);
    
    // ===== TEAM COMPARISON =====
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 TEAM COMPARISON\n');
    
    const teamMatches: TeamMatch[] = [];
    const unmatchedLPTeams: string[] = [];
    const unmatchedDBTeams: string[] = [];
    
    // Match Leaguepedia teams to DB
    lpTeams.forEach(lpTeam => {
      let bestMatch: TeamMatch | null = null;
      let bestConfidence = 0;
      
      dbTeams?.forEach(dbTeam => {
        const confidence = calculateTeamConfidence(lpTeam, dbTeam.name);
        
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            leaguepedia_name: lpTeam,
            db_name: dbTeam.name,
            db_id: dbTeam.id,
            confidence
          };
        }
      });
      
      if (bestMatch && bestConfidence >= 0.90) {
        teamMatches.push(bestMatch);
        const icon = bestConfidence >= 0.99 ? '✅' : '⚠️ ';
        const confidenceStr = `${Math.round(bestConfidence * 100)}%`;
        console.log(`${icon} ${lpTeam.padEnd(25)} → ${bestMatch.db_name.padEnd(25)} (${confidenceStr})`);
      } else {
        unmatchedLPTeams.push(lpTeam);
        console.log(`❌ ${lpTeam.padEnd(25)} → NO MATCH`);
      }
    });
    
    // Find DB teams not in Leaguepedia
    dbTeams?.forEach(dbTeam => {
      const matched = teamMatches.some(m => m.db_id === dbTeam.id);
      if (!matched) {
        unmatchedDBTeams.push(dbTeam.name);
      }
    });
    
    const exactTeamMatches = teamMatches.filter(m => m.confidence >= 0.99).length;
    const fuzzyTeamMatches = teamMatches.filter(m => m.confidence < 0.99).length;
    
    console.log(`\n📈 Team Match Rate: ${teamMatches.length}/${lpTeams.length} (${Math.round(teamMatches.length / lpTeams.length * 100)}%)`);
    console.log(`   Exact matches: ${exactTeamMatches}`);
    console.log(`   Fuzzy matches: ${fuzzyTeamMatches}`);
    
    if (unmatchedDBTeams.length > 0) {
      console.log(`\n⚠️  Teams in DB but not in Leaguepedia (should be deleted):`);
      unmatchedDBTeams.forEach(t => console.log(`   - ${t}`));
    }
    
    // ===== PLAYER COMPARISON =====
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 PLAYER COMPARISON\n');
    
    const playerMatches: PlayerMatch[] = [];
    const unmatchedLPPlayers: LeaguepediaPlayer[] = [];
    
    for (const lpPlayer of lpPlayers) {
      let bestMatch: PlayerMatch | null = null;
      let bestConfidence = 0;
      
      for (const dbPlayer of enrichedDBPlayers) {
        const confidence = calculatePlayerConfidence(
          lpPlayer.Link,
          dbPlayer.name,
          lpPlayer.Team,
          dbPlayer.team_name!,
          lpPlayer.Role,
          dbPlayer.role
        );
        
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            leaguepedia_name: lpPlayer.Link,
            leaguepedia_team: lpPlayer.Team,
            leaguepedia_role: lpPlayer.Role,
            db_name: dbPlayer.name,
            db_id: dbPlayer.id,
            db_team: dbPlayer.team_name!,
            db_role: dbPlayer.role,
            confidence,
            match_type: confidence >= 0.95 ? 'exact' : confidence >= 0.75 ? 'fuzzy' : 'manual'
          };
        }
      }
      
      if (bestMatch && bestConfidence >= 0.75) {
        playerMatches.push(bestMatch);
        
        const icon = bestConfidence >= 0.95 ? '✅' : '⚠️ ';
        const confidenceStr = `${Math.round(bestConfidence * 100)}%`;
        const lpStr = `${bestMatch.leaguepedia_name.padEnd(20)} (${bestMatch.leaguepedia_team.substring(0, 15).padEnd(15)}, ${bestMatch.leaguepedia_role.padEnd(7)})`;
        const dbStr = `${bestMatch.db_name.padEnd(20)} (${bestMatch.db_team.substring(0, 15).padEnd(15)}, ${bestMatch.db_role.padEnd(7)})`;
        
        console.log(`${icon} ${lpStr} → ${dbStr} (${confidenceStr})`);
      } else {
        unmatchedLPPlayers.push(lpPlayer);
        console.log(`❌ ${lpPlayer.Link.padEnd(20)} (${lpPlayer.Team.substring(0, 15).padEnd(15)}, ${lpPlayer.Role.padEnd(7)}) → NO MATCH`);
      }
    }
    
    // Statistics
    const exactMatches = playerMatches.filter(m => m.match_type === 'exact');
    const fuzzyMatches = playerMatches.filter(m => m.match_type === 'fuzzy');
    
    console.log(`\n📈 Player Match Statistics:`);
    console.log(`   Total Leaguepedia: ${lpPlayers.length}`);
    console.log(`   Exact matches (≥95%): ${exactMatches.length}`);
    console.log(`   Fuzzy matches (75-94%): ${fuzzyMatches.length}`);
    console.log(`   Unmatched: ${unmatchedLPPlayers.length}`);
    console.log(`   Match rate: ${Math.round((playerMatches.length / lpPlayers.length) * 100)}%`);
    
    // ===== GENERATE REPORTS =====
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 Generating reports...\n');
    
    const report = {
      generated_at: new Date().toISOString(),
      teams: {
        total_leaguepedia: lpTeams.length,
        total_db: dbTeams?.length || 0,
        exact_matches: exactTeamMatches,
        fuzzy_matches: fuzzyTeamMatches,
        unmatched_leaguepedia: unmatchedLPTeams,
        unmatched_db: unmatchedDBTeams
      },
      players: {
        total_leaguepedia: lpPlayers.length,
        total_db: dbPlayers?.length || 0,
        exact_matches: exactMatches.length,
        fuzzy_matches: fuzzyMatches.length,
        unmatched: unmatchedLPPlayers.length,
        match_rate: Math.round((playerMatches.length / lpPlayers.length) * 100)
      },
      team_mappings: teamMatches,
      player_mappings: playerMatches,
      unmatched_teams: unmatchedLPTeams,
      unmatched_players: unmatchedLPPlayers
    };
    
    const reportPath = path.join(__dirname, 'name-comparison-report.json');
    await fs.writeFile(
      reportPath,
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    console.log(`✅ Full report: ${reportPath}`);
    
    // Save approved mappings for next phase
    const playerMappingsPath = path.join(__dirname, 'approved-player-mappings.json');
    await fs.writeFile(
      playerMappingsPath,
      JSON.stringify(playerMatches, null, 2),
      'utf-8'
    );
    console.log(`✅ Player mappings: ${playerMappingsPath}`);
    
    const teamMappingsPath = path.join(__dirname, 'approved-team-mappings.json');
    await fs.writeFile(
      teamMappingsPath,
      JSON.stringify(teamMatches, null, 2),
      'utf-8'
    );
    console.log(`✅ Team mappings: ${teamMappingsPath}`);
    
    // ===== ACTION ITEMS =====
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 NEXT STEPS:\n');
    
    console.log(`1. Review name-comparison-report.json`);
    console.log(`2. ✅ Approve ${exactMatches.length} exact player matches (≥95% confidence)`);
    console.log(`3. ✅ Approve ${exactTeamMatches} exact team matches`);
    
    if (fuzzyMatches.length > 0) {
      console.log(`4. ⚠️  Review ${fuzzyMatches.length} fuzzy player matches (75-94% confidence)`);
    }
    
    if (fuzzyTeamMatches > 0) {
      console.log(`5. ⚠️  Review ${fuzzyTeamMatches} fuzzy team matches`);
    }
    
    if (unmatchedLPPlayers.length > 0) {
      console.log(`6. ❌ Manually map ${unmatchedLPPlayers.length} unmatched players`);
    }
    
    if (unmatchedDBTeams.length > 0) {
      console.log(`7. 🗑️  Delete ${unmatchedDBTeams.length} incorrect teams from DB:`);
      unmatchedDBTeams.forEach(t => console.log(`      - ${t}`));
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Exit with status
    if (unmatchedLPPlayers.length > 0 || fuzzyMatches.length > 5) {
      console.log('⚠️  REVIEW REQUIRED: Some matches need manual verification');
      process.exit(1);
    } else {
      console.log('✅ All matches look good! Ready to proceed to Phase 1');
      process.exit(0);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as compareNames };
