# 🎮 PLANO COMPLETO - API FANTASY KINGS LENDAS

## 📋 VISÃO GERAL

Desenvolvimento de uma API completa para o Fantasy Kings Lendas, seguindo o modelo oficial da Riot Games Brasil, com sistema de mercado fechado, atualização automática de pontuações e buffs estratégicos.

---

## 🎯 OBJETIVOS PRINCIPAIS

1. ✅ Sistema de mercado com fechamento automático 1h antes das rodadas
2. ✅ Scraping de dados da Leaguepedia (IDL Kings Lendas Season 4)
3. ✅ Cálculo automático de pontuações após cada rodada
4. ✅ Sistema de buffs de diversidade e campeões não selecionados
5. ✅ Reabertura automática do mercado nas terças-feiras
6. ✅ Atualização de rankings de ligas e perfis

---

## 🏗️ ARQUITETURA DA API

### **Stack Tecnológica Proposta**

```
Backend:
├── Node.js + TypeScript (runtime)
├── Express.js ou Fastify (framework)
├── Supabase (banco de dados + storage)
├── Redis (cache + job queue)
├── Bull ou Agenda (agendamento de tarefas)
└── Cheerio ou Puppeteer (scraping)

Deploy:
├── Vercel Functions ou Railway (API)
├── Vercel Cron Jobs (tarefas agendadas)
└── Upstash Redis (cache na nuvem)
```

---

## 📊 ESTRUTURA DO BANCO DE DADOS

### **Novas Tabelas Necessárias**

```sql
-- 1. RODADAS
CREATE TABLE rounds (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL DEFAULT 4,
  round_number INT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  market_close_time TIMESTAMP NOT NULL, -- 1h antes do start_date
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, live, completed
  is_market_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(season, round_number)
);

-- 2. PARTIDAS
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  round_id INT REFERENCES rounds(id),
  team_a_id INT REFERENCES teams(id),
  team_b_id INT REFERENCES teams(id),
  scheduled_time TIMESTAMP NOT NULL,
  winner_id INT REFERENCES teams(id),
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, completed
  vod_url TEXT,
  leaguepedia_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. PERFORMANCES (ESTATÍSTICAS DE CADA JOGADOR POR PARTIDA)
CREATE TABLE player_performances (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id),
  player_id INT REFERENCES players(id),
  champion VARCHAR(50),
  kills INT DEFAULT 0,
  deaths INT DEFAULT 0,
  assists INT DEFAULT 0,
  cs INT DEFAULT 0, -- creep score
  gold_earned INT DEFAULT 0,
  damage_dealt INT DEFAULT 0,
  wards_placed INT DEFAULT 0,
  first_blood BOOLEAN DEFAULT false,
  penta_kill BOOLEAN DEFAULT false,
  quadra_kill BOOLEAN DEFAULT false,
  triple_kill BOOLEAN DEFAULT false,
  double_kill INT DEFAULT 0,
  game_duration_minutes INT,
  is_winner BOOLEAN DEFAULT false,
  fantasy_points DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- 4. HISTÓRICO DE CAMPEÕES SELECIONADOS (para buff de campeão inédito)
CREATE TABLE champion_selections (
  id SERIAL PRIMARY KEY,
  user_team_id INT REFERENCES user_teams(id),
  player_id INT REFERENCES players(id),
  champion VARCHAR(50) NOT NULL,
  round_id INT REFERENCES rounds(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_team_id, player_id, round_id)
);

-- 5. HISTÓRICO DE PONTUAÇÕES POR RODADA
CREATE TABLE round_scores (
  id SERIAL PRIMARY KEY,
  user_team_id INT REFERENCES user_teams(id),
  round_id INT REFERENCES rounds(id),
  base_points DECIMAL(10, 2) DEFAULT 0,
  diversity_bonus DECIMAL(10, 2) DEFAULT 0, -- buff de diversidade
  new_champion_bonus DECIMAL(10, 2) DEFAULT 0, -- buff de campeão inédito
  total_points DECIMAL(10, 2) DEFAULT 0,
  num_unique_teams INT, -- quantos times diferentes no lineup
  num_new_champions INT, -- quantos campeões inéditos
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_team_id, round_id)
);

-- 6. CONFIGURAÇÕES DO SISTEMA
CREATE TABLE system_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO system_config (key, value, description) VALUES
('market_close_hours_before', '1', 'Horas antes da rodada para fechar o mercado'),
('market_reopen_day', 'tuesday', 'Dia da semana para reabrir o mercado'),
('diversity_bonus_multiplier', '0.05', 'Multiplicador por time único (5% por time)'),
('new_champion_bonus_points', '10', 'Pontos extras por campeão inédito'),
('current_season', '4', 'Temporada atual do campeonato');
```

