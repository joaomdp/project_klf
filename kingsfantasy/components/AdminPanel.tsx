import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DataService } from '../services/api';

interface AdminPanelProps {
  isAdmin: boolean;
  onAdminCheck: () => Promise<void>;
}

const sections = [
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
    id: 'rounds',
    title: 'Rodadas',
    description: 'Configure datas, status e janelas do mercado.'
  },
  {
    id: 'matches',
    title: 'Partidas',
    description: 'Crie, edite e valide partidas do torneio.'
  },
  {
    id: 'performances',
    title: 'Performances',
    description: 'Insira resultados e notas analistas.'
  },
  {
    id: 'market',
    title: 'Mercado',
    description: 'Controle abertura, fechamento e regras do mercado.'
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
  const [activeSection, setActiveSection] = useState<'players' | 'teams' | 'rounds' | 'matches' | 'performances' | 'market' | 'users' | 'leagues'>('players');
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [champions, setChampions] = useState<any[]>([]);
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
  const [marketError, setMarketError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [finalizeRoundLoading, setFinalizeRoundLoading] = useState(false);
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
    status: 'upcoming',
    start_date: '',
    end_date: '',
    market_close_time: '',
    is_market_open: true
  });
  const [matchForm, setMatchForm] = useState({
    round_id: '',
    team_a_id: '',
    team_b_id: '',
    winner_id: '',
    team_a_score: '',
    team_b_score: '',
    games_count: '1'
  });
  const [performanceRoundId, setPerformanceRoundId] = useState('');
  const [performanceMatchId, setPerformanceMatchId] = useState('');
  const [performanceGamesCount, setPerformanceGamesCount] = useState(1);
  const [performanceRowsByGame, setPerformanceRowsByGame] = useState<Array<{
    gameNumber: number;
    teamA: any[];
    teamB: any[];
  }>>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{
    index: number;
    gameNumber: number | null;
    playerName: string;
    playerId: string;
    championName: string;
    status: 'ok' | 'error';
    message: string;
  }> | null>(null);
  const [csvPreviewUpdates, setCsvPreviewUpdates] = useState<Array<{
    gameNumber: number;
    playerId: string;
    championId: string;
    kills?: string;
    deaths?: string;
    assists?: string;
    cs?: string;
  }> | null>(null);
  const [csvPreviewFileName, setCsvPreviewFileName] = useState<string | null>(null);
  const [recalculatePlayersLoading, setRecalculatePlayersLoading] = useState(false);
  const [marketRoundId, setMarketRoundId] = useState('');
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
      sections.slice(0, 3),
      sections.slice(3, 6),
      sections.slice(6)
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
      sectionId !== 'matches' &&
      sectionId !== 'performances' &&
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

  const loadPlayers = async () => {
    setPlayersLoading(true);
    setPlayersError(null);
    const result = await DataService.getAdminPlayers();
    if (result.ok) {
      setPlayers(result.players || []);
    } else {
      setPlayersError(result.error || 'Erro ao buscar jogadores');
    }
    setPlayersLoading(false);
  };

  const loadTeams = async () => {
    setTeamsLoading(true);
    setTeamsError(null);
    const result = await DataService.getAdminTeams();
    if (result.ok) {
      setTeams(result.teams || []);
    } else {
      setTeamsError(result.error || 'Erro ao buscar times');
    }
    setTeamsLoading(false);
  };

  const loadRounds = async () => {
    setRoundsLoading(true);
    setRoundsError(null);
    const result = await DataService.getAdminRounds();
    if (result.ok) {
      setRounds(result.rounds || []);
    } else {
      setRoundsError(result.error || 'Erro ao buscar rodadas');
    }
    setRoundsLoading(false);
  };

  const loadMatches = async (roundId?: number) => {
    setMatchesLoading(true);
    setMatchesError(null);
    const result = await DataService.getAdminMatches(roundId);
    if (result.ok) {
      setMatches(result.matches || []);
    } else {
      setMatchesError(result.error || 'Erro ao buscar partidas');
    }
    setMatchesLoading(false);
  };

  const loadChampions = async () => {
    setChampionsLoading(true);
    const result = await DataService.getChampions();
    if (result) {
      setChampions(result);
    }
    setChampionsLoading(false);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    const result = await DataService.getAdminUsers();
    if (result.ok) {
      setUsers(result.users || []);
    } else {
      setUsersError(result.error || 'Erro ao buscar usuários');
    }
    setUsersLoading(false);
  };

  const loadLeagues = async () => {
    setLeaguesLoading(true);
    setLeaguesError(null);
    const result = await DataService.getAdminLeagues();
    if (result.ok) {
      setLeagues(result.leagues || []);
    } else {
      setLeaguesError(result.error || 'Erro ao buscar ligas');
    }
    setLeaguesLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadPlayers();
    loadTeams();
    loadRounds();
    loadMatches();
    loadChampions();
    loadUsers();
    loadLeagues();
  }, [isAdmin]);

  useEffect(() => {
    if (!rounds.length) return;
    const activeRound = rounds.find((round) => round.status === 'active' || round.is_market_open);
    if (activeRound?.id) {
      setActiveRoundId(String(activeRound.id));
      if (!marketRoundId) {
        setMarketRoundId(String(activeRound.id));
      }
      return;
    }
    const upcomingRound = rounds.find((round) => round.status === 'upcoming');
    if (upcomingRound?.id) {
      setActiveRoundId(String(upcomingRound.id));
      if (!marketRoundId) {
        setMarketRoundId(String(upcomingRound.id));
      }
    }
  }, [rounds, marketRoundId]);

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
    const seasonValue = Number(newRoundForm.season);
    const roundValue = Number(newRoundForm.round_number);

    if (!seasonValue || !roundValue) {
      setRoundsError('Informe temporada e numero da rodada.');
      return;
    }

    setRoundsError(null);
    const resolvedStartDate = newRoundForm.market_close_time
      ? newRoundForm.market_close_time
      : new Date().toISOString();
    const result = await DataService.createAdminRound({
      season: seasonValue,
      round_number: roundValue,
      status: newRoundForm.status || 'upcoming',
      start_date: resolvedStartDate,
      market_close_time: newRoundForm.market_close_time || null,
      is_market_open: newRoundForm.is_market_open
    });

    if (!result.ok) {
      setRoundsError(result.error || 'Erro ao criar rodada');
      return;
    }

    setNewRoundForm({
      season: '',
      round_number: '',
      status: 'upcoming',
      market_close_time: '',
      is_market_open: true
    });
    await loadRounds();
  };

  const handleFinalizeRound = async () => {
    if (!performanceRoundId) {
      setPerformancesError('Selecione uma rodada antes de finalizar.');
      return;
    }

    const confirmed = window.confirm('Deseja finalizar esta rodada? Esta acao recalcula pontuacoes e valores.');
    if (!confirmed) return;

    setPerformancesError(null);
    setFinalizeRoundLoading(true);

    try {
      const roundId = Number(performanceRoundId);
      const result = await DataService.finalizeAdminRound(roundId);
      if (!result.ok) {
        setPerformancesError(result.error || 'Erro ao finalizar rodada');
        return;
      }

      await loadRounds();
      await loadPlayers();
      window.dispatchEvent(new Event('players:refresh'));
      window.dispatchEvent(new Event('leagues:refresh'));
    } finally {
      setFinalizeRoundLoading(false);
    }
  };

  const handleMatchFormChange = (field: string, value: string) => {
    setMatchForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateMatch = async () => {
    const teamAScore = matchForm.team_a_score === '' ? null : Number(matchForm.team_a_score);
    const teamBScore = matchForm.team_b_score === '' ? null : Number(matchForm.team_b_score);
    const gamesCount = matchForm.games_count === '' ? null : Number(matchForm.games_count);

    const missingFields: string[] = [];
    if (!matchForm.round_id) missingFields.push('Rodada');
    if (!matchForm.team_a_id) missingFields.push('Time A');
    if (!matchForm.team_b_id) missingFields.push('Time B');
    if (teamAScore === null) missingFields.push('Placar Time A');
    if (teamBScore === null) missingFields.push('Placar Time B');
    if (gamesCount === null) missingFields.push('Numero de partidas');

    if (missingFields.length > 0) {
      setMatchesError(`Preencha todos os campos para criar a partida: ${missingFields.join(', ')}.`);
      return;
    }

    const roundId = matchForm.round_id;
    const teamAId = matchForm.team_a_id;
    const teamBId = matchForm.team_b_id;
    const winnerId = matchForm.winner_id || null;

    if (teamAId === teamBId) {
      setMatchesError('Time A e Time B precisam ser diferentes.');
      return;
    }

    if ((teamAScore !== null && Number.isNaN(teamAScore)) || (teamBScore !== null && Number.isNaN(teamBScore))) {
      setMatchesError('Placar invalido.');
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
      winner_id: winnerId,
      status: winnerId ? 'completed' : 'scheduled',
      scheduled_time: new Date().toISOString(),
      team_a_score: teamAScore,
      team_b_score: teamBScore,
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
        winner_id: '',
        team_a_score: '',
        team_b_score: '',
        games_count: '1'
      });
    await loadMatches(roundId);
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

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return { headers: [], rows: [] as Record<string, string>[] };
    }

    const rawHeaders = parseCsvLine(lines[0]);
    const headerMap = new Map<string, string>();
    const knownHeaders: Record<string, string> = {
      gamenumber: 'game_number',
      game: 'game_number',
      partida: 'game_number',
      jogo: 'game_number',
      playerid: 'player_id',
      player: 'player_name',
      playername: 'player_name',
      nomejogador: 'player_name',
      championid: 'champion_id',
      championname: 'champion_name',
      campeao: 'champion_name',
      campeaoname: 'champion_name',
      championkey: 'champion_key',
      kills: 'kills',
      deaths: 'deaths',
      assists: 'assists',
      cs: 'cs'
    };

    rawHeaders.forEach((header) => {
      const normalized = normalizeCsvKey(header);
      const canonical = knownHeaders[normalized] || header.toLowerCase();
      headerMap.set(header, canonical);
    });

    const headers = rawHeaders.map((header) => headerMap.get(header) || header.toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });

    return { headers, rows };
  };

  const escapeCsvValue = (value: string) => {
    if (value === '') return '';
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handlePerformanceRoundChange = (roundId: string) => {
    setPerformanceRoundId(roundId);
    setPerformanceMatchId('');
    setPerformanceGamesCount(1);
    setPerformanceRowsByGame([]);
  };

  const handlePerformanceMatchChange = (matchId: string) => {
    setPerformanceMatchId(matchId);
    const match = matches.find((item) => String(item.id) === String(matchId));
    if (!match) {
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

  const normalizeCsvKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const handleImportPerformancesCsv = async (file: File | null) => {
    if (!file) return;
    if (!performanceMatchId) {
      setPerformancesError('Selecione uma partida antes de importar o CSV.');
      return;
    }
    if (performanceRowsByGame.length === 0) {
      setPerformancesError('Selecione a partida para carregar os jogadores antes de importar o CSV.');
      return;
    }

    const text = await file.text();
    const { rows } = parseCsv(text);
    if (rows.length === 0) {
      setPerformancesError('CSV vazio ou inválido.');
      return;
    }

    setCsvPreviewFileName(file.name);

    const championById = new Map(champions.map((champion) => [String(champion.id), champion]));
    const championByName = new Map(champions.map((champion) => [normalizeCsvKey(champion.name), champion]));
    const championByKeyName = new Map(
      champions.map((champion) => [normalizeCsvKey(champion.key_name || ''), champion])
    );
    const playerById = new Map(players.map((player) => [String(player.id), player]));
    const playerByName = new Map(players.map((player) => [normalizeCsvKey(player.name), player]));
    const matchPlayerIds = new Set(
      performanceRowsByGame.flatMap((game) => [...game.teamA, ...game.teamB]).map((row: any) => String(row.player_id))
    );
    const previewRows: Array<{
      index: number;
      gameNumber: number | null;
      playerName: string;
      playerId: string;
      championName: string;
      status: 'ok' | 'error';
      message: string;
    }> = [];
    const updates: Array<{
      gameNumber: number;
      playerId: string;
      championId: string;
      kills?: string;
      deaths?: string;
      assists?: string;
      cs?: string;
    }> = [];

    rows.forEach((row, index) => {
      const rawGame = row.game_number || row.game || row.partida || row.jogo || '';
      const gameNumber = Number(rawGame);
      let status: 'ok' | 'error' = 'ok';
      let message = 'Pronto para importar';

      if (!gameNumber || Number.isNaN(gameNumber)) {
        status = 'error';
        message = 'game_number inválido';
      }

      let player = null;
      if (row.player_id) {
        player = playerById.get(String(row.player_id).trim());
      }
      if (!player && row.player_name) {
        player = playerByName.get(normalizeCsvKey(row.player_name));
      }
      if (!player) {
        status = 'error';
        message = 'Jogador não encontrado na partida';
      }

      if (status === 'ok' && player && !matchPlayerIds.has(String(player.id))) {
        status = 'error';
        message = 'Jogador não pertence à partida selecionada';
      }

      let championId = '';
      if (row.champion_id) {
        const champion = championById.get(String(row.champion_id).trim());
        if (!champion) {
          status = 'error';
          message = 'Campeão não encontrado (id)';
        } else {
          championId = String(champion.id);
        }
      }
      if (!championId && row.champion_key) {
        const champion = championByKeyName.get(normalizeCsvKey(row.champion_key));
        if (!champion) {
          status = 'error';
          message = 'Campeão não encontrado (key)';
        } else {
          championId = String(champion.id);
        }
      }
      if (!championId && row.champion_name) {
        const normalizedName = normalizeCsvKey(row.champion_name);
        const champion = championByName.get(normalizedName) || championByKeyName.get(normalizedName);
        if (!champion) {
          status = 'error';
          message = 'Campeão não encontrado (nome)';
        } else {
          championId = String(champion.id);
        }
      }

      if (status === 'ok' && player && gameNumber) {
        updates.push({
          gameNumber,
          playerId: String(player.id),
          championId,
          kills: row.kills !== undefined && row.kills !== '' ? String(row.kills) : undefined,
          deaths: row.deaths !== undefined && row.deaths !== '' ? String(row.deaths) : undefined,
          assists: row.assists !== undefined && row.assists !== '' ? String(row.assists) : undefined,
          cs: row.cs !== undefined && row.cs !== '' ? String(row.cs) : undefined
        });
      }

      previewRows.push({
        index: index + 1,
        gameNumber: Number.isNaN(gameNumber) ? null : gameNumber,
        playerName: player?.name || String(row.player_name || ''),
        playerId: player ? String(player.id) : String(row.player_id || ''),
        championName: String(row.champion_name || row.champion_key || row.champion_id || ''),
        status,
        message
      });
    });

    setPerformancesError(null);
    setCsvPreviewRows(previewRows);
    setCsvPreviewUpdates(updates);
  };

  const handleApplyCsvPreview = () => {
    if (!csvPreviewRows || !csvPreviewUpdates) return;
    const hasErrors = csvPreviewRows.some((row) => row.status === 'error');
    if (hasErrors) {
      setPerformancesError('Corrija as linhas com erro antes de aplicar.');
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

    for (const update of csvPreviewUpdates) {
      const target = findRow(update.gameNumber, update.playerId);
      if (!target) continue;
      if (update.championId) target.champion_id = update.championId;
      if (update.kills !== undefined) target.kills = update.kills;
      if (update.deaths !== undefined) target.deaths = update.deaths;
      if (update.assists !== undefined) target.assists = update.assists;
      if (update.cs !== undefined) target.cs = update.cs;
    }

    setPerformanceRowsByGame(updatedRows);
    setCsvPreviewRows(null);
    setCsvPreviewUpdates(null);
    setCsvPreviewFileName(null);
    setPerformancesError(null);
  };

  const handleDownloadPerformanceTemplate = () => {
    if (!performanceMatchId) {
      setPerformancesError('Selecione uma partida antes de baixar o CSV.');
      return;
    }
    if (performanceRowsByGame.length === 0) {
      setPerformancesError('Selecione a partida para carregar os jogadores antes de baixar o CSV.');
      return;
    }

    const headers = ['game_number', 'player_id', 'player_name', 'champion_name', 'kills', 'deaths', 'assists', 'cs'];
    const rows: string[] = [headers.join(',')];

    const getPlayerName = (playerId: string) =>
      players.find((player) => String(player.id) === String(playerId))?.name || '';

    performanceRowsByGame.forEach((game) => {
      const allRows = [...game.teamA, ...game.teamB];
      allRows.forEach((row: any) => {
        const values = [
          String(game.gameNumber),
          String(row.player_id || ''),
          getPlayerName(String(row.player_id || '')),
          '',
          '',
          '',
          '',
          ''
        ].map((value) => escapeCsvValue(value));
        rows.push(values.join(','));
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performances_match_${performanceMatchId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  const handlePerformanceRowChange = (
    team: 'A' | 'B',
    gameIndex: number,
    rowIndex: number,
    field: string,
    value: string
  ) => {
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


  const handleSubmitPerformances = async () => {
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

      window.dispatchEvent(new Event('players:refresh'));
      window.dispatchEvent(new Event('leagues:refresh'));
      setPerformanceRowsByGame([]);
      setPerformanceMatchId('');
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
      }
    } catch (error) {
      setMarketError(String(error));
    } finally {
      setMarketActionLoading(false);
    }
  };

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
    if (roundsLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando rodadas...</span>
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
      <div className="glass-card border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Rodadas</p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
              Criar nova rodada
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Formulario: rounds</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Temporada</label>
              <input
                value={newRoundForm.season}
                onChange={(event) => setNewRoundForm((prev) => ({ ...prev, season: event.target.value }))}
                placeholder="Ex: 4"
                className="mt-2 bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Numero da rodada</label>
              <input
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
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Fechamento do mercado</label>
              <input
                type="datetime-local"
                value={newRoundForm.market_close_time}
                onChange={(event) => setNewRoundForm((prev) => ({ ...prev, market_close_time: event.target.value }))}
                className="mt-2 bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg w-full"
              />
            </div>
            <div className="flex items-end justify-between gap-4 md:col-span-3">
              <label className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-[0.3em]">
                <input
                  type="checkbox"
                  checked={newRoundForm.is_market_open}
                  onChange={(event) => setNewRoundForm((prev) => ({ ...prev, is_market_open: event.target.checked }))}
                />
                Mercado aberto
              </label>
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
    );
  };

  const renderMatches = () => {
    if (matchesLoading) {
      return (
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-3 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span className="text-sm font-bold uppercase tracking-wider">Carregando partidas...</span>
          </div>
        </div>
      );
    }

    if (matchesError) {
      return (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {matchesError}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Partidas</p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
              Criar nova partida
            </h3>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Formulario: matches</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Rodada</label>
              <select
                value={matchForm.round_id}
                onChange={(event) => handleMatchFormChange('round_id', event.target.value)}
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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
              <label className="text-xs text-gray-500">Vencedor (opcional)</label>
              <select
                value={matchForm.winner_id}
                onChange={(event) => handleMatchFormChange('winner_id', event.target.value)}
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
              >
                <option value="">Sem vencedor</option>
                {teams
                  .filter((team) => team.id === matchForm.team_a_id || team.id === matchForm.team_b_id)
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Placar Time A</label>
              <input
                value={matchForm.team_a_score}
                onChange={(event) => handleMatchFormChange('team_a_score', event.target.value)}
                placeholder="Ex: 2"
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Placar Time B</label>
              <input
                value={matchForm.team_b_score}
                onChange={(event) => handleMatchFormChange('team_b_score', event.target.value)}
                placeholder="Ex: 1"
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Numero de partidas</label>
              <input
                value={matchForm.games_count}
                onChange={(event) => handleMatchFormChange('games_count', event.target.value)}
                placeholder="Ex: 3"
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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

        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Partidas</p>
              <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
                {matches.length} partidas cadastradas
              </h3>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: matches</p>
            </div>
            <button
              onClick={() => loadMatches()}
              className="btn-secondary text-xs uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
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
                      {match.winner?.name || match.winner_id}
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
        <div className="glass-card border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Performances</p>
              <h3 className="mt-2 text-xl font-orbitron font-black text-white uppercase tracking-tight">
                Inserir estatisticas por time
              </h3>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-600">Tabela: performances</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3 text-xs text-gray-500">
                <label className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                  Importar CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => handleImportPerformancesCsv(event.target.files?.[0] || null)}
                  className="text-[10px] uppercase tracking-[0.2em] text-gray-400"
                />
                <button
                  type="button"
                  onClick={handleDownloadPerformanceTemplate}
                  className="text-[10px] uppercase tracking-[0.2em] text-gray-300 border border-white/10 px-3 py-2 rounded-lg"
                >
                  Baixar modelo
                </button>
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
                  Colunas: game_number, player_id ou player_name, champion_id ou champion_name, kills, deaths, assists, cs
                </span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <button
                  type="button"
                  onClick={handleRecalculatePlayers}
                  className="text-[10px] uppercase tracking-[0.2em] text-gray-200 border border-white/10 px-3 py-2 rounded-lg"
                  disabled={recalculatePlayersLoading}
                >
                  {recalculatePlayersLoading ? 'Recalculando...' : 'Recalcular pontos dos jogadores'}
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeRound}
                  className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 border border-emerald-500/30 px-3 py-2 rounded-lg"
                  disabled={finalizeRoundLoading}
                >
                  {finalizeRoundLoading ? 'Finalizando...' : 'Finalizar rodada'}
                </button>
              </div>
            </div>
            {csvPreviewRows && (
              <div className="border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                    Preview CSV {csvPreviewFileName ? `- ${csvPreviewFileName}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCsvPreview}
                    className="text-[10px] uppercase tracking-[0.2em] text-gray-200 border border-white/10 px-3 py-2 rounded-lg"
                  >
                    Aplicar CSV
                  </button>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full text-[10px] text-left">
                    <thead className="text-gray-500 uppercase tracking-[0.3em]">
                      <tr>
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Jogo</th>
                        <th className="px-2 py-2">Jogador</th>
                        <th className="px-2 py-2">Campeao</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {csvPreviewRows.map((row) => (
                        <tr key={`csv-preview-${row.index}`} className="odd:bg-white/[0.02]">
                          <td className="px-2 py-2 text-gray-400">{row.index}</td>
                          <td className="px-2 py-2 text-gray-300">{row.gameNumber ?? '-'}</td>
                          <td className="px-2 py-2 text-gray-300">{row.playerName || row.playerId || '-'}</td>
                          <td className="px-2 py-2 text-gray-300">{row.championName || '-'}</td>
                          <td className={`px-2 py-2 ${row.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                            {row.status === 'error' ? 'Erro' : 'OK'}
                          </td>
                          <td className="px-2 py-2 text-gray-400">{row.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {performanceMatchId && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                Partidas no confronto: {performanceGamesCount}
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Rodada</label>
              <select
                value={performanceRoundId}
                onChange={(event) => handlePerformanceRoundChange(event.target.value)}
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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
                className="bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-gray-200 px-3 py-2 rounded-lg"
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
            <div className="flex items-end">
              <button
                onClick={handleSubmitPerformances}
                className="btn-primary text-xs uppercase tracking-wider w-full"
              >
                Salvar performances
              </button>
            </div>
          </div>
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
        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-center">
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
                section.id === 'matches' ||
                section.id === 'performances' ||
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
          {activeSection === 'matches' && renderMatches()}
          {activeSection === 'performances' && renderPerformances()}
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
