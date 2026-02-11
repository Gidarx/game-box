# Caixa Misteriosa

Party game show multiplayer em tempo real, com host em tela grande e jogadores no celular.

- Host controla a partida em `/host`
- Jogadores entram em `/play`
- Sincronizacao via Socket.IO

---

## Sumario

1. Visao geral
2. Como jogar (rapido)
3. Regras detalhadas
4. Sistema de pontuacao
5. Fases e estados do jogo
6. Modos de jogo
7. Reconexao de jogador
8. Setup e execucao
9. Scripts
10. Arquitetura tecnica
11. Estrutura de pastas
12. Eventos Socket.IO
13. Configuracoes da sala
14. Troubleshooting
15. Limitacoes atuais

---

## Visao geral

O jogo mistura trivia, risco e estrategia em rodadas.

Fluxo alto nivel:

1. Trivia simultanea para definir o atacante da rodada.
2. Escolha de uma caixa fechada.
3. Mini fase de ranking para ganhar chances.
4. Abertura de cartas para tentar desbloquear a caixa.
5. Revelacao de premio ou penalidade.
6. Wildcard a cada 2 caixas abertas.

Objetivo:

Terminar com a maior pontuacao do time.

---

## Como jogar (rapido)

### Host

1. Rode o projeto com `pnpm dev`.
2. Abra `http://localhost:3000/host`.
3. Mostre o QR Code para os jogadores entrarem.
4. Aguarde no minimo 3 jogadores conectados.
5. Clique em **Iniciar Jogo**.

### Jogador

1. Abra `http://localhost:3000/play?room=CODIGO` ou escaneie o QR.
2. Informe nome.
3. Aguarde a trivia comecar.
4. Responda rapido para ganhar a vez da rodada.

---

## Regras detalhadas

### Lobby

- Codigo da sala com 6 caracteres.
- Inicio exige no minimo 3 jogadores conectados.
- Host pode alterar o modo (`solo` ou `equipes`).
- Host pode alterar a quantidade de caixas (5 a 13).
- Host pode adicionar bots de teste no lobby (`+1` ou `+3`) e limpar bots.
- Limite total de jogadores conectados por sala: `8` (humanos + bots).

### Trivia simultanea (`trivia_all`)

- Todos respondem ao mesmo tempo no celular.
- Bots respondem automaticamente para testes de fluxo.
- Vence o primeiro jogador que acertar (por timestamp).
- Time vencedor ganha `+10`.
- Se ninguem acertar, nova pergunta.
- Time congelado por wildcard `FREEZE` nao pode responder naquela rodada.
- Apenas jogadores elegiveis contam para auto-resolucao da pergunta.

### Escolha da caixa (`box_select`)

- Host seleciona uma caixa fechada para o vencedor da trivia atacar.
- A caixa selecionada vira a "caixa ativa" da rodada.

### Ranking (`ranking_challenge`)

- Host responde um desafio de ordenar 4 itens.
- Resultado define tentativas de abrir cartas.
- `4/4` corretas => `3` chances.
- `<4/4` => `2` chances.

### Grid de cartas (`card_open`)

Cada caixa gera um grid de 12 cartas:

- 3 `key` (nao gastam chance)
- 7 `distractor` (gastam 1 chance)
- 1 `lost_turn` (zera chances e volta para trivia)
- 1 `duel` (gasta 1 chance e inicia duelo)

Regras:

- Ao travar 3 keys, a caixa abre.
- Se as chances acabarem antes de 3 keys, volta para trivia.
- A caixa ativa continua em disputa ate abrir.

### Duelo (`duel`)

- So o duelista da rodada pode responder.
- Acerto concede `+200` para o time.
- Depois volta para `card_open` se ainda houver chances, senao retorna para `trivia_all`.

### Revelacao (`reveal`)

- Exibe premio, raridade e pontos finais da caixa.
- Em `pegadinha`, penalidade por raridade.
- comum: `-50`
- raro: `-100`
- lendario: `-150`
- Se o time tiver `shield`, a penalidade e bloqueada.

### Wildcard (`wildcard`)

Dispara a cada 2 caixas abertas.

Cartas implementadas:

- `FREEZE`: congela o time alvo por 1 rodada de trivia
- `STEAL`: atacante rouba 1 item nao-protegido do alvo
- `SHIELD`: adiciona 1 escudo ao time alvo
- `SWAP`: troca itens entre atacante e alvo

Regras internas importantes:

- `FREEZE` nao pode repetir no mesmo time em duas ativacoes seguidas.
- `STEAL` so pode ser usado 1 vez por time atacante na partida.
- Itens com `shielded=true` nao podem ser roubados/trocados.

### Fim de jogo (`game_over`)

A partida termina quando:

- todas as caixas forem abertas, ou
- atingir `maxRounds` (padrao: `30`)

---

## Sistema de pontuacao

Fontes de pontos:

- Trivia vencedora da rodada: `+10`
- Duelo acertado: `+200`
- Premio da caixa: valor da caixa
- Caixa final aplica multiplicador (`multiplier`) quando definido

Penalidades:

- Pegadinhas por raridade: `-50`, `-100`, `-150`
- Penalidades respeitam piso zero no score do time (`Math.max(0, ...)`)

---

## Fases e estados do jogo