### **Alterações nas Tabelas Existentes**

```sql
-- Adicionar campos em players
ALTER TABLE players ADD COLUMN last_performance_update TIMESTAMP;
ALTER TABLE players ADD COLUMN games_played INT DEFAULT 0;
ALTER TABLE players ADD COLUMN total_kills INT DEFAULT 0;
ALTER TABLE players ADD COLUMN total_deaths INT DEFAULT 0;
ALTER TABLE players ADD COLUMN total_assists INT DEFAULT 0;

-- Adicionar campos em user_teams
ALTER TABLE user_teams ADD COLUMN last_locked_at TIMESTAMP;
ALTER TABLE user_teams ADD COLUMN is_locked BOOLEAN DEFAULT false;
ALTER TABLE user_teams ADD COLUMN current_round_points DECIMAL(10, 2) DEFAULT 0;
```

---

## 🔄 FLUXO DO SISTEMA DE MERCADO

### **Ciclo Semanal**

```
Segunda-feira:
  09:00 - Cálculo de pontuações da rodada anterior (Job Automático)
  10:00 - Atualização de rankings de ligas
  11:00 - Notificações enviadas aos usuários

Terça-feira:
  00:00 - REABERTURA DO MERCADO (Job Automático)
  
Quarta a Domingo:
  - Mercado aberto para trocas
  - Usuários ajustam seus lineups
  
Sábado (exemplo):
  16:00 - Rodada começa às 17:00
  16:00 - FECHAMENTO DO MERCADO (1h antes - Job Automático)
  16:00 - Backup dos lineups travados
  17:00 - Início das partidas
  
Domingo:
  - Partidas continuam
  - Coleta de dados em tempo real (opcional)
  
Segunda-feira:
  - Ciclo reinicia
```

### **Estados do Mercado**

```typescript
enum MarketStatus {
  OPEN = 'open',           // Usuários podem fazer trocas
  CLOSING_SOON = 'closing_soon', // Faltam menos de 3h
  CLOSED = 'closed',       // Mercado fechado
  CALCULATING = 'calculating' // Calculando pontuações
}
```

---

## 🎮 SISTEMA DE PONTUAÇÃO

### **Pontuação Base (Oficial Riot)**

```typescript
interface PointsRules {
  // Kills, Deaths, Assists
  kill: 2,
  death: -0.5,
  assist: 1.5,
  
  // Objetivos
  firstBlood: 3,
  tripleKill: 5,
  quadraKill: 8,
  pentaKill: 10,
  
  // CS (Creep Score)
  per10CS: 0.5, // 0.5 ponto a cada 10 CS
  
  // Vitória/Derrota
  win: 3,
  loss: -1,
  
  // Performance excepcional
  kda_above_5: 5, // Bônus se KDA > 5
  perfect_game: 10, // Bônus se 0 mortes e vitória
}
```

### **Buffs de Diversidade**

```typescript
interface DiversityBonus {
  // Quanto mais times diferentes, maior o bônus
  '5_unique_teams': {
    multiplier: 1.25, // +25% nos pontos totais
    description: 'Lineup com 5 times diferentes'
  },
  '4_unique_teams': {
    multiplier: 1.15, // +15%
    description: 'Lineup com 4 times diferentes'
  },
  '3_unique_teams': {
    multiplier: 1.08, // +8%
    description: 'Lineup com 3 times diferentes'
  },
  '2_unique_teams': {
    multiplier: 1.00, // 0%
    description: 'Lineup com 2 times diferentes ou menos (sem bônus)'
  }
}
```

### **Buff de Campeão Inédito**

```typescript
interface NewChampionBonus {
  points_per_champion: 10,
  max_bonus: 50, // Máximo 5 campeões inéditos
  description: 'Pontos extras por campeão que o jogador ainda não usou'
}

// Exemplo:
// Se o player TOP nunca jogou de Aatrox nesta season,
// e você escolhe Aatrox para ele esta rodada:
// → +10 pontos de bônus
```

