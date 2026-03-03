/**
 * Match Finder Service
 * 
 * Finds tournament matches in Riot API by correlating player games.
 * Identifies which custom games are IDL Kings Lendas matches.
 */

import { supabase } from '../config/supabase';
import { riotAPIService, RiotMatch } from './riot-api.service';

export interface TournamentMatch {
  riotMatchId: string;
  gameCreation: Date;
  team1: {
    id: string;
    name: string;
    players: TournamentPlayer[];
  };
  team2: {
    id: string;
    name: string;
    players: TournamentPlayer[];
  };
  winner: {
    id: string;
    name: string;
  };
}

export interface TournamentPlayer {
  id: string; // Database ID
  name: string;
  puuid: string;
  championId: number;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number; // totalMinionsKilled + neutralMinionsKilled
  firstBlood: boolean;
  tripleKill: boolean;
  quadraKill: boolean;
  pentaKill: boolean;
  win: boolean;
}

class MatchFinderService {
  /**
   * Find all tournament matches for a specific date range
   */
  async findMatches(
    startDate: Date,
    endDate: Date
  ): Promise<TournamentMatch[]> {
    console.log(`\n🔍 Buscando partidas do torneio...`);
    console.log(`📅 Período: ${startDate.toLocaleDateString()} a ${endDate.toLocaleDateString()}`);

    // Step 1: Get all players from database
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, team_id');

    if (playersError || !players) {
      console.error('❌ Erro ao buscar jogadores do banco:', playersError?.message);
      return [];
    }

    console.log(`✅ ${players.length} jogadores no banco\n`);

    // Step 2: Get PUUIDs for all players
    console.log('⏳ Buscando PUUIDs dos jogadores...');
    const playerPUUIDs = new Map<string, string>(); // player DB ID -> PUUID
    const puuidToPlayer = new Map<string, any>(); // PUUID -> player object

    for (const player of players) {
      const puuid = await riotAPIService.getPUUID(player.name, 'BR1');
      if (puuid) {
        playerPUUIDs.set(player.id, puuid);
        puuidToPlayer.set(puuid, player);
        console.log(`   ✅ ${player.name}: ${puuid.substring(0, 8)}...`);
      } else {
        console.warn(`   ⚠️  ${player.name}: PUUID não encontrado`);
      }
    }

    if (playerPUUIDs.size === 0) {
      console.error('❌ Nenhum PUUID encontrado. Verifique os nomes dos jogadores.');
      return [];
    }

    console.log(`\n✅ ${playerPUUIDs.size} PUUIDs obtidos`);

    // Step 3: Get match IDs from all players in date range
    console.log('\n⏳ Buscando histórico de partidas...');
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    
    const allMatchIds = new Set<string>();
    
    for (const [playerId, puuid] of playerPUUIDs) {
      const matchIds = await riotAPIService.getMatchIds(
        puuid,
        startTimestamp,
        endTimestamp,
        20 // Max 20 matches per player in this period
      );
      
      matchIds.forEach(id => allMatchIds.add(id));
      
      if (matchIds.length > 0) {
        const playerName = puuidToPlayer.get(puuid)?.name || 'Unknown';
        console.log(`   ✅ ${playerName}: ${matchIds.length} partidas`);
      }
    }

    console.log(`\n✅ Total de ${allMatchIds.size} partidas únicas encontradas`);

    // Step 4: Get details for each match and identify tournament matches
    console.log('\n⏳ Analisando partidas...');
    
    const tournamentMatches: TournamentMatch[] = [];
    
    for (const matchId of allMatchIds) {
      const match = await riotAPIService.getMatchDetails(matchId);
      
      if (!match) continue;

      // Check if it's a custom game (tournament)
      if (match.info.gameType !== 'CUSTOM_GAME') {
        continue;
      }

      // Check if we have exactly 10 of our players in this match
      const ourPlayers = match.metadata.participants.filter(puuid => 
        puuidToPlayer.has(puuid)
      );

      if (ourPlayers.length !== 10) {
        continue; // Not a full IDL match
      }

      // This is a tournament match! Parse it
      const tournamentMatch = await this.parseMatch(match, puuidToPlayer);
      
      if (tournamentMatch) {
        tournamentMatches.push(tournamentMatch);
        console.log(`   ✅ ${tournamentMatch.team1.name} vs ${tournamentMatch.team2.name}`);
      }
    }

    console.log(`\n✅ ${tournamentMatches.length} partidas do torneio identificadas!`);
    
    return tournamentMatches;
  }

  /**
   * Parse a Riot match into our tournament match format
   */
  private async parseMatch(
    riotMatch: RiotMatch,
    puuidToPlayer: Map<string, any>
  ): Promise<TournamentMatch | null> {
    // Get teams from database
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');

    if (teamsError || !teams) {
      console.error('❌ Erro ao buscar times:', teamsError?.message);
      return null;
    }

    const teamMap = new Map(teams.map(t => [t.id, t]));

    // Group participants by team
    const team1Players: TournamentPlayer[] = [];
    const team2Players: TournamentPlayer[] = [];

    for (const participant of riotMatch.info.participants) {
      const player = puuidToPlayer.get(participant.puuid);
      if (!player) continue;

      const tournamentPlayer: TournamentPlayer = {
        id: player.id,
        name: player.name,
        puuid: participant.puuid,
        championId: participant.championId,
        championName: participant.championName,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        firstBlood: participant.firstBloodKill,
        tripleKill: participant.tripleKills > 0,
        quadraKill: participant.quadraKills > 0,
        pentaKill: participant.pentaKills > 0,
        win: participant.win
      };

      // Group by Riot teamId (100 or 200)
      if (participant.teamId === 100) {
        team1Players.push(tournamentPlayer);
      } else {
        team2Players.push(tournamentPlayer);
      }
    }

    // Validate: each team should have exactly 5 players
    if (team1Players.length !== 5 || team2Players.length !== 5) {
      console.warn(`⚠️  Partida inválida: ${team1Players.length} vs ${team2Players.length} jogadores`);
      return null;
    }

    // Identify which database team each Riot team belongs to
    const team1DbId = team1Players[0]?.id ? 
      (await supabase.from('players').select('team_id').eq('id', team1Players[0].id).single()).data?.team_id 
      : null;
    
    const team2DbId = team2Players[0]?.id ? 
      (await supabase.from('players').select('team_id').eq('id', team2Players[0].id).single()).data?.team_id 
      : null;

    if (!team1DbId || !team2DbId) {
      console.error('❌ Não foi possível identificar os times');
      return null;
    }

    const team1 = teamMap.get(team1DbId);
    const team2 = teamMap.get(team2DbId);

    if (!team1 || !team2) {
      console.error('❌ Times não encontrados no banco');
      return null;
    }

    // Determine winner
    const winner = team1Players[0].win ? team1 : team2;

    return {
      riotMatchId: riotMatch.metadata.matchId,
      gameCreation: new Date(riotMatch.info.gameCreation),
      team1: {
        id: team1.id,
        name: team1.name,
        players: team1Players
      },
      team2: {
        id: team2.id,
        name: team2.name,
        players: team2Players
      },
      winner: {
        id: winner.id,
        name: winner.name
      }
    };
  }
}

export const matchFinderService = new MatchFinderService();
