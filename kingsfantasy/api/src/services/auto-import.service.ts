import { adminSupabase } from '../config/supabase';
import { leaguepediaService } from './leaguepedia.service';
import { mapperService } from './mapper.service';
import { scoringService } from './scoring.service';

/**
 * AUTO IMPORT SERVICE
 * 
 * Orchestrates the automatic import of match data from Leaguepedia
 * into the Kings Fantasy database.
 * 
 * Flow:
 * 1. Fetch matches from Leaguepedia for a specific round/week
 * 2. Map player/champion/team names to database IDs
 * 3. Create match records and player performances
 * 4. Calculate fantasy points for each performance
 * 5. Mark round as completed
 */

interface ImportRoundResult {
  success: boolean;
  roundId: number;
  matchesImported: number;
  performancesImported: number;
  errors: string[];
}

interface ImportMatchResult {
  success: boolean;
  matchId?: number;
  performancesCreated?: number;
  error?: string;
}

class AutoImportService {
  /**
   * Import all matches for a specific round/week
   * 
   * @param overviewPage - Leaguepedia tournament OverviewPage (e.g., "IDL Kings Lendas Season 3")
   * @param roundNumber - Round number (1-7 for regular season)
   * @returns ImportRoundResult with stats and errors
   */
  async importRound(overviewPage: string, roundNumber: number | string): Promise<ImportRoundResult> {
    const result: ImportRoundResult = {
      success: false,
      roundId: 0,
      matchesImported: 0,
      performancesImported: 0,
      errors: []
    };

    try {
      console.log(`🚀 Starting import for ${overviewPage}, Round ${roundNumber}`);

      // Initialize mapper caches (force refresh to pick up new mappings)
      mapperService.clearCaches();
      await mapperService.initializeCaches();
      console.log('✅ Mapper caches initialized');

      // Fetch matches from Leaguepedia
      const lpMatches = await leaguepediaService.getMatches(overviewPage, roundNumber);
      console.log(`📥 Fetched ${lpMatches.length} matches from Leaguepedia`);

      if (lpMatches.length === 0) {
        // Fetch available weeks for debug info
        const availableWeeks = await leaguepediaService.getAvailableWeeks(overviewPage);
        result.errors.push(`No matches found for ${overviewPage} Round "${roundNumber}". Available weeks: [${availableWeeks.join(', ')}]`);
        return result;
      }

      // Determine season from OverviewPage
      const season = this.extractSeasonFromOverviewPage(overviewPage);

      // Convert roundNumber to numeric for DB (e.g., "Day 1" → 1, "Quarterfinals" → 4)
      const dbRoundNumber = this.resolveRoundNumber(roundNumber);

      // Find or create the round in database
      const round = await this.findOrCreateRound(season, dbRoundNumber);
      result.roundId = round.id;
      console.log(`📋 Using round ID: ${round.id}`);

      // Import each match
      for (const lpMatch of lpMatches) {
        try {
          const matchResult = await this.importMatch(round.id, lpMatch);
          
          if (matchResult.success) {
            result.matchesImported++;
            result.performancesImported += matchResult.performancesCreated || 0;
            console.log(`✅ Imported match: ${lpMatch.Team1} vs ${lpMatch.Team2} (${matchResult.performancesCreated} performances)`);
          } else {
            result.errors.push(`Match ${lpMatch.Team1} vs ${lpMatch.Team2}: ${matchResult.error}`);
            console.error(`❌ Failed to import match: ${matchResult.error}`);
          }
        } catch (error: any) {
          result.errors.push(`Match ${lpMatch.Team1} vs ${lpMatch.Team2}: ${error.message}`);
          console.error(`❌ Error importing match:`, error);
        }
      }

      // Mark round as completed if all matches imported successfully
      if (result.matchesImported === lpMatches.length) {
        await this.markRoundAsCompleted(round.id);
        result.success = true;
        console.log(`✅ Round ${roundNumber} marked as completed`);
      } else {
        result.errors.push(`Only ${result.matchesImported}/${lpMatches.length} matches imported successfully`);
        console.warn(`⚠️ Partial import: ${result.matchesImported}/${lpMatches.length} matches`);
      }

      console.log(`🎉 Import completed: ${result.matchesImported} matches, ${result.performancesImported} performances`);
      return result;

    } catch (error: any) {
      result.errors.push(`Fatal error: ${error.message}`);
      console.error('❌ Fatal error during import:', error);
      return result;
    }
  }