### **Fórmula Final**

```typescript
function calculateRoundScore(userTeam: UserTeam, round: Round): RoundScore {
  // 1. Pontos base de cada jogador
  let basePoints = 0;
  for (const player of userTeam.lineup) {
    basePoints += player.performance.fantasyPoints;
  }
  
  // 2. Buff de diversidade
  const uniqueTeams = countUniqueTeams(userTeam.lineup);
  const diversityMultiplier = getDiversityMultiplier(uniqueTeams);
  const diversityBonus = basePoints * (diversityMultiplier - 1);
  
  // 3. Buff de campeão inédito
  const newChampions = countNewChampions(userTeam, round);
  const newChampionBonus = newChampions * 10;
  
  // 4. Total
  const totalPoints = basePoints + diversityBonus + newChampionBonus;
  
  return {
    basePoints,
    diversityBonus,
    newChampionBonus,
    totalPoints,
    uniqueTeams,
    newChampions
  };
}
```

---

## 🕷️ SISTEMA DE SCRAPING (LEAGUEPEDIA)

### **Estrutura de Scraping**

```typescript
interface LeaguepediaScraper {
  // URLs base
  baseUrl: 'https://lol.fandom.com',
  seasonUrl: '/wiki/IDL_Kings_Lendas_Season_4',
  
  // Endpoints
  endpoints: {
    schedule: '/wiki/IDL_Kings_Lendas_Season_4/Schedule',
    statistics: '/wiki/IDL_Kings_Lendas_Season_4/Statistics/Players',
    matches: '/wiki/IDL_Kings_Lendas_Season_4/Match_History'
  }
}
```

### **Fluxo de Coleta de Dados**

```
1. COLETA DE AGENDA (Schedule)
   ↓
   - Buscar datas das rodadas
   - Identificar confrontos
   - Salvar na tabela `rounds` e `matches`

2. COLETA DE ESTATÍSTICAS (Statistics)
   ↓
   - Após cada partida, buscar stats dos jogadores
   - KDA, CS, Gold, Damage, Wards
   - Salvar em `player_performances`

3. CÁLCULO DE PONTOS
   ↓
   - Aplicar regras de pontuação
   - Calcular buffs
   - Atualizar `round_scores` e `user_teams`
```

### **Implementação do Scraper**

```typescript
// scraper/leaguepedia.service.ts
export class LeaguepediaService {
  async fetchRoundSchedule(season: number, round: number) {
    // Busca agenda da rodada
  }
  
  async fetchMatchDetails(matchId: string) {
    // Busca detalhes de uma partida específica
  }
  
  async fetchPlayerPerformance(matchId: string, playerId: string) {
    // Busca estatísticas de um jogador em uma partida
  }
  
  async updateAllPlayersStats(round: number) {
    // Atualiza stats de todos os jogadores após rodada
  }
}
```

**Alternativas caso scraping direto não funcione:**
- Usar API do Riot Games (se disponível para CBLOL)
- Parsear planilhas Google Sheets públicas
- Integração com PandaScore API
- Web scraping com Puppeteer (contornar bloqueios)

---

## 🤖 JOBS AUTOMÁTICOS (CRON)

### **Configuração de Tarefas Agendadas**

```typescript
// jobs/scheduler.ts
import { CronJob } from 'cron';

// 1. FECHAR MERCADO (1h antes da rodada)
new CronJob('0 * * * *', async () => { // A cada hora
  const upcomingRounds = await getUpcomingRounds();
  for (const round of upcomingRounds) {
    const hoursUntilStart = getHoursUntil(round.start_date);
    if (hoursUntilStart <= 1 && round.is_market_open) {
      await closeMarket(round.id);
      await lockAllUserTeams(round.id);
      console.log(`✅ Mercado fechado para rodada ${round.round_number}`);
    }
  }
});

// 2. CALCULAR PONTUAÇÕES (Segunda-feira 9h)
new CronJob('0 9 * * 1', async () => { // Segunda às 9h
  const lastRound = await getLastCompletedRound();
  await calculateAllScores(lastRound.id);
  await updateLeagueRankings();
  await sendNotifications();
  console.log('✅ Pontuações calculadas');
});

// 3. REABRIR MERCADO (Terça-feira 00h)
new CronJob('0 0 * * 2', async () => { // Terça às 00h
  await reopenMarket();
  await unlockAllUserTeams();
  console.log('✅ Mercado reaberto');
});

// 4. COLETAR DADOS DA LEAGUEPEDIA (Domingo 22h)
new CronJob('0 22 * * 0', async () => { // Domingo às 22h
  const currentRound = await getCurrentRound();
  await scrapMatchResults(currentRound.id);
  console.log('✅ Dados coletados da Leaguepedia');
});
```

