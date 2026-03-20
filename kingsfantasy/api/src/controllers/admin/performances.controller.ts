import { Response } from 'express';
import levenshtein from 'fast-levenshtein';
import { adminSupabase, supabase } from '../../config/supabase';
import { scoringService } from '../../services/scoring.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

type ExtractedImageRow = {
  player_name: string;
  champion_name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  game_number?: number;
  team?: 'A' | 'B' | '';
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const parseJsonFromGemini = (rawText: string) => {
  const cleanText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleanText);
};

const findBestByName = <T extends { id: number | string; name: string; key_name?: string }>(
  inputName: string,
  list: T[],
  options?: { allowKeyName?: boolean }
): T | null => {
  const normalizedInput = normalizeText(inputName || '');
  if (!normalizedInput) return null;

  for (const item of list) {
    if (normalizeText(item.name) === normalizedInput) {
      return item;
    }
    if (options?.allowKeyName && item.key_name && normalizeText(item.key_name) === normalizedInput) {
      return item;
    }
  }

  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const item of list) {
    const nameDistance = levenshtein.get(normalizedInput, normalizeText(item.name));
    const keyDistance = options?.allowKeyName && item.key_name
      ? levenshtein.get(normalizedInput, normalizeText(item.key_name))
      : Number.POSITIVE_INFINITY;
    const distance = Math.min(nameDistance, keyDistance);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }

  if (!best) return null;
  const maxAllowedDistance = Math.max(2, Math.floor(normalizedInput.length * 0.35));
  return bestDistance <= maxAllowedDistance ? best : null;
};

/**
 * PERFORMANCES CONTROLLER
 * 
 * Gerencia operações de player performances
 * Integrado com scoring service para cálculo automático de fantasy points
 */

/**
 * Inserir múltiplas performances de uma vez (partida completa)
 * POST /api/admin/performances/bulk
 */
