import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { DataService } from '../services/api';

interface AdminPanelProps {
  isAdmin: boolean;
  onAdminCheck: () => Promise<void>;
}

const sections = [
  {
    id: 'rounds',
    title: 'Rodadas & Partidas',
    description: 'Crie rodadas, partidas e gerencie confrontos.'
  },
  {
    id: 'performances',
    title: 'Performances',
    description: 'Insira resultados e notas dos jogos da rodada atual.'
  },
  {
    id: 'finalize',
    title: 'Finalizar Rodada',
    description: 'Valide o checklist e finalize a rodada para atualizar o sistema.'
  },
  {
    id: 'market',
    title: 'Mercado',
    description: 'Controle abertura, fechamento e regras do mercado.'
  },
  {
    id: 'players',
    title: 'Jogadores',
    description: 'Gerencie preços, status e cadastros de atletas.'
  },
  {
    id: 'teams',
    title: 'Times',
    description: 'Atualize logos, nomes e vínculos dos times.'
  },
  {
    id: 'leagues',
    title: 'Ligas',
    description: 'Modere ligas e acessos.'
  },
  {
    id: 'users',
    title: 'Usuários',
    description: 'Audite contas e equipes registradas.'
  }
];

const AdminPanel: React.FC<AdminPanelProps> = ({ isAdmin, onAdminCheck }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [activeSection, setActiveSection] = useState<'players' | 'teams' | 'rounds' | 'performances' | 'finalize' | 'market' | 'users' | 'leagues'>('rounds');
  const [selectedRoundIdForActions, setSelectedRoundIdForActions] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [champions, setChampions] = useState<Array<{ id: number | string; name: string; key_name?: string }>>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [championsLoading, setChampionsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [roundsError, setRoundsError] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [performancesError, setPerformancesError] = useState<string | null>(null);
  const [performancesSuccess, setPerformancesSuccess] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [finalizeRoundLoading, setFinalizeRoundLoading] = useState(false);
  const [finalizeCheckLoading, setFinalizeCheckLoading] = useState(false);
  const [finalizeCheckResult, setFinalizeCheckResult] = useState<any | null>(null);
  const [finalizeTabRoundId, setFinalizeTabRoundId] = useState('');
  const [forceRecalculate] = useState(false); // mantido para compatibilidade, backend ignora
  const [searchQuery, setSearchQuery] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [playerEditId, setPlayerEditId] = useState<string | null>(null);
  const [playerEditForm, setPlayerEditForm] = useState({
    name: '',
    role: '',
    team_id: '',
    price: '',
    image: '',
    is_captain: false
  });
  const [teamEditId, setTeamEditId] = useState<string | null>(null);
  const [teamEditForm, setTeamEditForm] = useState({ name: '', logo_url: '' });
  const [newRoundForm, setNewRoundForm] = useState({
    season: '',
    round_number: '',
    status: 'active'
  });
  const [matchForm, setMatchForm] = useState({
    round_id: '',
    team_a_id: '',
    team_b_id: '',
    games_count: '1'
  });
  const [performanceRoundId, setPerformanceRoundId] = useState('');
  const [performanceMatchId, setPerformanceMatchId] = useState('');
  const [matchScoreInput, setMatchScoreInput] = useState({ teamA: '', teamB: '' });
  const [saveMatchScoreLoading, setSaveMatchScoreLoading] = useState(false);
  const [performanceGamesCount, setPerformanceGamesCount] = useState(1);
  const [performanceRowsByGame, setPerformanceRowsByGame] = useState<Array<{
    gameNumber: number;
    teamA: any[];
    teamB: any[];
  }>>([]);
  const [imageExtractLoading, setImageExtractLoading] = useState(false);
  const [imagePreviewFileName, setImagePreviewFileName] = useState<string | null>(null);
  const [imagePreviewRows, setImagePreviewRows] = useState<Array<{
    index: number;
    player_name: string;
    champion_name: string;
    game_number: number;
    team: 'A' | 'B' | '';
    mapped_player_id: number | string | null;
    mapped_player_name: string | null;
    mapped_champion_id: number | string | null;
    mapped_champion_name: string | null;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    status: 'ok' | 'review';
    message: string;
  }> | null>(null);
  const [imagePreviewScore, setImagePreviewScore] = useState<{ team_a: number; team_b: number } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [recalculatePlayersLoading, setRecalculatePlayersLoading] = useState(false);
  const [marketRoundId, setMarketRoundId] = useState('');
  const [marketCloseTimeInput, setMarketCloseTimeInput] = useState('');
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [marketActionLoading, setMarketActionLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [newTeamForm, setNewTeamForm] = useState({ name: '', logo_url: '' });
  const [newPlayerForm, setNewPlayerForm] = useState({
    name: '',
    role: '',
    team_id: '',
    price: '20',
    is_captain: false
  });
  const [newTeamFile, setNewTeamFile] = useState<File | null>(null);
  const [newPlayerFile, setNewPlayerFile] = useState<File | null>(null);
  const [teamEditFile, setTeamEditFile] = useState<File | null>(null);
  const [playerEditFile, setPlayerEditFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<Record<string, boolean>>({});
  const detailsRef = useRef<HTMLDivElement | null>(null);

  const groupedSections = useMemo(() => {
    return [
      sections.slice(0, 4),
      sections.slice(4, 8)
    ];
  }, []);

  const sectionMeta = useMemo(() => {
    return sections.reduce<Record<string, { title: string; description: string }>>((acc, section) => {
      acc[section.id] = { title: section.title, description: section.description };
      return acc;
    }, {});
  }, []);

  const handleRefresh = async () => {
    setIsChecking(true);
    await onAdminCheck();
    setIsChecking(false);
  };

  const handleOpenSection = (sectionId: string) => {
    if (
      sectionId !== 'players' &&
      sectionId !== 'teams' &&
      sectionId !== 'rounds' &&
      sectionId !== 'performances' &&
      sectionId !== 'finalize' &&
      sectionId !== 'market' &&
      sectionId !== 'users' &&
      sectionId !== 'leagues'
    ) {
      return;
    }
    setActiveSection(sectionId);
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const loadPlayers = useCallback(async () => {
    setPlayersLoading(true);
    setPlayersError(null);
    const result = await DataService.getAdminPlayers();
    if (result.ok) {
      setPlayers(result.players || []);
    } else {
      setPlayersError(result.error || 'Erro ao buscar jogadores');
    }
    setPlayersLoading(false);
  }, []);

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    setTeamsError(null);
    const result = await DataService.getAdminTeams();
    if (result.ok) {
      setTeams(result.teams || []);
    } else {
      setTeamsError(result.error || 'Erro ao buscar times');
    }
    setTeamsLoading(false);
  }, []);

  const loadRounds = useCallback(async () => {
    setRoundsLoading(true);
    setRoundsError(null);
    const result = await DataService.getAdminRounds();
    if (result.ok) {
      setRounds(result.rounds || []);
    } else {
      setRoundsError(result.error || 'Erro ao buscar rodadas');
    }
    setRoundsLoading(false);
  }, []);

  const loadMatches = useCallback(async (roundId?: number) => {
    setMatchesLoading(true);
    setMatchesError(null);
    const result = await DataService.getAdminMatches(roundId);
    if (result.ok) {
      setMatches(result.matches || []);
    } else {
      setMatchesError(result.error || 'Erro ao buscar partidas');
    }
    setMatchesLoading(false);
  }, []);

  const loadChampions = useCallback(async () => {
    setChampionsLoading(true);
    const result = await DataService.getChampions();
    if (result) {
      setChampions(result);
    }
    setChampionsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    const result = await DataService.getAdminUsers();
    if (result.ok) {
      setUsers(result.users || []);
    } else {
      setUsersError(result.error || 'Erro ao buscar usuários');
    }
    setUsersLoading(false);
  }, []);

  const loadLeagues = useCallback(async () => {
    setLeaguesLoading(true);
    setLeaguesError(null);
    const result = await DataService.getAdminLeagues();
    if (result.ok) {
      setLeagues(result.leagues || []);
    } else {
      setLeaguesError(result.error || 'Erro ao buscar ligas');
    }
    setLeaguesLoading(false);
  }, []);

  const loadSectionData = useCallback(async (sectionId: typeof activeSection) => {
    switch (sectionId) {
      case 'players':
        await Promise.all([loadPlayers(), loadTeams()]);
        break;
      case 'teams':
        await loadTeams();
        break;
      case 'rounds':
        await Promise.all([loadRounds(), loadMatches(), loadTeams()]);
        break;
      case 'performances':
        await Promise.all([loadRounds(), loadMatches(), loadPlayers(), loadChampions()]);
        break;
      case 'market':
        await loadRounds();
        break;
      case 'users':
        await loadUsers();
        break;
      case 'leagues':
        await loadLeagues();
        break;
      default:
        break;
    }
  }, [
    loadPlayers,
    loadTeams,
    loadRounds,
    loadMatches,
    loadChampions,
    loadUsers,
    loadLeagues
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    loadSectionData(activeSection);
  }, [isAdmin, activeSection, loadSectionData]);

  useEffect(() => {
    if (!rounds.length) return;
    const activeRound = rounds.find((round) => round.status === 'active' || round.is_market_open);
    if (activeRound?.id) {
      setActiveRoundId(String(activeRound.id));
      if (!marketRoundId) {
        setMarketRoundId(String(activeRound.id));
      }
      if (!selectedRoundIdForActions) {
        setSelectedRoundIdForActions(String(activeRound.id));
      }
      return;
    }
    const upcomingRound = rounds.find((round) => round.status === 'upcoming');
    if (upcomingRound?.id) {
      setActiveRoundId(String(upcomingRound.id));
      if (!marketRoundId) {
        setMarketRoundId(String(upcomingRound.id));
      }
      if (!selectedRoundIdForActions) {
        setSelectedRoundIdForActions(String(upcomingRound.id));
      }
    }
  }, [rounds, marketRoundId, selectedRoundIdForActions]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players;
    const query = searchQuery.toLowerCase();
    return players.filter((player) => {
      const teamName = player.teams?.name || '';
      return (
        player.name?.toLowerCase().includes(query) ||
        player.role?.toLowerCase().includes(query) ||
        teamName.toLowerCase().includes(query)
      );
    });
  }, [players, searchQuery]);

  const handlePriceChange = (playerId: string, value: string) => {
    setPriceEdits((prev) => ({
      ...prev,
      [playerId]: value
    }));
  };

  const handlePriceSave = async (playerId: string) => {
    const rawValue = priceEdits[playerId];
    const parsed = parseFloat(rawValue.replace(',', '.'));

    if (Number.isNaN(parsed) || parsed <= 0) {
      setPlayersError('Preço inválido. Informe um valor maior que zero.');
      return;
    }

    setPlayersError(null);
    const result = await DataService.updateAdminPlayerPrice(playerId, parsed);
    if (!result.ok) {
      setPlayersError(result.error || 'Erro ao atualizar preço');
      return;
    }

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, price: parsed } : player
      )
    );
    setPriceEdits((prev) => {
      const { [playerId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleEditPlayer = (player: any) => {
    setPlayerEditId(player.id);
    setPlayerEditForm({
      name: player.name || '',
      role: player.role || '',
      team_id: player.team_id || '',
      price: String(player.price ?? ''),
      image: player.image || '',
      is_captain: Boolean(player.is_captain)
    });
  };

  const handleEditTeam = (team: any) => {
    setTeamEditId(team.id);
    setTeamEditForm({
      name: team.name || '',
      logo_url: team.logo_url || ''
    });
  };

  const handleCreateRound = async () => {
    const seasonRawValue = newRoundForm.season.trim();
    const roundRawValue = newRoundForm.round_number.trim();
    const seasonValue = Number.parseInt(seasonRawValue, 10);
    const roundValue = Number.parseInt(roundRawValue, 10);

    const hasInvalidSeason = !seasonRawValue || !Number.isInteger(seasonValue) || seasonValue <= 0;
    const hasInvalidRoundNumber = !roundRawValue || !Number.isInteger(roundValue) || roundValue <= 0;

    if (hasInvalidSeason || hasInvalidRoundNumber) {
      setRoundsError('Informe temporada e numero da rodada.');
      return;
    }

    setRoundsError(null);
    const resolvedStartDate = new Date().toISOString();
    const result = await DataService.createAdminRound({
      season: seasonValue,
      round_number: roundValue,
      status: newRoundForm.status || 'active',
      start_date: resolvedStartDate,
      market_close_time: resolvedStartDate,
      is_market_open: false
    });

    if (!result.ok) {
      setRoundsError(result.error || 'Erro ao criar rodada');
      return;
    }

    setNewRoundForm({
      season: '',
      round_number: '',
      status: 'active'
    });
    await loadRounds();
    window.dispatchEvent(new Event('matches:refresh'));
  };

  const handleDeleteRound = async (roundId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta rodada? Todas as partidas e performances associadas serao removidas.')) {
      return;
    }
    const result = await DataService.deleteAdminRound(roundId);
    if (!result.ok) {
      setRoundsError(result.error || 'Erro ao excluir rodada');
      return;
    }
    setRoundsError(null);
    if (String(roundId) === selectedRoundIdForActions) {
      setSelectedRoundIdForActions('');
    }
    await loadRounds();
    await loadMatches();
  };

  const handleMatchFormChange = (field: string, value: string) => {
    setMatchForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateMatch = async () => {
    const gamesCount = matchForm.games_count === '' ? null : Number(matchForm.games_count);

    const missingFields: string[] = [];
    if (!matchForm.round_id) missingFields.push('Rodada');
    if (!matchForm.team_a_id) missingFields.push('Time A');
    if (!matchForm.team_b_id) missingFields.push('Time B');
    if (gamesCount === null) missingFields.push('Numero de partidas');

    if (missingFields.length > 0) {
      setMatchesError(`Preencha todos os campos para criar a partida: ${missingFields.join(', ')}.`);
      return;
    }

    const roundId = matchForm.round_id;
    const teamAId = matchForm.team_a_id;
    const teamBId = matchForm.team_b_id;
    if (teamAId === teamBId) {
      setMatchesError('Time A e Time B precisam ser diferentes.');
      return;
    }

    if (gamesCount !== null && (Number.isNaN(gamesCount) || gamesCount <= 0)) {
      setMatchesError('Numero de partidas invalido.');
      return;
    }

    setMatchesError(null);
    const result = await DataService.createAdminMatch({
      round_id: roundId,
      team_a_id: teamAId,
      team_b_id: teamBId,
      status: 'scheduled',
      scheduled_time: new Date().toISOString(),
      games_count: gamesCount || 1
    });

    if (!result.ok) {
      setMatchesError(result.error || 'Erro ao criar partida');
      return;
    }

      setMatchForm({
        round_id: '',
        team_a_id: '',
        team_b_id: '',
        games_count: '1'
      });
    await loadMatches(roundId);
    window.dispatchEvent(new Event('matches:refresh'));
  };

  const handleSaveMarketCloseTime = async () => {
    const roundId = Number(marketRoundId);
    if (!roundId) {
      setMarketError('Selecione uma rodada para definir o fechamento.');
      return;
    }

    if (!marketCloseTimeInput) {
      setMarketError('Informe uma data de fechamento do mercado.');
      return;
    }

    const parsedCloseTime = new Date(marketCloseTimeInput);
    if (Number.isNaN(parsedCloseTime.getTime())) {
      setMarketError('Data de fechamento inválida.');
      return;
    }

    setMarketError(null);
    setMarketActionLoading(true);
    const result = await DataService.updateAdminRoundDates(roundId, {
      market_close_time: parsedCloseTime.toISOString()
    });

    if (!result.ok) {
      setMarketError(result.error || 'Erro ao definir fechamento do mercado');
      setMarketActionLoading(false);
      return;
    }

    await loadRounds();
    window.dispatchEvent(new Event('matches:refresh'));
    window.dispatchEvent(new Event('market:refresh'));
    setMarketActionLoading(false);
  };

  const handleMatchDelete = async (matchId: number) => {
    const confirmed = window.confirm('Deseja deletar esta partida?');
    if (!confirmed) return;
    setMatchesError(null);
    const result = await DataService.deleteAdminMatch(matchId);
    if (!result.ok) {
      setMatchesError(result.error || 'Erro ao deletar partida');
      return;
    }
    await loadMatches();
    window.dispatchEvent(new Event('matches:refresh'));
  };

  const buildPerformanceRow = (player: any, matchId: string, gameNumber: number) => ({
    match_id: matchId,
    game_number: gameNumber,
    player_id: player.id,
    champion_id: '',
    kills: '',
    deaths: '',
    assists: '',
    cs: ''
  });

  const handlePerformanceRoundChange = (roundId: string) => {
    setPerformancesSuccess(null);
    setPerformanceRoundId(roundId);
    setPerformanceMatchId('');
    setMatchScoreInput({ teamA: '', teamB: '' });
    setImagePreviewRows(null);
    setImagePreviewScore(null);
    setImagePreviewFileName(null);
    setPerformanceGamesCount(1);
    setPerformanceRowsByGame([]);
  };

  const handlePerformanceMatchChange = (matchId: string) => {
    setPerformancesSuccess(null);
    setPerformanceMatchId(matchId);
    setImagePreviewRows(null);
    setImagePreviewScore(null);
    setImagePreviewFileName(null);
    const match = matches.find((item) => String(item.id) === String(matchId));
    if (!match) {
      setMatchScoreInput({ teamA: '', teamB: '' });
      setPerformanceGamesCount(1);
      setPerformanceRowsByGame([]);
      return;
    }
    const roleOrder = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const sortByRole = (playerA: any, playerB: any) =>
      roleOrder.indexOf(playerA.role) - roleOrder.indexOf(playerB.role);

    const teamAPlayers = players
      .filter((player) => String(player.team_id) === String(match.team_a_id))
      .sort(sortByRole);
    const teamBPlayers = players
      .filter((player) => String(player.team_id) === String(match.team_b_id))
      .sort(sortByRole);
    const gamesCount = Number(match.games_count || 1);
    setMatchScoreInput({
      teamA: match.team_a_score === null || match.team_a_score === undefined ? '' : String(match.team_a_score),
      teamB: match.team_b_score === null || match.team_b_score === undefined ? '' : String(match.team_b_score)
    });
    setPerformanceGamesCount(gamesCount);
    setPerformanceRowsByGame(
      Array.from({ length: gamesCount }).map((_, index) => {
        const gameNumber = index + 1;
        return {
          gameNumber,
          teamA: teamAPlayers.map((player) => buildPerformanceRow(player, matchId, gameNumber)),
          teamB: teamBPlayers.map((player) => buildPerformanceRow(player, matchId, gameNumber))
        };
      })
    );
  };

  const handleImportPerformancesImage = async (file: File | null) => {
    if (!file) return;
    if (!performanceMatchId) {
      setPerformancesError('Selecione uma partida antes de importar o print.');
      return;
    }
    if (performanceRowsByGame.length === 0) {
      setPerformancesError('Selecione a partida para carregar os jogadores antes de importar o print.');
      return;
    }

    setImageExtractLoading(true);
    setPerformancesError(null);
    setPerformancesSuccess(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await DataService.extractAdminPerformancesFromImage({
        match_id: Number(performanceMatchId),
        image_data: dataUrl
      });

      if (!result.ok) {
        setPerformancesError(result.error || 'Erro ao extrair dados da imagem');
        return;
      }

      setImagePreviewFileName(file.name);
      setImagePreviewRows(result.rows || []);
      setImagePreviewScore(result.score || null);
    } catch (error) {
      setPerformancesError(String(error));
    } finally {
      setImageExtractLoading(false);
    }
  };

  const handleImagePreviewRowChange = (
    index: number,
    field: 'mapped_player_id' | 'mapped_champion_id' | 'kills' | 'deaths' | 'assists' | 'cs',
    value: string
  ) => {
    setImagePreviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        let nextRow: typeof row = { ...row };

        if (field === 'mapped_player_id') {
          const selectedPlayer = players.find((player) => String(player.id) === value);
          nextRow = {
            ...nextRow,
            mapped_player_id: value ? value : null,
            mapped_player_name: selectedPlayer ? selectedPlayer.name : null
          };
        }

        if (field === 'mapped_champion_id') {
          const selectedChampion = champions.find((champion) => String(champion.id) === value);
          nextRow = {
            ...nextRow,
            mapped_champion_id: value ? value : null,
            mapped_champion_name: selectedChampion ? selectedChampion.name : null
          };
        }

        if (field === 'kills' || field === 'deaths' || field === 'assists' || field === 'cs') {
          const parsed = Number(value);
          nextRow = {
            ...nextRow,
            [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
          };
        }

        const numericOk = [nextRow.kills, nextRow.deaths, nextRow.assists, nextRow.cs].every(
          (numberValue) => Number.isFinite(Number(numberValue)) && Number(numberValue) >= 0
        );
        const rowOk = Boolean(nextRow.mapped_player_id && nextRow.mapped_champion_id && numericOk);

        return {
          ...nextRow,
          status: rowOk ? 'ok' : 'review',
          message: rowOk ? 'Mapeado com sucesso' : 'Revise jogador/campeão/KDA/CS'
        };
      });
    });
  };

  const handleApplyImagePreview = async () => {
    if (!imagePreviewRows || imagePreviewRows.length === 0) return;
    const hasReview = imagePreviewRows.some((row) => row.status !== 'ok');
    if (hasReview) {
      setPerformancesError('Revise as linhas pendentes antes de aplicar os dados do print.');
      return;
    }

    const updatedRows = performanceRowsByGame.map((game) => ({
      ...game,
      teamA: game.teamA.map((row: any) => ({ ...row })),
      teamB: game.teamB.map((row: any) => ({ ...row }))
    }));

    const findRow = (gameNumber: number, playerId: string) => {
      const gameIndex = updatedRows.findIndex((game) => game.gameNumber === gameNumber);
      if (gameIndex === -1) return null;
      const game = updatedRows[gameIndex];
      const teamARow = game.teamA.find((row: any) => String(row.player_id) === playerId);
      if (teamARow) return teamARow;
      const teamBRow = game.teamB.find((row: any) => String(row.player_id) === playerId);
      if (teamBRow) return teamBRow;
      return null;
    };

    for (const row of imagePreviewRows) {
      const mappedPlayerId = row.mapped_player_id;
      const mappedChampionId = row.mapped_champion_id;
      if (!mappedPlayerId || !mappedChampionId) continue;
      const target = findRow(Number(row.game_number || 1), String(mappedPlayerId));
      if (!target) continue;
      target.champion_id = String(mappedChampionId);
      target.kills = String(row.kills);
      target.deaths = String(row.deaths);
      target.assists = String(row.assists);
      target.cs = String(row.cs);
    }

    setPerformanceRowsByGame(updatedRows);

    if (imagePreviewScore) {
      setMatchScoreInput({
        teamA: String(imagePreviewScore.team_a),
        teamB: String(imagePreviewScore.team_b)
      });
    }

    setImagePreviewRows(null);
    setImagePreviewScore(null);
    setImagePreviewFileName(null);
    setPerformancesError(null);
    setPerformancesSuccess('Dados do print aplicados. Confira placar/tabela e salve as performances.');
  };

  const handleRecalculatePlayers = async () => {
    setPerformancesError(null);
    setRecalculatePlayersLoading(true);

    try {
      const anonKey = DataService.getAnonKey();
      const userToken = DataService.getUserToken();
      if (!userToken) {
        setPerformancesError('Usuario nao autenticado.');
        return;
      }

      const response = await fetch(`${DataService.API_BASE_URL}/admin/performances/recalculate-players`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        setPerformancesError(errorText || 'Erro ao recalcular pontos dos jogadores');
        return;
      }

      const data = await response.json().catch(() => null);
      if (data?.success === false) {
        setPerformancesError(data?.error || 'Erro ao recalcular pontos dos jogadores');
        return;
      }

      if (data?.totalPerformances === 0) {
        setPerformancesError('Nenhuma performance encontrada para recalcular.');
      } else if (data?.updateErrors > 0) {
        const sample = data?.updateErrorSamples?.[0]?.message;
        const serviceRoleInfo = data?.serviceRoleConfigured ? 'Service role configurada.' : 'Service role NAO configurada.';
        setPerformancesError(`Falha ao atualizar ${data.updateErrors} jogadores. ${serviceRoleInfo}${sample ? ` Ex: ${sample}` : ''}`);
      } else if (data?.remainingNulls > 0) {
        setPerformancesError(`Ainda existem ${data.remainingNulls} performances sem pontuação. Verifique system_config.`);
      }

      await loadPlayers();
      window.dispatchEvent(new Event('players:refresh'));
      window.dispatchEvent(new Event('leagues:refresh'));
    } catch (error) {
      setPerformancesError(String(error));
    } finally {
      setRecalculatePlayersLoading(false);
    }
  };


  const handleResetData = async () => {
    if (!window.confirm('ATENÇÃO: Isso vai deletar TODAS as performances, matches e zerar stats dos jogadores. Tem certeza?')) {
      return;
    }
    if (!window.confirm('SEGUNDA CONFIRMAÇÃO: Essa ação é irreversível. Deseja continuar?')) {
      return;
    }

    setResetLoading(true);
    setResetResult(null);

    try {
      const result = await DataService.resetData();
      if (result.ok) {
        setResetResult({ success: true, message: `Reset concluído! Performances: ${result.verification?.performances_remaining || 0}, Matches: ${result.verification?.matches_remaining || 0}` });
        await loadPlayers();
        await loadRounds();
        await loadMatches();
        window.dispatchEvent(new Event('players:refresh'));
      } else {
        setResetResult({ success: false, message: result.error || 'Erro ao resetar' });
      }
    } catch (error) {
      setResetResult({ success: false, message: String(error) });
    } finally {
      setResetLoading(false);
    }
  };

  const handlePerformanceRowChange = (
    team: 'A' | 'B',
    gameIndex: number,
    rowIndex: number,
    field: string,
    value: string
  ) => {
    setPerformancesSuccess(null);
    setPerformanceRowsByGame((prev) =>
      prev.map((game, idx) => {
        if (idx !== gameIndex) return game;
        const updateRows = (rows: any[]) =>
          rows.map((row, rIndex) =>
            rIndex === rowIndex ? { ...row, [field]: value } : row
          );
        return {
          ...game,
          teamA: team === 'A' ? updateRows(game.teamA) : game.teamA,
          teamB: team === 'B' ? updateRows(game.teamB) : game.teamB
        };
      })
    );
  };

  const selectedPerformanceMatch = useMemo(
    () => matches.find((item) => String(item.id) === String(performanceMatchId)) || null,
    [matches, performanceMatchId]
  );

  const performanceFlowSteps = useMemo(() => {
    const hasRound = Boolean(performanceRoundId);
    const hasMatch = Boolean(selectedPerformanceMatch);

    const hasSavedScore = Boolean(
      selectedPerformanceMatch &&
      selectedPerformanceMatch.team_a_score !== null &&
      selectedPerformanceMatch.team_a_score !== undefined &&
      selectedPerformanceMatch.team_b_score !== null &&
      selectedPerformanceMatch.team_b_score !== undefined &&
      selectedPerformanceMatch.winner_id
    );

    const rows = performanceRowsByGame.flatMap((game) => [...game.teamA, ...game.teamB]);
    const hasRows = rows.length > 0;
    const isNumericFieldFilled = (value: unknown) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) return false;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) && parsed >= 0;
    };

    const performancesReady =
      hasRows &&
      rows.every((row) =>
        String(row.champion_id || '').trim() &&
        isNumericFieldFilled(row.kills) &&
        isNumericFieldFilled(row.deaths) &&
        isNumericFieldFilled(row.assists) &&
        isNumericFieldFilled(row.cs)
      );

    return [
      { id: 'round', label: 'Rodada selecionada', done: hasRound },
      { id: 'match', label: 'Partida selecionada', done: hasMatch },
      { id: 'score', label: 'Placar salvo', done: hasSavedScore },
      { id: 'performances', label: 'Tabela completa', done: performancesReady }
    ];
  }, [performanceRoundId, selectedPerformanceMatch, performanceRowsByGame, finalizeCheckResult]);

  const canFinalizeFlow = performanceFlowSteps.every((step) => step.done);

  const handleSaveMatchScore = async () => {
    if (!selectedPerformanceMatch) {
      setPerformancesError('Selecione uma partida valida para salvar o placar.');
      return;
    }

    const teamAScore = Number(matchScoreInput.teamA);
    const teamBScore = Number(matchScoreInput.teamB);

    if (!Number.isFinite(teamAScore) || teamAScore < 0 || !Number.isFinite(teamBScore) || teamBScore < 0) {
      setPerformancesError('Informe um placar valido. Use numeros inteiros maiores ou iguais a zero.');
      return;
    }

    const winnerId =
      teamAScore > teamBScore
        ? selectedPerformanceMatch.team_a_id
        : teamBScore > teamAScore
          ? selectedPerformanceMatch.team_b_id
          : null;

    setSaveMatchScoreLoading(true);
    setPerformancesError(null);
    setPerformancesSuccess(null);

    try {
      const anonKey = DataService.getAnonKey();
      const userToken = DataService.getUserToken();
      if (!userToken) {
        setPerformancesError('Usuario nao autenticado.');
        return;
      }

      const response = await fetch(`${DataService.API_BASE_URL}/admin/matches/${selectedPerformanceMatch.id}`, {
        method: 'PUT',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team_a_score: teamAScore,
          team_b_score: teamBScore,
          winner_id: winnerId,
          status: 'completed'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setPerformancesError(errorText || 'Erro ao salvar placar da partida');
        return;
      }

      await loadMatches(performanceRoundId ? Number(performanceRoundId) : undefined);
    } catch (error) {
      setPerformancesError(String(error));
    } finally {
      setSaveMatchScoreLoading(false);
    }
  };


  const handleSubmitPerformances = async () => {
    setPerformancesSuccess(null);
    const matchId = Number(performanceMatchId);
    if (!matchId) {
      setPerformancesError('Selecione uma partida valida.');
      return;
    }

    const allRows = performanceRowsByGame.flatMap((game) => [...game.teamA, ...game.teamB]);
    if (allRows.length === 0) {
      setPerformancesError('Selecione uma partida com times carregados.');
      return;
    }

    const useNumericPlayerIds = players.length > 0 && players.every((player) => Number.isFinite(Number(player.id)));
    const useNumericChampionIds = champions.length > 0 && champions.every((champion) => Number.isFinite(Number(champion.id)));

    for (const game of performanceRowsByGame) {
      const blocks = [
        { label: 'Time A', rows: game.teamA },
        { label: 'Time B', rows: game.teamB }
      ];
      for (const block of blocks) {
        for (let index = 0; index < block.rows.length; index++) {
          const row = block.rows[index];
          if (!String(row.player_id || '').trim()) {
            setPerformancesError(`Linha sem jogador em Partida ${game.gameNumber} - ${block.label} - Linha ${index + 1}.`);
            return;
          }
        }
      }
    }

    const missingPlayerRow = allRows.find((row) => !String(row.player_id || '').trim());
    if (missingPlayerRow) {
      setPerformancesError('Jogador ausente em uma das linhas. Recarregue a partida e tente novamente.');
      return;
    }

    for (const game of performanceRowsByGame) {
      const checkRows = [
        { label: 'Time A', rows: game.teamA },
        { label: 'Time B', rows: game.teamB }
      ];
      for (const block of checkRows) {
        for (const row of block.rows) {
          if (!String(row.champion_id || '').trim()) {
            const playerName = players.find((player) => String(player.id) === String(row.player_id))?.name || row.player_id;
            setPerformancesError(`Preencha todos os campeoes. Falta em Partida ${game.gameNumber} - ${block.label} - ${playerName}.`);
            return;
          }
        }
      }
    }

    const parsedRows = allRows.map((row) => ({
      player_id: useNumericPlayerIds ? Number(row.player_id) : String(row.player_id),
      champion_id: useNumericChampionIds ? Number(row.champion_id) : String(row.champion_id),
      kills: Number(row.kills),
      deaths: Number(row.deaths),
      assists: Number(row.assists),
      cs: Number(row.cs),
      game_number: Number(row.game_number)
    }));

    if (useNumericPlayerIds && parsedRows.some((row) => Number.isNaN(row.player_id))) {
      setPerformancesError('player_id inválido. Confira se o CSV usa player_id numérico ou selecione a partida novamente.');
      return;
    }

    if (useNumericChampionIds && parsedRows.some((row) => Number.isNaN(row.champion_id))) {
      setPerformancesError('champion_id inválido. Confira o CSV e selecione um campeão válido.');
      return;
    }

    const requiredFields = ['player_id', 'champion_id', 'kills', 'deaths', 'assists', 'cs', 'game_number'] as const;
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      for (const field of requiredFields) {
        const value = row[field];
        if (value === undefined || value === null || value === '') {
          setPerformancesError(`Campo obrigatório faltando: ${field} (linha ${i + 1}).`);
          return;
        }
      }
    }

    setPerformancesError(null);
    const anonKey = DataService.getAnonKey();
    const userToken = DataService.getUserToken();
    if (!userToken) {
      setPerformancesError('Usuario nao autenticado.');
      return;
    }

    try {
      const response = await fetch(`${DataService.API_BASE_URL}/admin/performances/bulk`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          match_id: matchId,
          performances: parsedRows
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setPerformancesError(errorText || 'Erro ao inserir performances');
        return;
      }

      let responseBody: any = null;
      try {
        responseBody = await response.json();
      } catch (error) {
        responseBody = null;
      }

      if (responseBody?.success === false) {
        setPerformancesError(responseBody?.error || 'Erro ao inserir performances');
        return;
      }

      setPerformanceRowsByGame([]);
      setPerformanceMatchId('');
      setMatchScoreInput({ teamA: '', teamB: '' });
      setImagePreviewRows(null);
      setImagePreviewScore(null);
      setImagePreviewFileName(null);
      setPerformancesSuccess('Performances salvas com sucesso. Pronto para inserir a proxima partida.');
    } catch (error) {
      setPerformancesError(String(error));
    }
  };

  const handleMarketAction = async (action: 'open' | 'close') => {
    const roundId = Number(marketRoundId);
    if (!roundId) {
      setMarketError('Informe o ID da rodada.');
      return;
    }

    setMarketError(null);
    setMarketActionLoading(true);

    try {
      const anonKey = DataService.getAnonKey();
      const userToken = DataService.getUserToken();
      if (!userToken) {
        setMarketError('Usuario nao autenticado.');
        setMarketActionLoading(false);
        return;
      }

      const endpoint = action === 'open'
        ? `${DataService.API_BASE_URL}/admin/market/force-open/${roundId}`
        : `${DataService.API_BASE_URL}/admin/market/force-close/${roundId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMarketError(errorText || 'Erro ao atualizar mercado');
      } else {
        await loadRounds();
        window.dispatchEvent(new Event('matches:refresh'));
        window.dispatchEvent(new Event('market:refresh'));
      }
    } catch (error) {
      setMarketError(String(error));
    } finally {
      setMarketActionLoading(false);
    }
  };

  const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (input: number) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (!marketRoundId) {
      setMarketCloseTimeInput('');
      return;
    }
    const selectedRound = rounds.find((round) => String(round.id) === String(marketRoundId));
    setMarketCloseTimeInput(toDateTimeLocalValue(selectedRound?.market_close_time));
  }, [marketRoundId, rounds]);

  const renderPlayers = () => {
    if (playersLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando jogadores...</span>
          </div>
        </div>
      );
    }

    if (playersError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {playersError}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="glass-card border border-white/5 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Novo jogador</p>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Nome</label>
                  <input
                    value={newPlayerForm.name}
                    onChange={(event) => setNewPlayerForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Nome"
                    className="bg-black/40 border border-white/10 text-sm text-gray-200 px-4 py-3 rounded-lg w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Role</label>
                  <select
                    value={newPlayerForm.role}
                    onChange={(event) => setNewPlayerForm((prev) => ({ ...prev, role: event.target.value }))}
                    className="bg-black/40 border border-white/10 text-sm text-gray-200 px-4 py-3 rounded-lg w-full focus:outline-none focus:border-[#6366F1]/60 focus:ring-1 focus:ring-[#6366F1]/30"
                  >
                    <option value="">Role</option>
                    <option value="TOP">TOP</option>
                    <option value="JUNGLE">JUNGLE</option>
                    <option value="MID">MID</option>
                    <option value="ADC">ADC</option>
                    <option value="SUPPORT">SUPPORT</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Time</label>
                  <select
                    value={newPlayerForm.team_id}
                    onChange={(event) => setNewPlayerForm((prev) => ({ ...prev, team_id: event.target.value }))}
                    className="bg-black/40 border border-white/10 text-sm text-gray-200 px-4 py-2 rounded-lg w-full focus:outline-none focus:border-[#6366F1]/60 focus:ring-1 focus:ring-[#6366F1]/30"
                  >
                    <option value="">Selecionar time</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Preco</label>
                  <input
                    value={newPlayerForm.price}
                    onChange={(event) => setNewPlayerForm((prev) => ({ ...prev, price: event.target.value }))}
                    placeholder="Preco"
                    className="bg-black/40 border border-white/10 text-sm text-gray-200 px-4 py-2 rounded-lg w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Captain</label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 bg-black/30 border border-white/10 px-4 py-2 rounded-lg w-full">
                    <input
                      type="checkbox"
                      checked={newPlayerForm.is_captain}
                      onChange={(event) => setNewPlayerForm((prev) => ({ ...prev, is_captain: event.target.checked }))}
                    />
                    Captain
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 flex flex-col items-center justify-center gap-2 min-h-[170px] cursor-pointer hover:border-white/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setNewPlayerFile(event.target.files?.[0] || null)}
                  className="sr-only"
                />
                {newPlayerFile ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-black">
                    <img
                      src={URL.createObjectURL(newPlayerFile)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center">Clique para enviar imagem</div>
                )}
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-600">Imagem do jogador</span>
              </label>
              <div className="flex items-center justify-end">
                <button
                  onClick={async () => {
                    const priceValue = Number(newPlayerForm.price || '20');
                    if (!newPlayerForm.name || !newPlayerForm.role || !newPlayerFile) {
                      setPlayersError('Preencha nome, role e envie a imagem.');
                      return;
                    }
                    try {
                      setUploadLoading((prev) => ({ ...prev, playerCreate: true }));
                      const imageData = await readFileAsDataUrl(newPlayerFile);
                      const result = await DataService.createAdminPlayerWithImage({
                        name: newPlayerForm.name,
                        role: newPlayerForm.role,
                        team_id: newPlayerForm.team_id || null,
                        price: priceValue,
                        image_name: imageData,
                        is_captain: newPlayerForm.is_captain
                      });
                      if (!result.ok) {
                        setPlayersError(result.error || 'Erro ao criar jogador');
                        return;
                      }
                      setNewPlayerForm({
                        name: '',
                        role: '',
                        team_id: '',
                        price: '20',
                        is_captain: false
                      });
                      setNewPlayerFile(null);
                      await loadPlayers();
                    } catch (error) {
                      setPlayersError(String(error));
                    } finally {
                      setUploadLoading((prev) => ({ ...prev, playerCreate: false }));
                    }
                  }}
                  className="btn-primary text-xs uppercase tracking-wider"
                >
                  {uploadLoading.playerCreate ? 'Enviando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {playerEditId && (
          <div className="glass-card border border-white/5 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Editar jogador</p>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Nome</label>
                    <input
                      value={playerEditForm.name}
                      onChange={(event) => setPlayerEditForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Nome"
                      className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2.5 rounded-lg w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Role</label>
                    <select
                      value={playerEditForm.role}
                      onChange={(event) => setPlayerEditForm((prev) => ({ ...prev, role: event.target.value }))}
                      className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2.5 rounded-lg w-full focus:outline-none focus:border-[#6366F1]/60 focus:ring-1 focus:ring-[#6366F1]/30"
                    >
                      <option value="">Role</option>
                      <option value="TOP">TOP</option>
                      <option value="JUNGLE">JUNGLE</option>
                      <option value="MID">MID</option>
                      <option value="ADC">ADC</option>
                      <option value="SUPPORT">SUPPORT</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Time</label>
                    <select
                      value={playerEditForm.team_id}
                      onChange={(event) => setPlayerEditForm((prev) => ({ ...prev, team_id: event.target.value }))}
                      className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:border-[#6366F1]/60 focus:ring-1 focus:ring-[#6366F1]/30"
                    >
                      <option value="">Selecionar time</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Preco</label>
                    <input
                      value={playerEditForm.price}
                      onChange={(event) => setPlayerEditForm((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="Preco"
                      className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2 rounded-lg w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Captain</label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 bg-black/30 border border-white/10 px-3 py-2 rounded-lg w-full">
                      <input
                        type="checkbox"
                        checked={playerEditForm.is_captain}
                        onChange={(event) => setPlayerEditForm((prev) => ({ ...prev, is_captain: event.target.checked }))}
                      />
                      Captain
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 flex flex-col items-center justify-center gap-2 min-h-[160px] cursor-pointer hover:border-white/30 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setPlayerEditFile(event.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  {(playerEditFile || playerEditForm.image) ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-white/10 bg-black">
                      <img
                        src={
                          playerEditFile
                            ? URL.createObjectURL(playerEditFile)
                            : DataService.getStorageUrl('players', playerEditForm.image)
                        }
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center">Clique para enviar imagem</div>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-600">Imagem do jogador</span>
                </label>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={async () => {
                      const priceValue = playerEditForm.price === '' ? undefined : Number(playerEditForm.price);
                      try {
                        if (playerEditFile) {
                          setUploadLoading((prev) => ({ ...prev, playerEdit: true }));
                        }
                        const imageData = playerEditFile ? await readFileAsDataUrl(playerEditFile) : null;
                        const result = await DataService.updateAdminPlayer(playerEditId, {
                          name: playerEditForm.name,
                          role: playerEditForm.role,
                          team_id: playerEditForm.team_id || null,
                          price: priceValue,
                          image: imageData ? undefined : playerEditForm.image,
                          image_name: imageData || undefined,
                          is_captain: playerEditForm.is_captain
                        });
                        if (!result.ok) {
                          setPlayersError(result.error || 'Erro ao atualizar jogador');
                          return;
                        }
                        setPlayerEditFile(null);
                        setPlayerEditId(null);
                        await loadPlayers();
                      } catch (error) {
                        setPlayersError(String(error));
                      } finally {
                        setUploadLoading((prev) => ({ ...prev, playerEdit: false }));
                      }
                    }}
                    className="btn-primary text-xs uppercase tracking-wider"
                  >
                    {uploadLoading.playerEdit ? 'Enviando...' : 'Salvar edicao'}
                  </button>
                  <button
                    onClick={() => setPlayerEditId(null)}
                    className="btn-secondary text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Jogadores</p>
              <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
                {filteredPlayers.length} atletas cadastrados
              </h3>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: players</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 text-xs"></i>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nome, time ou rota"
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-300 pl-8 pr-4 py-2 rounded-full focus:outline-none focus:border-[#6366F1]/60"
                />
              </div>
              <button
                onClick={loadPlayers}
                className="btn-secondary text-xs uppercase tracking-wider"
              >
                Atualizar
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-black/60 text-gray-500 text-[11px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
                <tr>
                  <th className="px-4 py-3">Jogador</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Rota</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPlayers.map((player) => {
                  const currentValue = priceEdits[player.id] ?? String(player.price ?? '');
                  return (
                    <tr key={player.id} className="hover:bg-white/[0.03] odd:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden">
                            {player.image ? (
                              <img
                                src={DataService.getStorageUrl('players', player.image)}
                                alt={player.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">{player.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">ID {player.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-black border border-white/10 overflow-hidden">
                            {player.teams?.logo_url ? (
                              <img
                                src={DataService.getStorageUrl('teams', player.teams.logo_url)}
                                alt={player.teams?.name}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                            {player.teams?.name || 'Sem time'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {player.role || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={currentValue}
                          onChange={(event) => handlePriceChange(player.id, event.target.value)}
                          className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-28"
                        />
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button
                          onClick={() => handlePriceSave(player.id)}
                          className="btn-primary text-xs uppercase tracking-wider"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => handleEditPlayer(player)}
                          className="text-[10px] uppercase tracking-wider text-blue-300 border border-blue-500/40 px-3 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm('Deseja deletar este jogador?');
                            if (!confirmed) return;
                            const result = await DataService.deleteAdminPlayer(player.id);
                            if (!result.ok) {
                              setPlayersError(result.error || 'Erro ao deletar jogador');
                              return;
                            }
                            setPlayers((prev) => prev.filter((item) => item.id !== player.id));
                          }}
                          className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/40 px-3 py-1"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTeams = () => {
    if (teamsLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando times...</span>
          </div>
        </div>
      );
    }

    if (teamsError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {teamsError}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="glass-card border border-white/5 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Novo time</p>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">Nome</label>
                  <input
                    value={newTeamForm.name}
                    onChange={(event) => setNewTeamForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Nome"
                    className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2 rounded-md w-full"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newTeamForm.name || !newTeamFile) {
                      setTeamsError('Preencha nome e envie o logo.');
                      return;
                    }
                    try {
                      setUploadLoading((prev) => ({ ...prev, teamCreate: true }));
                      const logoData = await readFileAsDataUrl(newTeamFile);
                      const result = await DataService.createAdminTeamWithLogo({
                        name: newTeamForm.name,
                        logo_data: logoData
                      });
                      if (!result.ok) {
                        setTeamsError(result.error || 'Erro ao criar time');
                        return;
                      }
                      setNewTeamForm({ name: '', logo_url: '' });
                      setNewTeamFile(null);
                      await loadTeams();
                    } catch (error) {
                      setTeamsError(String(error));
                    } finally {
                      setUploadLoading((prev) => ({ ...prev, teamCreate: false }));
                    }
                  }}
                  className="btn-primary text-xs uppercase tracking-wider h-9 px-6"
                >
                  {uploadLoading.teamCreate ? 'Enviando...' : 'Adicionar'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="rounded-md border border-dashed border-white/15 bg-black/20 p-2 flex flex-col items-center justify-center gap-2 min-h-[110px] cursor-pointer hover:border-white/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setNewTeamFile(event.target.files?.[0] || null)}
                  className="sr-only"
                />
                {newTeamFile ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-black">
                    <img
                      src={URL.createObjectURL(newTeamFile)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center">Clique para enviar logo</div>
                )}
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-600">Logo do time</span>
              </label>
              <div className="flex items-center justify-end"></div>
            </div>
          </div>
        </div>

        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Times</p>
              <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
                {teams.length} equipes cadastradas
              </h3>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: teams</p>
            </div>
            <button
              onClick={loadTeams}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {teamEditId && (
              <div className="bg-black/40 border border-white/5 p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={teamEditForm.name}
                    onChange={(event) => setTeamEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Nome"
                    className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
                  />
                  <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setTeamEditFile(event.target.files?.[0] || null)}
                  className="text-xs text-gray-400"
                />
                    {(teamEditFile || teamEditForm.logo_url) && (
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-black">
                        <img
                          src={teamEditFile ? URL.createObjectURL(teamEditFile) : teamEditForm.logo_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                    try {
                      if (teamEditFile) {
                        setUploadLoading((prev) => ({ ...prev, teamEdit: true }));
                      }
                      const logoData = teamEditFile ? await readFileAsDataUrl(teamEditFile) : null;
                      const result = await DataService.updateAdminTeam(teamEditId, {
                        name: teamEditForm.name,
                        logo_url: logoData ? undefined : teamEditForm.logo_url,
                        logo_data: logoData || undefined
                      });
                      if (!result.ok) {
                        setTeamsError(result.error || 'Erro ao atualizar time');
                        return;
                      }
                      setTeamEditFile(null);
                      setTeamEditId(null);
                      await loadTeams();
                    } catch (error) {
                      setTeamsError(String(error));
                    } finally {
                      setUploadLoading((prev) => ({ ...prev, teamEdit: false }));
                    }
                  }}
                  className="btn-primary text-xs uppercase tracking-wider"
                >
                  {uploadLoading.teamEdit ? 'Enviando...' : 'Salvar edicao'}
                </button>
                  <button
                    onClick={() => setTeamEditId(null)}
                    className="btn-secondary text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {teams.map((team) => (
              <div key={team.id} className="bg-black/40 border border-white/5 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-black border border-white/10 overflow-hidden">
                    {team.logo_url ? (
                      <img
                        src={DataService.getStorageUrl('teams', team.logo_url)}
                        alt={team.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white uppercase tracking-tight">{team.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ID {team.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditTeam(team)}
                    className="text-[10px] uppercase tracking-wider text-blue-300 border border-blue-500/40 px-3 py-1"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm('Deseja deletar este time?');
                      if (!confirmed) return;
                      const result = await DataService.deleteAdminTeam(team.id);
                      if (!result.ok) {
                        setTeamsError(result.error || 'Erro ao deletar time');
                        return;
                      }
                      setTeams((prev) => prev.filter((item) => item.id !== team.id));
                    }}
                    className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/40 px-3 py-1"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRounds = () => {
    if (roundsLoading || matchesLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando...</span>
          </div>
        </div>
      );
    }

    if (roundsError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {roundsError}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Criar Rodada */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Nova rodada</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Temporada</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={newRoundForm.season}
                  onChange={(event) => setNewRoundForm((prev) => ({ ...prev, season: event.target.value }))}
                  placeholder="Ex: 4"
                  className="mt-2 bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Numero da rodada</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={newRoundForm.round_number}
                  onChange={(event) => setNewRoundForm((prev) => ({ ...prev, round_number: event.target.value }))}
                  placeholder="Ex: 7"
                  className="mt-2 bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Status</label>
                <select
                  value={newRoundForm.status}
                  onChange={(event) => setNewRoundForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="mt-2 bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="active">Ativa</option>
                  <option value="completed">Concluida</option>
                </select>
              </div>
              <div className="flex items-end justify-end md:col-span-3">
                <button
                  onClick={handleCreateRound}
                  className="btn-primary text-xs uppercase tracking-wider"
                >
                  Criar rodada
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Rodadas */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
              {rounds.length} rodadas cadastradas
            </p>
            <button
              onClick={() => loadRounds()}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-black/60 text-gray-500 text-[11px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
                <tr>
                  <th className="px-4 py-3">Rodada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Mercado</th>
                  <th className="px-4 py-3">Partidas</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rounds.map((round) => {
                  const roundMatches = matches.filter((m) => String(m.round_id) === String(round.id));
                  return (
                    <tr
                      key={round.id}
                      onClick={() => {
                        setSelectedRoundIdForActions(String(round.id));
                      }}
                      className={`cursor-pointer hover:bg-white/[0.03] odd:bg-white/[0.02] ${
                        String(round.id) === selectedRoundIdForActions ? 'ring-1 ring-[#6366F1]/50 bg-[#6366F1]/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        S{round.season} R{round.round_number}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded ${
                          round.status === 'active' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' :
                          round.status === 'finished' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' :
                          round.status === 'completed' ? 'border-blue-500/40 text-blue-300 bg-blue-500/10' :
                          'border-gray-500/40 text-gray-400 bg-gray-500/10'
                        }`}>
                          {round.status === 'active' ? 'Ativa' : round.status === 'finished' ? 'Finalizada' : round.status === 'completed' ? 'Concluida' : round.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wider ${round.is_market_open ? 'text-emerald-300' : 'text-red-300'}`}>
                          {round.is_market_open ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{roundMatches.length}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRound(round.id);
                          }}
                          className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/40 px-3 py-1"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Criar Partida */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Nova partida</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Rodada</label>
                <select
                  value={matchForm.round_id}
                  onChange={(event) => handleMatchFormChange('round_id', event.target.value)}
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="">Selecione a rodada</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Season {round.season} - Rodada {round.round_number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Time A</label>
                <select
                  value={matchForm.team_a_id}
                  onChange={(event) => handleMatchFormChange('team_a_id', event.target.value)}
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="">Selecione o time A</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Time B</label>
                <select
                  value={matchForm.team_b_id}
                  onChange={(event) => handleMatchFormChange('team_b_id', event.target.value)}
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="">Selecione o time B</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Numero de partidas</label>
                <input
                  type="number"
                  min={1}
                  value={matchForm.games_count}
                  onChange={(event) => handleMatchFormChange('games_count', event.target.value)}
                  placeholder="Ex: 3"
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                />
              </div>
              <div className="md:col-span-3 flex items-end justify-end">
                <button
                  onClick={handleCreateMatch}
                  className="btn-primary text-xs uppercase tracking-wider"
                >
                  Criar partida
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Partidas */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
              {matches.length} partidas cadastradas
            </p>
            <button
              onClick={() => loadMatches()}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-black/60 text-gray-500 text-[11px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
                <tr>
                  <th className="px-4 py-3">Partida</th>
                  <th className="px-4 py-3">Times</th>
                  <th className="px-4 py-3">Vencedor</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matches.map((match) => (
                  <tr key={match.id} className="hover:bg-white/[0.03] odd:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider">ID {match.id}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">
                      {match.team_a?.name || match.team_a_id} vs {match.team_b?.name || match.team_b_id}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">
                      {match.winner?.name || match.winner_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">
                      {match.scheduled_time || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleMatchDelete(match.id)}
                        className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/40 px-3 py-1"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reset (collapsible) */}
        <details className="glass-card border border-red-500/20">
          <summary className="p-4 cursor-pointer text-[10px] uppercase tracking-[0.3em] text-red-400">
            Reset de dados (uso com cuidado)
          </summary>
          <div className="px-5 pb-5 space-y-3 border-t border-red-500/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider pt-3">
              Deleta todas performances, matches e zera stats/precos dos jogadores
            </p>
            <button
              type="button"
              onClick={handleResetData}
              disabled={resetLoading}
              className="bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {resetLoading ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Resetando...</>
              ) : (
                <><i className="fa-solid fa-trash"></i> Resetar tudo</>
              )}
            </button>
            {resetResult && (
              <div className={`border p-3 text-xs ${resetResult.success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
                {resetResult.message}
              </div>
            )}
          </div>
        </details>
      </div>
    );
  };

  const renderPerformances = () => {
    if (championsLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando performances...</span>
          </div>
        </div>
      );
    }

    if (performancesError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {performancesError}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Lancamento manual por partida */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Performances</p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
              Lancamento simplificado por partida
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Fluxo: rodada - partida - placar - desempenho</p>
          </div>

          <div className="p-5 space-y-4">
            {performancesSuccess && (
              <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                {performancesSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Rodada</label>
                <select
                  value={performanceRoundId}
                  onChange={(event) => handlePerformanceRoundChange(event.target.value)}
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="">Selecione a rodada</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Season {round.season} - Rodada {round.round_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500">Partida</label>
                <select
                  value={performanceMatchId}
                  onChange={(event) => handlePerformanceMatchChange(event.target.value)}
                  className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
                >
                  <option value="">Selecione a partida</option>
                  {matches
                    .filter((match) => !performanceRoundId || String(match.round_id) === String(performanceRoundId))
                    .map((match) => (
                      <option key={match.id} value={match.id}>
                        {match.team_a?.name || match.team_a_id} vs {match.team_b?.name || match.team_b_id}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {performanceMatchId && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                Series previstas neste confronto: {performanceGamesCount}
              </div>
            )}

            <div className="border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Progresso da finalizacao</p>
                <span className={`text-[10px] uppercase tracking-[0.2em] ${canFinalizeFlow ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {performanceFlowSteps.filter((step) => step.done).length}/{performanceFlowSteps.length} etapas
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {performanceFlowSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 text-xs uppercase tracking-[0.16em] px-3 py-2 border ${step.done ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/5' : 'border-white/10 text-gray-400 bg-black/20'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${step.done ? 'border-emerald-400 text-emerald-300' : 'border-gray-600 text-gray-500'}`}>
                      {step.done ? '✓' : index + 1}
                    </span>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selectedPerformanceMatch && (
          <div className="glass-card border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Resultado da partida</p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">{selectedPerformanceMatch.team_a?.name || 'Time A'}</label>
                <input
                  type="number"
                  min={0}
                  value={matchScoreInput.teamA}
                  onChange={(event) => setMatchScoreInput((prev) => ({ ...prev, teamA: event.target.value }))}
                  className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2 rounded-lg w-full"
                  placeholder="0"
                />
              </div>
              <div className="text-sm font-black text-gray-500 uppercase tracking-wider pb-2">x</div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">{selectedPerformanceMatch.team_b?.name || 'Time B'}</label>
                <input
                  type="number"
                  min={0}
                  value={matchScoreInput.teamB}
                  onChange={(event) => setMatchScoreInput((prev) => ({ ...prev, teamB: event.target.value }))}
                  className="bg-black/40 border border-white/10 text-sm text-gray-200 px-3 py-2 rounded-lg w-full"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveMatchScore}
                disabled={saveMatchScoreLoading}
                className="btn-secondary text-xs uppercase tracking-wider"
              >
                {saveMatchScoreLoading ? 'Salvando...' : 'Salvar placar'}
              </button>
            </div>
          </div>
        )}

        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Tabela de performances</p>
            <button
              onClick={handleSubmitPerformances}
              className="btn-primary text-xs uppercase tracking-wider"
              disabled={!performanceMatchId || performanceRowsByGame.length === 0}
            >
              Salvar performances
            </button>
          </div>

          <div className="p-5 space-y-8">
          {performanceRowsByGame.length === 0 ? (
            <div className="border border-white/5 bg-black/30 p-4 text-xs text-gray-500">
              Selecione a partida para carregar os jogadores.
            </div>
          ) : (
            performanceRowsByGame.map((game, gameIndex) => (
              <div key={`game-${game.gameNumber}`} className="space-y-4">
                <div className="flex items-center gap-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
                    Partida {game.gameNumber} de {performanceGamesCount}
                  </p>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[
                    { label: 'Time A', rows: game.teamA, teamKey: 'A' as const },
                    { label: 'Time B', rows: game.teamB, teamKey: 'B' as const }
                  ].map((block) => (
                    <div key={`${block.label}-${game.gameNumber}`} className="border border-white/5 bg-black/30">
                      <div className="px-4 py-3 border-b border-white/10 text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                        {block.label}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                          <thead className="bg-black/60 text-gray-500 text-[10px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
                            <tr>
                              <th className="px-3 py-2">Jogador</th>
                              <th className="px-3 py-2">Campeao</th>
                              <th className="px-3 py-2">K</th>
                              <th className="px-3 py-2">D</th>
                              <th className="px-3 py-2">A</th>
                              <th className="px-3 py-2">CS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {block.rows.map((row, rowIndex) => (
                              <tr key={`${block.label}-${row.player_id}-${game.gameNumber}`} className="odd:bg-white/[0.02]">
                                <td className="px-3 py-2 text-xs text-gray-300 uppercase tracking-wider">
                                  {players.find((player) => String(player.id) === String(row.player_id))?.name || row.player_id}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={row.champion_id}
                                    onChange={(event) => handlePerformanceRowChange(block.teamKey, gameIndex, rowIndex, 'champion_id', event.target.value)}
                                    className="bg-black/40 border border-white/10 text-xs text-gray-200 px-3 py-2 rounded-lg w-40"
                                  >
                                    <option value="">Campeao</option>
                                    {champions.map((champion) => (
                                      <option key={champion.id} value={champion.id}>
                                        {champion.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={row.kills}
                                    onChange={(event) => handlePerformanceRowChange(block.teamKey, gameIndex, rowIndex, 'kills', event.target.value)}
                                    className="bg-black/40 border border-white/10 text-xs text-gray-200 px-2 py-2 rounded-lg w-12"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={row.deaths}
                                    onChange={(event) => handlePerformanceRowChange(block.teamKey, gameIndex, rowIndex, 'deaths', event.target.value)}
                                    className="bg-black/40 border border-white/10 text-xs text-gray-200 px-2 py-2 rounded-lg w-12"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={row.assists}
                                    onChange={(event) => handlePerformanceRowChange(block.teamKey, gameIndex, rowIndex, 'assists', event.target.value)}
                                    className="bg-black/40 border border-white/10 text-xs text-gray-200 px-2 py-2 rounded-lg w-12"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={row.cs}
                                    onChange={(event) => handlePerformanceRowChange(block.teamKey, gameIndex, rowIndex, 'cs', event.target.value)}
                                    className="bg-black/40 border border-white/10 text-xs text-gray-200 px-2 py-2 rounded-lg w-12"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        <details className="glass-card border border-white/5 overflow-hidden">
          <summary className="p-5 cursor-pointer text-[10px] uppercase tracking-[0.3em] text-gray-500">
            Ferramentas adicionais
          </summary>
          <div className="px-5 pb-5 space-y-4 border-t border-white/5">
            <div className="flex flex-col md:flex-row md:items-center gap-3 text-xs text-gray-500 pt-4">
              <button
                type="button"
                onClick={handleRecalculatePlayers}
                className="text-[10px] uppercase tracking-[0.2em] text-gray-200 border border-white/10 px-3 py-2 rounded-lg"
                disabled={recalculatePlayersLoading}
              >
                {recalculatePlayersLoading ? 'Recalculando...' : 'Recalcular pontos dos jogadores'}
              </button>
            </div>
          </div>
        </details>

        <details className="glass-card border border-white/5 overflow-hidden">
          <summary className="p-5 cursor-pointer text-[10px] uppercase tracking-[0.3em] text-gray-500">
            Importacao por print (IA assistida)
          </summary>
          <div className="px-5 pb-5 space-y-4 border-t border-white/5">
            <div className="flex flex-col md:flex-row md:items-center gap-3 text-xs text-gray-500 pt-4">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleImportPerformancesImage(event.target.files?.[0] || null)}
                className="text-[10px] uppercase tracking-[0.2em] text-gray-400"
              />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
                Envie o print da tabela de stats da partida
              </span>
            </div>

            {imageExtractLoading && (
              <div className="border border-white/10 bg-black/30 p-3 text-xs text-gray-400">
                Extraindo dados da imagem...
              </div>
            )}

            {imagePreviewRows && (
              <div className="border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                    Preview print {imagePreviewFileName ? `- ${imagePreviewFileName}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyImagePreview}
                    className="text-[10px] uppercase tracking-[0.2em] text-gray-200 border border-white/10 px-3 py-2 rounded-lg"
                  >
                    Aplicar dados extraidos
                  </button>
                </div>

                {imagePreviewScore && (
                  <div className="text-xs text-gray-400 uppercase tracking-[0.2em]">
                    Placar detectado: {imagePreviewScore.team_a} x {imagePreviewScore.team_b}
                  </div>
                )}

                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full text-[10px] text-left">
                    <thead className="text-gray-500 uppercase tracking-[0.3em]">
                      <tr>
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Jogador</th>
                        <th className="px-2 py-2">Mapeado</th>
                        <th className="px-2 py-2">Campeao</th>
                        <th className="px-2 py-2">KDA</th>
                        <th className="px-2 py-2">CS</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {imagePreviewRows.map((row, rowIndex) => (
                        <tr key={`img-preview-${row.index}`} className="odd:bg-white/[0.02]">
                          <td className="px-2 py-2 text-gray-400">{row.index}</td>
                          <td className="px-2 py-2 text-gray-300">{row.player_name || '-'}</td>
                          <td className="px-2 py-2 text-gray-300 min-w-[180px]">
                            <select
                              value={row.mapped_player_id ? String(row.mapped_player_id) : ''}
                              onChange={(event) => handleImagePreviewRowChange(rowIndex, 'mapped_player_id', event.target.value)}
                              className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-2 py-1 rounded-md w-full"
                            >
                              <option value="">Selecionar jogador</option>
                              {players
                                .filter((player) => {
                                  if (!selectedPerformanceMatch) return false;
                                  return String(player.team_id) === String(selectedPerformanceMatch.team_a_id) || String(player.team_id) === String(selectedPerformanceMatch.team_b_id);
                                })
                                .map((player) => (
                                  <option key={`img-player-${row.index}-${player.id}`} value={player.id}>
                                    {player.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-gray-300 min-w-[160px]">
                            <select
                              value={row.mapped_champion_id ? String(row.mapped_champion_id) : ''}
                              onChange={(event) => handleImagePreviewRowChange(rowIndex, 'mapped_champion_id', event.target.value)}
                              className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-2 py-1 rounded-md w-full"
                            >
                              <option value="">Selecionar campeao</option>
                              {champions.map((champion) => (
                                <option key={`img-champion-${row.index}-${champion.id}`} value={champion.id}>
                                  {champion.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-gray-300">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={row.kills}
                                onChange={(event) => handleImagePreviewRowChange(rowIndex, 'kills', event.target.value)}
                                className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-1 py-1 rounded w-10"
                              />
                              <span>/</span>
                              <input
                                type="number"
                                min={0}
                                value={row.deaths}
                                onChange={(event) => handleImagePreviewRowChange(rowIndex, 'deaths', event.target.value)}
                                className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-1 py-1 rounded w-10"
                              />
                              <span>/</span>
                              <input
                                type="number"
                                min={0}
                                value={row.assists}
                                onChange={(event) => handleImagePreviewRowChange(rowIndex, 'assists', event.target.value)}
                                className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-1 py-1 rounded w-10"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-gray-300">
                            <input
                              type="number"
                              min={0}
                              value={row.cs}
                              onChange={(event) => handleImagePreviewRowChange(rowIndex, 'cs', event.target.value)}
                              className="bg-black/50 border border-white/10 text-[10px] text-gray-200 px-1 py-1 rounded w-14"
                            />
                          </td>
                          <td className={`px-2 py-2 ${row.status === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {row.status === 'ok' ? 'OK' : 'Revisar'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    );
  };

  const renderFinalize = () => {
    const selectedFinalizeRound = rounds.find((r) => String(r.id) === String(finalizeTabRoundId)) || null;

    const handleFinalizeTabCheck = async () => {
      if (!finalizeTabRoundId) return;
      setFinalizeCheckLoading(true);
      setPerformancesError(null);
      try {
        const result = await DataService.getAdminRoundFinalizeCheck(Number(finalizeTabRoundId));
        if (result.ok) {
          setFinalizeCheckResult(result.check);
        } else {
          setPerformancesError(result.error || 'Erro ao verificar checklist');
        }
      } catch (error) {
        setPerformancesError(String(error));
      } finally {
        setFinalizeCheckLoading(false);
      }
    };

    const handleFinalizeTabRound = async () => {
      if (!finalizeTabRoundId) return;
      if (!window.confirm('Finalizar rodada? Isso vai calcular pontos, atualizar precos e patrimonio dos usuarios.')) {
        return;
      }

      setFinalizeRoundLoading(true);
      setPerformancesError(null);
      setPerformancesSuccess(null);

      try {
        const result = await DataService.finalizeAdminRound(Number(finalizeTabRoundId));
        if (result.ok) {
          const wasRecalculated = Boolean(result.data?.result?.recalculated);
          const baseMsg = wasRecalculated
            ? 'Rodada recalculada com sucesso (modo substituicao).'
            : (result.data?.message || 'Rodada finalizada com sucesso.');
          const finalMsg = result.data?.marketWarning ? `${baseMsg} ${result.data.marketWarning}` : baseMsg;
          setPerformancesSuccess(finalMsg);
          setFinalizeCheckResult(null);
          await Promise.all([loadRounds(), loadPlayers()]);
          window.dispatchEvent(new Event('players:refresh'));
          window.dispatchEvent(new Event('leagues:refresh'));
          window.dispatchEvent(new Event('market:refresh'));
        } else {
          setPerformancesError(result.error || 'Erro ao finalizar rodada');
          await handleFinalizeTabCheck();
        }
      } catch (error) {
        setPerformancesError(String(error));
      } finally {
        setFinalizeRoundLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        {performancesError && (
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
            {performancesError}
          </div>
        )}
        {performancesSuccess && (
          <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            {performancesSuccess}
          </div>
        )}

        {/* Selecionar rodada */}
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Selecionar rodada</p>
          </div>
          <div className="p-5">
            <select
              value={finalizeTabRoundId}
              onChange={(event) => {
                setFinalizeTabRoundId(event.target.value);
                setFinalizeCheckResult(null);
                setPerformancesError(null);
                setPerformancesSuccess(null);
              }}
              className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full max-w-md"
            >
              <option value="">Selecione a rodada para finalizar</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Season {round.season} - Rodada {round.round_number} ({round.status === 'active' ? 'Ativa' : round.status === 'finished' ? 'Finalizada' : round.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checklist */}
        {finalizeTabRoundId && (
          <div className="glass-card border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
                Checklist — {selectedFinalizeRound ? `S${selectedFinalizeRound.season} R${selectedFinalizeRound.round_number}` : ''}
              </p>
              <button
                type="button"
                onClick={handleFinalizeTabCheck}
                disabled={finalizeCheckLoading}
                className="text-[10px] uppercase tracking-[0.2em] text-amber-200 border border-amber-500/30 px-3 py-2 rounded-lg disabled:opacity-50"
              >
                {finalizeCheckLoading ? 'Verificando...' : 'Atualizar checklist'}
              </button>
            </div>

            <div className="p-5 space-y-4">
              {finalizeCheckResult ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                    <div>Partidas: <span className="text-white">{finalizeCheckResult.totalMatches}</span></div>
                    <div>Sem resultado: <span className="text-white">{finalizeCheckResult.matchesMissingResults}</span></div>
                    <div>Perf. esperadas: <span className="text-white">{finalizeCheckResult.expectedPerformances}</span></div>
                    <div>Perf. lancadas: <span className="text-white">{finalizeCheckResult.totalPerformances}</span></div>
                  </div>
                  {finalizeCheckResult.pendingItems?.length > 0 ? (
                    <div className="border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                      {finalizeCheckResult.pendingItems.map((item: string) => (
                        <p key={item} className="text-xs text-amber-200">- {item}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-200">
                      Tudo certo. A rodada pode ser finalizada.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500">Clique em "Atualizar checklist" para validar os dados da rodada.</p>
              )}
            </div>
          </div>
        )}

        {/* Cascade Info + Finalizar */}
        {finalizeTabRoundId && (
          <div className="glass-card border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Finalizar</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-4 border border-white/10 bg-black/30 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Ao finalizar, o sistema executa em cascata:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.18em]">
                  <div className="flex items-center gap-2 text-gray-400 p-2 border border-white/5">
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">1</span>
                    Calcular fantasy points das performances
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 p-2 border border-white/5">
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">2</span>
                    Calcular pontos dos user_teams
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 p-2 border border-white/5">
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">3</span>
                    Atualizar precos dos jogadores
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 p-2 border border-white/5">
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">4</span>
                    Recalcular patrimonio dos usuarios
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 p-2 border border-white/5">
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[8px]">5</span>
                    Marcar rodada como finalizada
                  </div>
                </div>
              </div>

              {selectedFinalizeRound?.status === 'finished' && (
                <div className="p-3 border border-blue-500/20 bg-blue-500/5 rounded-lg">
                  <p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Modo recalculo</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Esta rodada ja foi finalizada. Ao clicar, apenas as pontuacoes serao recalculadas. Precos e patrimonios NAO serao alterados.
                  </p>
                </div>
              )}

              <button
                onClick={handleFinalizeTabRound}
                disabled={finalizeRoundLoading || !finalizeTabRoundId}
                className="w-full py-3 text-sm font-bold uppercase tracking-wider bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {finalizeRoundLoading ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Finalizando rodada...</>
                ) : (
                  <><i className="fa-solid fa-flag-checkered"></i> Finalizar rodada e atualizar sistema</>
                )}
              </button>

              {selectedFinalizeRound?.status === 'finished' && (
                <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Esta rodada ja foi finalizada.</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Voce pode re-finalizar para recalcular, ou selecione a proxima rodada.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMarket = () => {
    if (marketError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {marketError}
        </div>
      );
    }

    return (
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Mercado</p>
          <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
            Controle rapido do mercado
          </h3>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">
            Rodada ativa: {activeRoundId ? `#${activeRoundId}` : 'Nao encontrada'}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Rodada</label>
            <select
              value={marketRoundId}
              onChange={(event) => setMarketRoundId(event.target.value)}
              className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
            >
              <option value="">Selecione a rodada</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Season {round.season} - Rodada {round.round_number}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Fechamento do mercado</label>
            <input
              type="datetime-local"
              value={marketCloseTimeInput}
              onChange={(event) => setMarketCloseTimeInput(event.target.value)}
              className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
            />
          </div>
          <button
            onClick={handleSaveMarketCloseTime}
            className="btn-secondary text-xs uppercase tracking-wider"
            disabled={marketActionLoading}
          >
            {marketActionLoading ? 'Processando...' : 'Salvar fechamento'}
          </button>
          <button
            onClick={() => handleMarketAction('open')}
            className="btn-primary text-xs uppercase tracking-wider"
            disabled={marketActionLoading}
          >
            {marketActionLoading ? 'Processando...' : 'Abrir mercado'}
          </button>
          <button
            onClick={() => handleMarketAction('close')}
            className="text-xs uppercase tracking-wider text-red-300 border border-red-500/40 px-3 py-2"
            disabled={marketActionLoading}
          >
            {marketActionLoading ? 'Processando...' : 'Fechar mercado'}
          </button>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (usersLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando usuários...</span>
          </div>
        </div>
      );
    }

    if (usersError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {usersError}
        </div>
      );
    }

    const filteredUsers = users.filter((user) => {
      const query = userSearch.toLowerCase();
      return (
        user.user_name?.toLowerCase().includes(query) ||
        user.team_name?.toLowerCase().includes(query) ||
        user.user_id?.toLowerCase().includes(query)
      );
    });

    const handleUserReset = async (userId: number) => {
      setActionLoading((prev) => ({ ...prev, [`user-reset-${userId}`]: true }));
      setUsersError(null);
      const result = await DataService.resetAdminUser(userId);
      if (!result.ok) {
        setUsersError(result.error || 'Erro ao resetar usuario');
      } else {
        await loadUsers();
      }
      setActionLoading((prev) => ({ ...prev, [`user-reset-${userId}`]: false }));
    };

    return (
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Usuarios</p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
              {filteredUsers.length} usuarios encontrados
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: user_teams</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Buscar usuario"
              className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
            />
            <button
              onClick={loadUsers}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-black/60 text-gray-500 text-[11px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Pontos</th>
                <th className="px-4 py-3">Orcamento</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03] odd:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white uppercase tracking-tight">{user.user_name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.user_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{user.team_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{user.total_points}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{user.budget}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleUserReset(user.id)}
                      className="text-[10px] uppercase tracking-wider text-yellow-300 border border-yellow-500/40 px-3 py-1"
                      disabled={actionLoading[`user-reset-${user.id}`]}
                    >
                      {actionLoading[`user-reset-${user.id}`] ? 'Resetando...' : 'Resetar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLeagues = () => {
    if (leaguesLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando ligas...</span>
          </div>
        </div>
      );
    }

    if (leaguesError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {leaguesError}
        </div>
      );
    }

    const handleLeagueToggle = async (leagueId: number, field: 'is_public' | 'is_verified', nextValue: boolean) => {
      setActionLoading((prev) => ({ ...prev, [`league-${field}-${leagueId}`]: true }));
      setLeaguesError(null);
      const result = await DataService.updateAdminLeague(leagueId, { [field]: nextValue });
      if (!result.ok) {
        setLeaguesError(result.error || 'Erro ao atualizar liga');
      } else {
        await loadLeagues();
      }
      setActionLoading((prev) => ({ ...prev, [`league-${field}-${leagueId}`]: false }));
    };

    return (
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Ligas</p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
              {leagues.length} ligas cadastradas
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: leagues</p>
          </div>
          <button
            onClick={loadLeagues}
            className="btn-secondary text-xs uppercase tracking-wider"
          >
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-black/60 text-gray-500 text-[11px] uppercase tracking-[0.3em] sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="px-4 py-3">Liga</th>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Publica</th>
                <th className="px-4 py-3">Verificada</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leagues.map((league) => (
                <tr key={league.id} className="hover:bg-white/[0.03] odd:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">{league.name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{league.code}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{league.is_public ? 'Sim' : 'Nao'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">{league.is_verified ? 'Sim' : 'Nao'}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button
                      onClick={() => handleLeagueToggle(league.id, 'is_public', !league.is_public)}
                      className="text-[10px] uppercase tracking-wider text-blue-300 border border-blue-500/40 px-3 py-1"
                      disabled={actionLoading[`league-is_public-${league.id}`]}
                    >
                      {actionLoading[`league-is_public-${league.id}`]
                        ? 'Atualizando...'
                        : league.is_public
                          ? 'Privar'
                          : 'Publicar'}
                    </button>
                    <button
                      onClick={() => handleLeagueToggle(league.id, 'is_verified', !league.is_verified)}
                      className="text-[10px] uppercase tracking-wider text-emerald-300 border border-emerald-500/40 px-3 py-1"
                      disabled={actionLoading[`league-is_verified-${league.id}`]}
                    >
                      {actionLoading[`league-is_verified-${league.id}`]
                        ? 'Atualizando...'
                        : league.is_verified
                          ? 'Desverificar'
                          : 'Verificar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-10 border border-white/5">
        <div className="max-w-2xl">
          <p className="text-xs font-black text-[#EF4444] uppercase tracking-[0.4em]">Acesso Negado</p>
          <h1 className="mt-4 text-3xl font-orbitron font-black text-white uppercase tracking-tight">
            Somente administradores
          </h1>
          <p className="mt-4 text-sm text-gray-400">
            Seu e-mail nao esta autorizado como admin. Atualize a variavel `ADMIN_EMAILS` no
            backend e faca login novamente.
          </p>
          <button
            onClick={handleRefresh}
            className="btn-secondary text-xs uppercase tracking-wider mt-6"
          >
            {isChecking ? 'Verificando...' : 'Revalidar Acesso'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="glass-card p-8 border border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#6366F1_0%,transparent_55%)] opacity-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs font-black text-[#6366F1] uppercase tracking-[0.4em]">Admin Ops</p>
            <h1 className="mt-3 text-3xl md:text-4xl font-orbitron font-black text-white uppercase tracking-tight">
              Painel de Controle
            </h1>
            <p className="mt-3 text-sm text-gray-400 max-w-2xl">
              Centralize a operação do torneio. Gerencie dados críticos sem depender do fluxo Riot API.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${
              isAdmin
                ? 'border-[#10B981]/50 text-[#10B981] bg-[#10B981]/10'
                : 'border-[#EF4444]/50 text-[#EF4444] bg-[#EF4444]/10'
            }`}>
              {isAdmin ? 'Acesso Admin Confirmado' : 'Sem Permissão Admin'}
            </div>
            <button
              onClick={handleRefresh}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              {isChecking ? 'Verificando...' : 'Revalidar Acesso'}
            </button>
          </div>
        </div>
      </section>

      <section ref={detailsRef} className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <div className="glass-card border border-white/5 p-4 h-fit lg:sticky lg:top-32">
          <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.3em] px-2">Modulos</p>
          <div className="mt-4 flex flex-col gap-2">
            {groupedSections.flat().map((section) => {
              const isEnabled =
                section.id === 'players' ||
                section.id === 'teams' ||
                section.id === 'rounds' ||
                section.id === 'performances' ||
                section.id === 'finalize' ||
                section.id === 'market' ||
                section.id === 'users' ||
                section.id === 'leagues';
              return (
                <button
                  key={section.id}
                  onClick={() => handleOpenSection(section.id)}
                  disabled={!isEnabled}
                  className={`w-full text-left px-3 py-2 border text-xs uppercase tracking-wider transition-all ${
                    activeSection === section.id
                      ? 'border-[#6366F1]/60 text-[#6366F1] bg-[#6366F1]/10'
                      : 'border-white/10 text-gray-500'
                  } ${isEnabled ? '' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{section.title}</span>
                    <span className="text-[9px]">{isEnabled ? 'Ativo' : 'Em breve'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card border border-white/5 p-6">
            <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.3em]">Sessao ativa</p>
            <h2 className="mt-2 text-2xl font-orbitron font-black text-white uppercase tracking-tight">
              {sectionMeta[activeSection]?.title || 'Modulo'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {sectionMeta[activeSection]?.description}
            </p>
          </div>

          {activeSection === 'players' && renderPlayers()}
          {activeSection === 'teams' && renderTeams()}
          {activeSection === 'rounds' && renderRounds()}
          {activeSection === 'performances' && renderPerformances()}
          {activeSection === 'finalize' && renderFinalize()}
          {activeSection === 'market' && renderMarket()}
          {activeSection === 'users' && renderUsers()}
          {activeSection === 'leagues' && renderLeagues()}
        </div>
      </section>

      <section className="glass-card p-8 border border-white/5">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.4em]">Status</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/40 border border-white/5 p-5">
            <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Jogadores</p>
            <p className="mt-3 text-sm text-gray-400">Lista carregada e pronta para ajustes de preco.</p>
          </div>
          <div className="bg-black/40 border border-white/5 p-5">
            <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Times</p>
            <p className="mt-3 text-sm text-gray-400">Visualizacao rapida de clubes cadastrados.</p>
          </div>
          <div className="bg-black/40 border border-white/5 p-5">
            <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Proximo</p>
            <p className="mt-3 text-sm text-gray-400">Adicionar edicao de logos e dados do time.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