---

## 🔌 ENDPOINTS DA API

### **Mercado**

```typescript
GET    /api/market/status
// Retorna status atual do mercado

POST   /api/market/validate-trade
// Valida se uma troca é permitida (orçamento, mercado aberto, etc)

GET    /api/market/next-close
// Retorna quando o mercado vai fechar
```

### **Rodadas**

```typescript
GET    /api/rounds/current
// Rodada atual

GET    /api/rounds/:id
// Detalhes de uma rodada específica

GET    /api/rounds/:id/matches
// Partidas de uma rodada

GET    /api/rounds/:id/schedule
// Agenda completa da rodada
```

### **Pontuações**

```typescript
GET    /api/scores/user/:userId/round/:roundId
// Pontuação de um usuário em uma rodada específica

GET    /api/scores/user/:userId/history
// Histórico de pontuações por rodada

GET    /api/scores/breakdown/:userId/:roundId
// Detalhamento: base + buffs + total
```

### **Estatísticas**

```typescript
GET    /api/stats/player/:playerId/performance/:roundId
// Performance de um jogador em uma rodada

GET    /api/stats/player/:playerId/season
// Estatísticas acumuladas na season

GET    /api/stats/champions/unused/:userId
// Campeões que o usuário ainda não usou (para buff)
```

### **Admin**

```typescript
POST   /api/admin/scrape/round/:roundId
// Dispara scraping manual de uma rodada

POST   /api/admin/calculate/round/:roundId
// Dispara cálculo manual de pontuações

POST   /api/admin/market/force-close
// Fecha mercado manualmente (emergência)

POST   /api/admin/market/force-open
// Abre mercado manualmente (emergência)
```

---

## 🎨 MELHORIAS NA UI (Frontend)

### **Novos Componentes Necessários**

```typescript
// 1. Market Timer
<MarketTimer 
  closesAt={marketCloseTime}
  status={marketStatus}
/>

// 2. Round Schedule
<RoundSchedule 
  round={currentRound}
  matches={upcomingMatches}
/>

// 3. Score Breakdown
<ScoreBreakdown 
  basePoints={120}
  diversityBonus={18}    // +15% por 4 times diferentes
  newChampionBonus={30}  // 3 campeões inéditos × 10
  total={168}
/>

// 4. Champion History
<ChampionHistory 
  playerId={player.id}
  selectedChampions={['Aatrox', 'Gnar', 'Jax']}
  availableForBonus={true}
/>

// 5. Diversity Indicator
<DiversityIndicator 
  uniqueTeams={4}
  bonus="15%"
  message="Adicione mais 1 time para +25%!"
/>
```

---

## 📈 ROADMAP DE IMPLEMENTAÇÃO

### **FASE 1 - FUNDAÇÃO (Semana 1-2)**
- [ ] Criar novas tabelas no Supabase
- [ ] Migrar dados existentes
- [ ] Setup do backend (Express + TypeScript)
- [ ] Implementar autenticação e middleware
- [ ] Criar endpoints básicos de rodadas

### **FASE 2 - SCRAPING (Semana 2-3)**
- [ ] Implementar LeaguepediaService
- [ ] Testar coleta de dados da Season 3 (histórico)
- [ ] Parser de estatísticas de jogadores
- [ ] Salvar performances no banco
- [ ] Validar integridade dos dados

### **FASE 3 - SISTEMA DE PONTUAÇÃO (Semana 3-4)**
- [ ] Implementar cálculo de pontos base
- [ ] Implementar buff de diversidade
- [ ] Implementar buff de campeão inédito
- [ ] Criar endpoints de scores
- [ ] Testes unitários das fórmulas

### **FASE 4 - MERCADO AUTOMÁTICO (Semana 4-5)**
- [ ] Implementar fechamento automático
- [ ] Implementar reabertura automática
- [ ] Sistema de travamento de lineups
- [ ] Validações de mercado fechado
- [ ] Notificações aos usuários