  /**
   * Import a single match and its player performances
   */
  private async importMatch(roundId: number, lpMatch: any): Promise<ImportMatchResult> {
    try {
      // Map team IDs
      const team1Id = mapperService.getTeamId(lpMatch.Team1);
      const team2Id = mapperService.getTeamId(lpMatch.Team2);

      if (!team1Id || !team2Id) {
        return {
          success: false,
          error: `Team mapping failed: ${lpMatch.Team1} (${team1Id}) vs ${lpMatch.Team2} (${team2Id})`
        };
      }

      // Determine winner
      const winnerId = lpMatch.Winner === '1' ? team1Id : team2Id;

      // Parse date (format: "2024-01-28 19:00:00")
      const matchDate = new Date(lpMatch.DateTime_UTC);

      // Check for existing match to avoid duplicates on re-import
      const { data: existingMatch } = await adminSupabase
        .from('matches')
        .select('id')
        .eq('round_id', roundId)
        .eq('team_a_id', team1Id)
        .eq('team_b_id', team2Id)
        .maybeSingle();

      if (existingMatch) {
        console.log(`⏭️ Match already exists: ${lpMatch.Team1} vs ${lpMatch.Team2} (id: ${existingMatch.id}), skipping`);
        return {
          success: true,
          matchId: existingMatch.id,
          performancesCreated: 0
        };
      }

      // Create match record
      const { data: match, error: matchError } = await adminSupabase
        .from('matches')
        .insert({
          round_id: roundId,
          team_a_id: team1Id,
          team_b_id: team2Id,
          winner_id: winnerId,
          scheduled_time: matchDate.toISOString(),
          status: 'completed',
          games_count: 1
        })
        .select()
        .single();

      if (matchError || !match) {
        return {
          success: false,
          error: `Failed to create match: ${matchError?.message}`
        };
      }

      // Fetch player stats from Leaguepedia
      const playerStats = await leaguepediaService.getPlayerStats(lpMatch.GameId);

      if (playerStats.length === 0) {
        return {
          success: false,
          error: `No player stats found for GameId: ${lpMatch.GameId}`
        };
      }

      // Import each player performance
      let performancesCreated = 0;
      for (const stat of playerStats) {
        try {
          // Map performance data
          const performance = mapperService.mapPlayerPerformance(stat, match.id, winnerId);

          if (!performance) {
            console.warn(`⚠️ Could not map performance for player: ${stat.Link}`);
            continue;
          }

          // Calculate base points
          const basePoints = await scoringService.calculateBasePoints({
            kills: performance.kills,
            deaths: performance.deaths,
            assists: performance.assists,
            cs: performance.cs
          });

          // Create performance record
          const { error: perfError } = await adminSupabase
            .from('player_performances')
            .insert({
              ...performance,
              game_number: 1,
              fantasy_points: basePoints // Will be recalculated later with buffs
            });

          if (perfError) {
            console.error(`❌ Failed to create performance for ${stat.Link}:`, perfError);
            continue;
          }

          performancesCreated++;
        } catch (error: any) {
          console.error(`❌ Error creating performance for ${stat.Link}:`, error);
        }
      }

      return {
        success: true,
        matchId: match.id,
        performancesCreated
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract season number from OverviewPage
   */
  /**
   * Convert round identifier to numeric value for DB storage
   * "Day 1" → 1, "Quarterfinals" → 4, "Semifinals" → 5, "Finals" → 6, number → number
   */
  private resolveRoundNumber(round: number | string): number {
    if (typeof round === 'number') return round;

    // Try extracting number from string like "Day 1", "Week 2"
    const numMatch = round.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1]);

    // Map playoff stages to round numbers
    const stageMap: Record<string, number> = {
      'quarterfinals': 4,
      'semifinals': 5,
      'finals': 6,
    };

    const lower = round.toLowerCase().trim();
    return stageMap[lower] || 1;
  }

  private extractSeasonFromOverviewPage(overviewPage: string): number {
    // "IDL Kings Lendas Cup" -> Season 5 (cup)
    if (overviewPage.toLowerCase().includes('cup')) {
      return 5;
    }
    // "IDL Kings Lendas" -> Season 1
    // "IDL Kings Lendas Season 2" -> Season 2
    // "IDL Kings Lendas Season 3" -> Season 3
    const match = overviewPage.match(/Season (\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Find or create a round in the database
   */
  private async findOrCreateRound(season: number, roundNumber: number) {
    // Check if round already exists
    const { data: existingRound } = await adminSupabase
      .from('rounds')
      .select('*')
      .eq('season', season)
      .eq('round_number', roundNumber)
      .single();

    if (existingRound) {
      return existingRound;
    }

    // Create new round
    const { data: newRound, error } = await adminSupabase
      .from('rounds')
      .insert({
        season,
        round_number: roundNumber,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days later
        market_close_time: new Date().toISOString(), // Close market at start
        status: 'upcoming'
      })
      .select()
      .single();

    if (error || !newRound) {
      throw new Error(`Failed to create round: ${error?.message}`);
    }

    return newRound;
  }

  /**
   * Mark a round as completed
   */
  private async markRoundAsCompleted(roundId: number) {
    const { error } = await adminSupabase
      .from('rounds')
      .update({ status: 'completed' })
      .eq('id', roundId);

    if (error) {
      throw new Error(`Failed to mark round as completed: ${error.message}`);
    }
  }

  /**
   * Get the season's OverviewPage for Leaguepedia
   */
  getOverviewPage(season: number | string): string {
    // Support "cup" as a season identifier
    if (String(season).toLowerCase() === 'cup') {
      return 'IDL Kings Lendas Cup';
    }

    const overviewPages: Record<number, string> = {
      1: 'IDL Kings Lendas',
      2: 'IDL Kings Lendas Season 2',
      3: 'IDL Kings Lendas Season 3',
      4: 'IDL Kings Lendas Season 4'
    };

    return overviewPages[Number(season)] || overviewPages[1];
  }

  /**
   * Get available weeks/rounds for a season
   */
  async getAvailableRounds(season: number | string): Promise<(number | string)[]> {
    const overviewPage = this.getOverviewPage(season);
    const weeks = await leaguepediaService.getAvailableWeeks(overviewPage);
    return weeks;
  }

  /**
   * Get import status for a round
   */
  async getRoundImportStatus(season: number, roundNumber: number) {
    const { data: round } = await adminSupabase
      .from('rounds')
      .select('*, matches(count)')
      .eq('season', season)
      .eq('round_number', roundNumber)
      .single();

    if (!round) {
      return {
        exists: false,
        completed: false,
        matchesCount: 0
      };
    }

    return {
      exists: true,
      completed: round.completed,
      matchesCount: round.matches?.[0]?.count || 0,
      roundId: round.id
    };
  }
}

export const autoImportService = new AutoImportService();