export async function bulkInsertPerformances(req: AuthenticatedRequest, res: Response) {
  try {
    const { match_id, performances } = req.body;

    // Validações básicas
    if (!match_id || !performances || !Array.isArray(performances)) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando',
        required: {
          match_id: 'number',
          performances: 'array[10] de objetos'
        }
      });
    }


    // Validar que match existe e obter dados
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, round_id, winner_id, team_a_id, team_b_id, games_count')
      .eq('id', match_id)
      .single();

    if (matchError || !match) {
      return res.status(404).json({
        success: false,
        error: 'Partida não encontrada',
        match_id
      });
    }

    const gamesCount = match.games_count && match.games_count > 0 ? match.games_count : 1;
    const expectedPerformances = gamesCount * 10;

    if (performances.length !== expectedPerformances) {
      return res.status(400).json({
        success: false,
        error: `Uma partida deve ter exatamente ${expectedPerformances} performances (5 por time por jogo)`,
        received: performances.length
      });
    }

    const invalidGameNumber = performances.find((perf: any) =>
      perf.game_number === undefined ||
      perf.game_number === null ||
      Number.isNaN(Number(perf.game_number)) ||
      Number(perf.game_number) < 1 ||
      Number(perf.game_number) > gamesCount
    );

    if (invalidGameNumber) {
      return res.status(400).json({
        success: false,
        error: `game_number deve estar entre 1 e ${gamesCount}`,
        received: invalidGameNumber.game_number
      });
    }

    // Validar estrutura de cada performance
    const requiredFields = ['player_id', 'champion_id', 'kills', 'deaths', 'assists', 'cs', 'game_number'];
    for (let i = 0; i < performances.length; i++) {
      const perf = performances[i];
      for (const field of requiredFields) {
        if (perf[field] === undefined || perf[field] === null) {
          return res.status(400).json({
            success: false,
            error: `Campo obrigatório faltando na performance ${i + 1}`,
            missing_field: field,
            required_fields: requiredFields
          });
        }
      }

      // Validar analyst_rating (se fornecido)
      if (perf.analyst_rating !== undefined && perf.analyst_rating !== null) {
        if (perf.analyst_rating < 0 || perf.analyst_rating > 100) {
          return res.status(400).json({
            success: false,
            error: `analyst_rating deve estar entre 0 e 100`,
            performance_index: i + 1,
            received_rating: perf.analyst_rating
          });
        }
      }
    }


    // Validar que todos os player_ids existem
    const playerIds = performances.map(p => p.player_id);
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, team_id')
      .in('id', playerIds);

    if (playersError || !players || players.length !== 10) {
      return res.status(404).json({
        success: false,
        error: 'Um ou mais jogadores não foram encontrados',
        requested_players: playerIds.length,
        found_players: players?.length || 0
      });
    }

    // Criar mapa de player_id -> team_id
    const playerTeamMap = new Map(players.map(p => [p.id, p.team_id]));


    // Validar que todos os champion_ids existem
    const championIds = performances.map(p => p.champion_id);
    const { data: champions, error: championsError } = await supabase
      .from('champions')
      .select('id, name')
      .in('id', championIds);

    if (championsError || !champions || champions.length !== championIds.length) {
      return res.status(404).json({
        success: false,
        error: 'Um ou mais campeões não foram encontrados',
        requested_champions: championIds.length,
        found_champions: champions?.length || 0
      });
    }

    console.log(`📝 Inserting ${performances.length} performances for match ${match_id}...`);

    // Preparar dados para inserção (com is_winner calculado)
    const performancesToInsert = performances.map(perf => {
      const playerTeam = playerTeamMap.get(perf.player_id);
      const isWinner = playerTeam === match.winner_id;

      return {
        match_id,
        game_number: perf.game_number,
        player_id: perf.player_id,
        champion_id: perf.champion_id,
        kills: perf.kills,
        deaths: perf.deaths,
        assists: perf.assists,
        cs: perf.cs,
        gold_earned: perf.gold_earned || 0,
        damage_dealt: perf.damage_dealt || 0,
        wards_placed: perf.wards_placed || 0,
        first_blood: perf.first_blood || false,
        triple_kill: perf.triple_kill || false,
        quadra_kill: perf.quadra_kill || false,
        penta_kill: perf.penta_kill || false,
        is_winner: isWinner,
        analyst_rating: perf.analyst_rating || null,
        fantasy_points: 0 // Será calculado logo após a inserção
      };
    });


    // Inserir performances
    const { data: insertedPerformances, error: insertError } = await adminSupabase
      .from('player_performances')
      .upsert(performancesToInsert, { onConflict: 'match_id,player_id,game_number' })
      .select(`
        *,
        player:players(id, name, role, team_id),
        champion:champions(id, name, image_url)
      `);

    if (insertError) {
      console.error('❌ Error inserting performances:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao inserir performances',
        details: insertError.message
      });
    }

    console.log(`✅ Inserted ${insertedPerformances?.length} performances`);


    // Calcular fantasy_points para cada performance inserida
    console.log('🎯 Calculating fantasy points...');
    const performancesWithPoints = [];

    for (const perf of insertedPerformances || []) {
      try {
        // Usar o serviço de scoring para calcular pontos
        const finalPoints = await scoringService.updatePerformancePoints(perf.id);
        
        performancesWithPoints.push({
          ...perf,
          fantasy_points: finalPoints
        });
      } catch (error) {
        console.error(`⚠️  Error calculating points for performance ${perf.id}:`, error);
        performancesWithPoints.push(perf);
      }
    }

    console.log(`✅ Fantasy points calculated for all ${performancesWithPoints.length} performances`);

    // Atualizar pontos agregados dos jogadores afetados
    try {
      const playerIds = Array.from(
        new Set((insertedPerformances || []).map((perf: any) => perf.player_id))
      );

      if (playerIds.length > 0) {
        const { data: allPerformances, error: perfFetchError } = await adminSupabase
          .from('player_performances')
          .select('player_id, fantasy_points, match_id')
          .in('player_id', playerIds);

        if (!perfFetchError && allPerformances) {
          const matchIds = Array.from(new Set(allPerformances.map((perf: any) => perf.match_id)));
          const { data: matches, error: matchesError } = await adminSupabase
            .from('matches')
            .select('id, games_count')
            .in('id', matchIds);

          if (!matchesError && matches) {
            const matchGamesMap = new Map(
              matches.map((match: any) => [match.id, Number(match.games_count || 1)])
            );

            const playerMatchPoints = new Map<string, Map<number, number>>();
            const playerGameStats = new Map<string, { totalPoints: number; count: number }>();

            for (const perf of allPerformances) {
              const points = perf.fantasy_points || 0;
              const playerId = String(perf.player_id);
              const matchId = Number(perf.match_id);

              if (!playerMatchPoints.has(playerId)) {
                playerMatchPoints.set(playerId, new Map());
              }
              const matchMap = playerMatchPoints.get(playerId)!;
              matchMap.set(matchId, (matchMap.get(matchId) || 0) + points);

              const gameStats = playerGameStats.get(playerId) || { totalPoints: 0, count: 0 };
              gameStats.totalPoints += points;
              gameStats.count += 1;
              playerGameStats.set(playerId, gameStats);
            }

            for (const [playerId, matchMap] of playerMatchPoints) {
              let matchSum = 0;
              let matchCount = 0;

              for (const [matchId, matchPoints] of matchMap) {
                const gamesCount = matchGamesMap.get(matchId) || 1;
                matchSum += matchPoints / gamesCount;
                matchCount += 1;
              }

              const gameStats = playerGameStats.get(playerId) || { totalPoints: 0, count: 0 };
              const pointsPerMatch = matchCount > 0 ? matchSum / matchCount : 0;
              const avgPointsPerGame = gameStats.count > 0 ? gameStats.totalPoints / gameStats.count : 0;

              await adminSupabase
                .from('players')
                .update({
                  points: pointsPerMatch,
                  avg_points: avgPointsPerGame,
                  games_played: gameStats.count
                })
                .eq('id', playerId);
            }
          }
        }
      }
    } catch (error) {
      console.error('⚠️  Error updating player aggregated points:', error);
    }

    // Atualizar pontuacao de ligas (user_teams) da rodada
    if (match?.round_id) {
      try {
        await scoringService.calculateAllScoresForRound(Number(match.round_id));
      } catch (error) {
        console.error('⚠️  Error recalculating league scores:', error);
      }
    }

    return res.status(201).json({
      success: true,
      message: `${performancesWithPoints.length} performances inseridas e pontuadas com sucesso`,
      match_id,
      inserted: performancesWithPoints.length,
      performances: performancesWithPoints
    });

  } catch (error) {
    console.error('❌ Exception in bulkInsertPerformances:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao inserir performances',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Extrair performances de imagem (OCR assistido por IA)
 * POST /api/admin/performances/extract-from-image
 */
export async function extractPerformancesFromImage(req: AuthenticatedRequest, res: Response) {
  try {
    const { match_id, image_data } = req.body || {};

    if (!match_id || !image_data || typeof image_data !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando',
        required: ['match_id', 'image_data(base64/data-url)']
      });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY não configurada no backend'
      });
    }

    const { data: match, error: matchError } = await adminSupabase
      .from('matches')
      .select('id, team_a_id, team_b_id, games_count, team_a:teams!matches_team_a_id_fkey(id, name), team_b:teams!matches_team_b_id_fkey(id, name)')
      .eq('id', Number(match_id))
      .single();

    if (matchError || !match) {
      return res.status(404).json({
        success: false,
        error: 'Partida não encontrada',
        match_id
      });
    }

    const { data: players, error: playersError } = await adminSupabase
      .from('players')
      .select('id, name, team_id, role')
      .in('team_id', [match.team_a_id, match.team_b_id]);

    if (playersError || !players || players.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Jogadores da partida não encontrados'
      });
    }

    const { data: champions, error: championsError } = await adminSupabase
      .from('champions')
      .select('id, name, key_name');

    if (championsError || !champions || champions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lista de campeões não encontrada'
      });
    }

    let mimeType = 'image/png';
    let base64 = image_data.trim();
    const dataUrlMatch = image_data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64 = dataUrlMatch[2];
    }

    const prompt = [
      'Extraia os dados da tabela de uma partida de League of Legends presente na imagem.',
      'Retorne APENAS JSON válido, sem markdown, sem texto adicional, com este formato exato:',
      '{"score":{"team_a":number,"team_b":number},"rows":[{"player_name":"string","champion_name":"string","kills":number,"deaths":number,"assists":number,"cs":number,"team":"A|B","game_number":1}]}',
      'Regras:',
      '- rows deve conter os 10 jogadores visíveis (5 por time) quando possível.',
      '- Se houver dúvida em algum campo, preencha com o melhor valor provável (não deixe null).',
      '- Não inventar jogadores que não aparecem na imagem.',
      '- Não incluir outros campos além dos solicitados.'
    ].join('\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text();
      return res.status(502).json({
        success: false,
        error: 'Falha ao extrair dados da imagem via IA',
        details: err
      });
    }

    const geminiData: any = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
    if (!rawText) {
      return res.status(502).json({
        success: false,
        error: 'IA não retornou conteúdo para extração'
      });
    }

    const parsed = parseJsonFromGemini(rawText);
    const extractedRows: ExtractedImageRow[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const extractedScore = parsed?.score || null;

    if (extractedRows.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Não foi possível extrair linhas da imagem'
      });
    }

    const teamAPlayers = players.filter((player: any) => String(player.team_id) === String(match.team_a_id));
    const teamBPlayers = players.filter((player: any) => String(player.team_id) === String(match.team_b_id));
    const allPlayers = [...teamAPlayers, ...teamBPlayers];
    const usedPlayerIds = new Set<string>();

    const mappedRows = extractedRows.map((row, index) => {
      const pool = row.team === 'A' ? teamAPlayers : row.team === 'B' ? teamBPlayers : allPlayers;
      const availablePool = pool.filter((player: any) => !usedPlayerIds.has(String(player.id)));
      const bestPlayer = findBestByName(String(row.player_name || ''), availablePool);
      if (bestPlayer) {
        usedPlayerIds.add(String(bestPlayer.id));
      }

      const bestChampion = findBestByName(String(row.champion_name || ''), champions, { allowKeyName: true });
      const kills = Number(row.kills ?? 0);
      const deaths = Number(row.deaths ?? 0);
      const assists = Number(row.assists ?? 0);
      const cs = Number(row.cs ?? 0);

      return {
        index: index + 1,
        player_name: String(row.player_name || ''),
        champion_name: String(row.champion_name || ''),
        game_number: Number(row.game_number || 1),
        team: row.team || '',
        mapped_player_id: bestPlayer ? bestPlayer.id : null,
        mapped_player_name: bestPlayer ? bestPlayer.name : null,
        mapped_champion_id: bestChampion ? bestChampion.id : null,
        mapped_champion_name: bestChampion ? bestChampion.name : null,
        kills: Number.isFinite(kills) ? kills : 0,
        deaths: Number.isFinite(deaths) ? deaths : 0,
        assists: Number.isFinite(assists) ? assists : 0,
        cs: Number.isFinite(cs) ? cs : 0,
        status: bestPlayer && bestChampion ? 'ok' : 'review',
        message: bestPlayer && bestChampion
          ? 'Mapeado com sucesso'
          : !bestPlayer && !bestChampion
            ? 'Jogador e campeão precisam de revisão'
            : !bestPlayer
              ? 'Jogador precisa de revisão'
              : 'Campeão precisa de revisão'
      };
    });

    return res.json({
      success: true,
      match_id: Number(match_id),
      score: extractedScore && Number.isFinite(Number(extractedScore.team_a)) && Number.isFinite(Number(extractedScore.team_b))
        ? {
            team_a: Number(extractedScore.team_a),
            team_b: Number(extractedScore.team_b)
          }
        : null,
      rows: mappedRows,
      reviewCount: mappedRows.filter((row) => row.status !== 'ok').length
    });
  } catch (error) {
    console.error('❌ Exception in extractPerformancesFromImage:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao extrair dados da imagem',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Recalcular pontos agregados de jogadores
 * POST /api/admin/performances/recalculate-players
 */
export async function recalculatePlayerPoints(req: AuthenticatedRequest, res: Response) {
  try {
    scoringService.clearConfigCache();
    const { player_ids } = req.body || {};

    let playersQuery = adminSupabase
      .from('players')
      .select('id');

    if (Array.isArray(player_ids) && player_ids.length > 0) {
      playersQuery = playersQuery.in('id', player_ids);
    }

    const { data: players, error: playersError } = await playersQuery;

    if (playersError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar jogadores',
        details: playersError.message
      });
    }

    if (!players || players.length === 0) {
      return res.json({
        success: true,
        updated: 0
      });
    }

    const playerIds = players.map((player) => player.id);
    const { data: performances, error: perfError } = await adminSupabase
      .from('player_performances')
      .select('id, player_id')
      .in('player_id', playerIds);

    if (perfError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar performances',
        details: perfError.message
      });
    }

    const statsMap = new Map<string, { totalPoints: number; count: number }>();
    let updatedPerformances = 0;
    const totalPerformances = performances?.length || 0;

    for (const perf of performances || []) {
      const finalPoints = await scoringService.updatePerformancePoints(perf.id);
      const existing = statsMap.get(perf.player_id) || { totalPoints: 0, count: 0 };
      existing.totalPoints += finalPoints || 0;
      existing.count += 1;
      statsMap.set(perf.player_id, existing);
      updatedPerformances++;
    }

    let updated = 0;
    let updateErrors = 0;
    const updateErrorSamples: Array<{ player_id: string; message: string }> = [];

    const { data: perfRows, error: perfRowsError } = await adminSupabase
      .from('player_performances')
      .select('player_id, fantasy_points, match_id')
      .in('player_id', playerIds);

    if (perfRowsError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar performances detalhadas',
        details: perfRowsError.message
      });
    }

    const matchIds = Array.from(new Set((perfRows || []).map((perf: any) => perf.match_id)));
    const { data: matches, error: matchesError } = await adminSupabase
      .from('matches')
      .select('id, games_count')
      .in('id', matchIds);

    if (matchesError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar partidas',
        details: matchesError.message
      });
    }

    const matchGamesMap = new Map(
      (matches || []).map((match: any) => [match.id, Number(match.games_count || 1)])
    );

    const playerMatchPoints = new Map<string, Map<number, number>>();
    const playerGameStats = new Map<string, { totalPoints: number; count: number }>();

    for (const perf of perfRows || []) {
      const points = perf.fantasy_points || 0;
      const playerId = String(perf.player_id);
      const matchId = Number(perf.match_id);

      if (!playerMatchPoints.has(playerId)) {
        playerMatchPoints.set(playerId, new Map());
      }
      const matchMap = playerMatchPoints.get(playerId)!;
      matchMap.set(matchId, (matchMap.get(matchId) || 0) + points);

      const gameStats = playerGameStats.get(playerId) || { totalPoints: 0, count: 0 };
      gameStats.totalPoints += points;
      gameStats.count += 1;
      playerGameStats.set(playerId, gameStats);
    }

    for (const playerId of playerIds) {
      const matchMap = playerMatchPoints.get(String(playerId)) || new Map();
      let matchSum = 0;
      let matchCount = 0;

      for (const [matchId, matchPoints] of matchMap) {
        const gamesCount = matchGamesMap.get(matchId) || 1;
        matchSum += matchPoints / gamesCount;
        matchCount += 1;
      }

      const gameStats = playerGameStats.get(String(playerId)) || { totalPoints: 0, count: 0 };
      const pointsPerMatch = matchCount > 0 ? matchSum / matchCount : 0;
      const avgPointsPerGame = gameStats.count > 0 ? gameStats.totalPoints / gameStats.count : 0;

      const { error: updateError } = await adminSupabase
        .from('players')
        .update({
          points: pointsPerMatch,
          avg_points: avgPointsPerGame
        })
        .eq('id', playerId);

      if (updateError) {
        updateErrors++;
        if (updateErrorSamples.length < 5) {
          updateErrorSamples.push({
            player_id: String(playerId),
            message: updateError.message
          });
        }
        console.error(`⚠️  Error updating player ${playerId}:`, updateError);
        continue;
      }

      updated++;
    }

    const { count: remainingNulls } = await adminSupabase
      .from('player_performances')
      .select('id', { count: 'exact', head: true })
      .in('player_id', playerIds)
      .is('fantasy_points', null);

    return res.json({
      success: true,
      updated,
      updateErrors,
      updateErrorSamples,
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      updatedPerformances,
      totalPerformances,
      remainingNulls: remainingNulls || 0
    });
  } catch (error) {
    console.error('❌ Exception in recalculatePlayerPoints:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao recalcular pontos',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Listar performances de uma partida
 * GET /api/admin/performances/match/:matchId
 */
export async function getMatchPerformances(req: AuthenticatedRequest, res: Response) {
  try {
    const { matchId } = req.params;

    const { data: performances, error } = await adminSupabase
      .from('player_performances')
      .select(`
        *,
        player:players(id, name, role, team_id),
        champion:champions(id, name, image_url),
        match:matches(
          id,
          team_a:teams!matches_team_a_id_fkey(id, name),
          team_b:teams!matches_team_b_id_fkey(id, name)
        )
      `)
      .eq('match_id', parseInt(matchId))
      .order('fantasy_points', { ascending: false });

    if (error) {
      console.error('❌ Error fetching performances:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar performances',
        details: error.message
      });
    }

    return res.json({
      success: true,
      match_id: matchId,
      total: performances?.length || 0,
      performances: performances || []
    });

  } catch (error) {
    console.error('❌ Exception in getMatchPerformances:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar performances',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar performance individual
 * PUT /api/admin/performances/:id
 */
export async function updatePerformance(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validar analyst_rating se fornecido
    if (updateData.analyst_rating !== undefined && updateData.analyst_rating !== null) {
      if (updateData.analyst_rating < 0 || updateData.analyst_rating > 100) {
        return res.status(400).json({
          success: false,
          error: 'analyst_rating deve estar entre 0 e 100',
          received: updateData.analyst_rating
        });
      }
    }

    // Atualizar performance
    const { data: performance, error: updateError } = await adminSupabase
      .from('player_performances')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError || !performance) {
      console.error('❌ Error updating performance:', updateError);
      return res.status(404).json({
        success: false,
        error: 'Performance não encontrada ou erro ao atualizar',
        performance_id: id
      });
    }

    // Recalcular fantasy_points
    console.log(`🎯 Recalculating fantasy points for performance ${id}...`);
    const finalPoints = await scoringService.updatePerformancePoints(parseInt(id));

    return res.json({
      success: true,
      message: 'Performance atualizada e repontuada com sucesso',
      performance: {
        ...performance,
        fantasy_points: finalPoints
      }
    });

  } catch (error) {
    console.error('❌ Exception in updatePerformance:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar performance',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar apenas analyst_rating
 * PATCH /api/admin/performances/:id/rating
 */
export async function updateRating(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { analyst_rating } = req.body;

    // Validar rating
    if (analyst_rating === undefined || analyst_rating === null) {
      return res.status(400).json({
        success: false,
        error: 'analyst_rating é obrigatório',
        expected: 'number entre 0 e 100 ou null'
      });
    }

    if (analyst_rating !== null && (analyst_rating < 0 || analyst_rating > 100)) {
      return res.status(400).json({
        success: false,
        error: 'analyst_rating deve estar entre 0 e 100',
        received: analyst_rating
      });
    }

    // Atualizar rating
    const { data: performance, error: updateError } = await adminSupabase
      .from('player_performances')
      .update({ analyst_rating })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError || !performance) {
      return res.status(404).json({
        success: false,
        error: 'Performance não encontrada',
        performance_id: id
      });
    }

    // Recalcular fantasy_points com novo rating
    console.log(`🎯 Recalculating with new rating (${analyst_rating}) for performance ${id}...`);
    const finalPoints = await scoringService.updatePerformancePoints(parseInt(id));

    return res.json({
      success: true,
      message: 'Analyst rating atualizado e pontos recalculados',
      performance: {
        ...performance,
        fantasy_points: finalPoints
      }
    });

  } catch (error) {
    console.error('❌ Exception in updateRating:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar rating',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Deletar performance
 * DELETE /api/admin/performances/:id
 */
export async function deletePerformance(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Buscar performance antes de deletar para saber o player_id
    const { data: perfToDelete, error: fetchError } = await adminSupabase
      .from('player_performances')
      .select('player_id')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !perfToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Performance não encontrada'
      });
    }

    const { error: deleteError } = await adminSupabase
      .from('player_performances')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      console.error('❌ Error deleting performance:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar performance',
        details: deleteError.message
      });
    }

    // Recalcular agregados do jogador após deletar a performance
    const { data: remainingPerfs } = await adminSupabase
      .from('player_performances')
      .select('fantasy_points')
      .eq('player_id', perfToDelete.player_id);

    if (remainingPerfs && remainingPerfs.length > 0) {
      const totalPoints = remainingPerfs.reduce((sum: number, p: any) => sum + (p.fantasy_points || 0), 0);
      const avgPoints = totalPoints / remainingPerfs.length;
      await adminSupabase
        .from('players')
        .update({
          total_points: totalPoints,
          avg_points: avgPoints,
          games_played: remainingPerfs.length
        })
        .eq('id', perfToDelete.player_id);
    } else {
      // Sem performances restantes, zera os stats
      await adminSupabase
        .from('players')
        .update({ total_points: 0, avg_points: 0, games_played: 0 })
        .eq('id', perfToDelete.player_id);
    }

    console.log(`✅ Performance deleted: ${id}, player stats recalculated`);

    return res.json({
      success: true,
      message: 'Performance deletada e stats do jogador recalculados',
      performance_id: id
    });

  } catch (error) {
    console.error('❌ Exception in deletePerformance:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar performance',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