### **FASE 5 - JOBS E AUTOMAÇÃO (Semana 5-6)**
- [ ] Setup de Cron Jobs
- [ ] Job de fechamento de mercado
- [ ] Job de cálculo de pontuações
- [ ] Job de reabertura de mercado
- [ ] Job de scraping automático
- [ ] Logs e monitoramento

### **FASE 6 - FRONTEND (Semana 6-7)**
- [ ] Componente de timer do mercado
- [ ] Tela de agenda de rodadas
- [ ] Detalhamento de pontuação
- [ ] Histórico de campeões
- [ ] Indicador de diversidade
- [ ] Notificações visuais

### **FASE 7 - TESTES E DEPLOY (Semana 7-8)**
- [ ] Testes de integração
- [ ] Testes de carga
- [ ] Deploy do backend
- [ ] Deploy do frontend
- [ ] Configuração de Cron em produção
- [ ] Monitoramento e logs

### **FASE 8 - POLIMENTO (Semana 8+)**
- [ ] Otimizações de performance
- [ ] Cache de dados frequentes
- [ ] Analytics de uso
- [ ] Ajustes de UX
- [ ] Documentação final

---

## 🎯 DIFERENCIAIS COMPETITIVOS

### **Vs Fantasy Oficial**

| Feature | Fantasy Oficial | Nosso Fantasy |
|---------|----------------|---------------|
| Mercado dinâmico | ✅ | ✅ |
| Buff de diversidade | ✅ | ✅ |
| Buff de campeão novo | ✅ | ✅ |
| Ligas privadas | ✅ | ✅ |
| Ligas por time | ❌ | ✅ |
| Avatar customizado | ❌ | ✅ |
| Histórico detalhado | Básico | Completo |
| Notificações | Email | Email + Push |
| Mobile app | ❌ | Roadmap |

---

## 🔒 SEGURANÇA E VALIDAÇÕES

### **Validações Críticas**

```typescript
// 1. Impedir mudanças após mercado fechado
if (market.isClosed) {
  throw new Error('Mercado fechado - não é possível fazer trocas');
}

// 2. Validar orçamento
if (newLineup.totalPrice > userTeam.budget) {
  throw new Error('Orçamento insuficiente');
}

// 3. Validar lineup completo
if (!hasAllRoles(newLineup)) {
  throw new Error('Lineup incompleto - faltam jogadores');
}

// 4. Impedir manipulação de pontos
// Pontos são calculados APENAS no backend
// Frontend apenas exibe os valores
```

---

## 📊 MÉTRICAS E MONITORAMENTO

### **KPIs para Monitorar**

```typescript
interface SystemMetrics {
  // Performance
  apiResponseTime: number,        // Tempo médio de resposta
  scrapingSuccessRate: number,    // Taxa de sucesso do scraping
  jobExecutionTime: number,       // Tempo dos jobs automáticos
  
  // Uso
  activeUsers: number,            // Usuários ativos por rodada
  tradesPerRound: number,         // Média de trocas por rodada
  leaguesCreated: number,         // Novas ligas criadas
  
  // Negócio
  userRetention: number,          // Retenção semana a semana
  avgScorePerRound: number,       // Pontuação média
  popularPlayers: Player[]        // Jogadores mais escalados
}
```

---

## 🚀 PRÓXIMOS PASSOS

### **Decisões Necessárias**

1. **Backend Framework**: Express, Fastify ou NestJS?
2. **Hosting**: Vercel, Railway, Heroku ou AWS?
3. **Scraping Strategy**: Puppeteer, Cheerio ou API externa?
4. **Notificações**: Email only, Push notifications, ou ambos?
5. **Mobile**: PWA ou app nativo no futuro?

### **O que implementar AGORA?**

Sugiro começarmos pela **FASE 1** e criar:
1. Script SQL para as novas tabelas
2. Setup básico do backend
3. Primeiro endpoint de teste
4. Validar conexão com Supabase

---

## 📞 PRÓXIMA AÇÃO

**Você quer que eu:**

A) Comece criando as tabelas SQL no Supabase?
B) Setup do backend (Express + TypeScript)?
C) Implementar o scraper da Leaguepedia primeiro?
D) Criar endpoints básicos da API?
E) Outro ponto específico?

**Me diga por onde prefere começar e vamos construir isso juntos! 🎮⚡**
