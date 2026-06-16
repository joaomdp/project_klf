# Pontuação de fallback do reserva (10%)

**Data:** 2026-06-16
**Arquivo afetado:** `kingsfantasy/api/src/services/scoring.service.ts` — função `calculateRoundScore`
**Schema de banco:** sem alterações

> ⚠️ **Zona protegida:** a lógica de cálculo do backend (scoring) é marcada como não-tocar.
> Esta alteração foi **explicitamente autorizada** pelo usuário em 2026-06-16.

## Problema

Quase todos os times têm jogadores reservas. O usuário não sabe, antes da partida,
quem de fato vai jogar. Se ele escala o jogador A e quem joga é o reserva B (do mesmo
time), hoje A não tem performance e o slot pontua **0** — o usuário perde tudo.

## Objetivo

Quando o jogador escalado A **não joga**, dar um consolo: creditar ao slot **10% dos
pontos que um companheiro de time dele realmente fez** na rodada. Assim o usuário é
recompensado por "ao menos ter acertado o time".

## Regras (decididas com o usuário)

1. **Base dos 10%:** sobre os pontos que o **companheiro que jogou** fez (não os de A —
   A não jogou, logo tem 0).
2. **Quando aplicar:** somente quando A **não tem nenhuma performance** na rodada.
   Se A jogou, ele pontua **100%** normalmente (comportamento atual intacto).
3. **Qual companheiro:** entre quem jogou na rodada do **mesmo time** de A:
   - preferir quem jogou na **mesma role** de A; havendo mais de um, o **maior pontuador**;
   - se ninguém do time jogou na role de A, usar o **maior pontuador do time**;
   - se o time inteiro de A não jogou, o slot vale **0**.
4. **Evitar dupla contagem (decisão B):** o companheiro candidato é escolhido
   **excluindo jogadores que já estão no lineup do usuário**. Assim um titular que já
   pontua 100% no slot dele não gera 10% adicionais no slot de A.
5. **Diversidade (decisão A):** quando o slot de A pontua via fallback, o **time de A
   conta** no bônus de diversidade (o usuário não é penalizado duas vezes pela ausência).
6. **Percentual:** `RESERVE_FALLBACK_PERCENT = 0.10`, **fixo** no código.

## Desenho técnico

### Estado atual de `calculateRoundScore`

- Busca o lineup do `user_team` (objeto indexado por role; cada slot tem `{ id, role, ... }`;
  o `team_id` **não** é guardado no lineup — só o nome do time).
- Busca performances **apenas dos jogadores escalados** (`.in('player_id', playerIds)`),
  com join `players!inner(id, team_id)`.
- Para cada jogador, normaliza pontos: soma por match ÷ `games_count`, média entre matches.
- Soma os jogadores → `basePoints`; aplica bônus de diversidade sobre `basePoints`.

### Mudanças

1. **Ampliar a busca de performances para a rodada inteira.**
   Trocar `.in('player_id', playerIds)` por buscar todas as performances dos `matchIds`
   da rodada, com join `players!inner(id, team_id, role)`. Isso permite localizar os
   companheiros que jogaram. (Volume = 1 rodada; aceitável.)

2. **Montar mapas a partir dessas performances:**
   - `pointsByPlayer: Map<playerId, number>` — pontos normalizados da rodada (mesma
     fórmula de normalização já existente).
   - `infoByPlayer: Map<playerId, { teamId, role }>`.

3. **Resolver os `team_id`/`role` dos escalados que não jogaram.**
   Os jogadores escalados que não têm performance não aparecem nos mapas acima. Buscar
   seus `team_id`/`role` na tabela `players` num único `.in('id', missingIds)`.
   (A `role` também pode vir da chave do slot no lineup; usar a chave do slot como role.)

4. **Função pura de resolução do slot.**
   Extrair um helper puro (sem I/O), recebendo: id e role de A, `pointsByPlayer`,
   `infoByPlayer`, e o conjunto de `lineupPlayerIds`. Retorna
   `{ points: number, teamIdContado: string | null }`:
   - se A ∈ `pointsByPlayer` → `{ points: pontosDeA, teamIdContado: teamIdDeA }` (100%);
   - senão, candidatos = jogadores em `infoByPlayer` com `teamId === teamIdDeA` e
     `id ∉ lineupPlayerIds`:
     - filtra os de mesma role; se houver, pega o de maior `pointsByPlayer`;
     - senão, pega o de maior `pointsByPlayer` entre todos os candidatos;
     - retorna `{ points: 0.10 * pontosDoCandidato, teamIdContado: teamIdDeA }`;
     - sem candidatos → `{ points: 0, teamIdContado: null }`.
   Helper puro = testável isoladamente (não há framework de teste no projeto; cobrir por
   raciocínio e, se desejado, um script ts-node focado).

5. **Somar e diversidade.**
   `basePoints` = soma dos `points` de todos os slots. O conjunto de times para
   diversidade passa a ser os `teamIdContado` não-nulos retornados pelo helper (inclui o
   time de A nos slots que pontuaram via fallback — decisão A). Mantém a fórmula de
   diversidade atual.

### Não muda

- Fórmula de normalização por match/`games_count`.
- Estrutura de `round_scores` (o crédito de 10% se dissolve em `base_points`).
- Preços, patrimônio, cron, market, history.
- Comportamento quando o jogador escalado jogou (100%).

## Casos de borda

| Caso | Resultado |
|------|-----------|
| A jogou | 100% de A (sem mudança) |
| A não jogou; companheiro de mesma role jogou | 10% desse companheiro |
| A não jogou; ninguém na role mas o time jogou | 10% do maior pontuador do time |
| A não jogou; time inteiro ausente | 0 |
| Único candidato já está no lineup do usuário | excluído; cai para próximo candidato ou 0 |
| Vários companheiros na mesma role | maior pontuador |

## Verificação

- Sem framework de teste no projeto (`npm test` é no-op).
- Plano: helper puro + checagem por raciocínio dos casos da tabela acima; opcionalmente
  um script `ts-node` pontual que monta mapas sintéticos e valida os retornos do helper.
- Conferir `npm run build` (tsc) sem erros de tipo.