Estados ativos no runtime:

- `lobby`
- `trivia_all`
- `box_select`
- `ranking_challenge`
- `card_open`
- `duel`
- `reveal`
- `wildcard`
- `game_over`

Transicoes principais:

1. `lobby -> trivia_all` (host inicia)
2. `trivia_all -> box_select` (ha vencedor)
3. `trivia_all -> trivia_all` (sem vencedor)
4. `box_select -> ranking_challenge`
5. `ranking_challenge -> card_open`
6. `card_open -> duel` (carta duelo)
7. `card_open -> reveal` (3 keys)
8. `card_open -> trivia_all` (sem chances)
9. `duel -> card_open` ou `duel -> trivia_all`
10. `reveal -> wildcard` a cada 2 caixas
11. `wildcard -> trivia_all`
12. `qualquer fase relevante -> game_over` por fim de caixas ou max rounds

---

## Modos de jogo

### Solo

- Cada jogador vira um time proprio.
- Nome do time = nome do jogador.

### Equipes

- Times sao montados automaticamente.
- Distribuicao balanceada entre `Equipe A` e `Equipe B`.

---

## Reconexao de jogador

Cliente `/play` salva localmente:

- `roomCode`
- `playerId`
- `playerName`

Na reconexao:

- cliente envia `room:rejoin`
- servidor reanexa o socket ao jogador existente
- estado atual da partida e sincronizado

---

## Setup e execucao

## Requisitos

- Node.js 18+
- pnpm

## Instalar dependencias

```bash
pnpm install
```

## Desenvolvimento

```bash
pnpm dev
```

Acesso:

- Host: `http://localhost:3000/host`
- Player: `http://localhost:3000/play`

## Producao

```bash
pnpm build
pnpm start
```

---

## Scripts

`package.json`:

- `pnpm dev` => sobe Next + Socket.IO via `server.js`
- `pnpm build` => build de producao Next
- `pnpm start` => inicia servidor em producao
- `pnpm lint` => analise estatica com ESLint

---

## Arquitetura tecnica

Stack:

- Next.js (App Router)
- React
- Socket.IO (`socket.io` + `socket.io-client`)
- Servidor HTTP custom em `server.js`

Pontos principais:

- Estado da sala mantido em memoria (`Map`) no servidor.
- Sincronizacao por evento `game:stateSync`.
- Atualizacoes de fase por `game:phaseChange`.
- Questoes via API externa Tryvia, com fallback local.
- Sanitizacao no estado evita enviar respostas corretas em aberto.

---

## Estrutura de pastas

```text
.
|- server.js                      # servidor custom + regras do jogo
|- src/app/host/page.tsx          # tela do host
|- src/app/play/page.tsx          # tela do jogador
|- src/components/host/*          # views de cada fase do host
|- src/hooks/useSocket.ts         # wrapper de socket client
|- src/shared/events.ts           # contrato de eventos
|- src/shared/types.ts            # contrato de tipos
|- src/data/*                     # bancos de dados auxiliares
```

---

## Eventos Socket.IO

## Sala

- `room:create`
- `room:join`
- `room:rejoin`
- `room:playerReady`
- `room:playerJoined`
- `room:playerLeft`

## Jogo

- `game:start`
- `game:settingsUpdate`
- `game:stateSync`
- `game:phaseChange`
- `host:forceNext`

## Trivia

- `trivia:question`
- `trivia:answer`
- `trivia:playerAnswered`
- `trivia:result`
- `trivia:forceResolve`

## Caixa / ranking / cartas

- `box:select`
- `box:selected`
- `box:reveal`
- `ranking:show`
- `ranking:submit`
- `ranking:result`
- `card:open`
- `card:opened`
- `card:gridState`

## Duelo

- `duel:start`
- `duel:answer`
- `duel:result`

## Wildcard

- `wildcard:draw`
- `wildcard:apply`
- `wildcard:effect`
- `wildcard:skip`

---

## Configuracoes da sala

Configuracoes suportadas no servidor:

- `mode` (`solo` | `equipes`)
- `boxCount` (5..13)
- `maxRounds` (padrao 30)

Obs:

- Nem todas as configuracoes avancadas tem controle visual exposto no lobby por padrao.

---

## Troubleshooting

## Jogador nao conecta

- confirme host e jogador na mesma rede
- confira se porta `3000` esta liberada
- confirme URL correta de sala

## Sala nao encontrada

- codigo invalido ou sala expirada (estado em memoria)
- host pode ter reiniciado servidor

## Jogo nao inicia

- precisa de no minimo 3 conectados

## Celular desconectou no meio da partida

- reabra `/play`
- o cliente tenta `room:rejoin` automaticamente com a sessao salva

## Build/lint

- rode `pnpm lint`
- rode `pnpm build`

---

## Limitacoes atuais

- Estado em memoria (sem persistencia em banco)
- Sem autentificacao de usuario
- Sem historico de partidas
- Modo `equipes` atual e automatico (sem draft manual por jogador)

---

## Referencia rapida de gameplay

1. Ganhe a trivia para atacar.
2. Escolha caixa.
3. Tire boa nota no ranking para ganhar mais chances.
4. Ache 3 keys antes de acabar as chances.
5. Administre risco de duel, pegadinha e wildcard.
