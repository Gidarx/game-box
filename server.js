/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const MIN_PLAYERS_TO_START = 3;
const MAX_PLAYERS_PER_ROOM = 8;
const DEFAULT_MAX_ROUNDS = 30;
const DEFAULT_MAX_CHANCES = 3;
const BOT_TRIVIA_ACCURACY = 0.62;
const BOT_DUEL_ACCURACY = 0.58;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ===== TRYVIA API =====
async function fetchTryviaQuestions(amount = 30) {
    try {
        const tokenRes = await fetch('https://tryvia.ptr.red/api_token.php?command=request');
        const tokenData = await tokenRes.json();
        const token = tokenData.token || '';
        const url = `https://tryvia.ptr.red/api.php?amount=${amount}&type=multiple&token=${token}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.response_code === 0 && data.results) {
            const filtered = data.results.filter(q =>
                !q.category?.toLowerCase().includes('anime') &&
                !q.category?.toLowerCase().includes('manga')
            );
            return filtered.map((q, i) => {
                const options = shuffleArray([q.correct_answer, ...q.incorrect_answers]);
                return {
                    id: `tryvia_${i}_${Date.now()}`,
                    text: decodeHTML(q.question),
                    options: options.map(o => decodeHTML(o)),
                    correctIndex: options.indexOf(q.correct_answer),
                    category: q.category || 'Geral',
                    difficulty: q.difficulty || 'medium',
                    timeLimit: q.difficulty === 'hard' ? 15 : q.difficulty === 'easy' ? 10 : 12,
                };
            });
        }
    } catch (err) {
        console.error('[Tryvia] Falha:', err.message);
    }
    return getFallbackQuestions();
}

function decodeHTML(text) {
    if (!text) return '';
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&eacute;/g, 'é')
        .replace(/&atilde;/g, 'ã').replace(/&ccedil;/g, 'ç').replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
        .replace(/&otilde;/g, 'õ').replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô');
}

// ===== RANKING CHALLENGE BANK =====
const RANKING_CHALLENGES = [
    { question: 'Ordene por número de seguidores no Instagram (mais → menos)', items: ['Cristiano Ronaldo', 'Lionel Messi', 'Selena Gomez', 'Kylie Jenner'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por população (maior → menor)', items: ['China', 'Índia', 'EUA', 'Brasil'], correctOrder: [1, 0, 2, 3] },
    { question: 'Ordene por ano de lançamento (mais antigo → recente)', items: ['iPhone', 'Facebook', 'YouTube', 'WhatsApp'], correctOrder: [1, 2, 0, 3] },
    { question: 'Ordene por bilheteria mundial (maior → menor)', items: ['Avatar', 'Vingadores: Ultimato', 'Titanic', 'Star Wars VII'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por área territorial (maior → menor)', items: ['Rússia', 'Canadá', 'China', 'Brasil'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por altitude (mais alto → mais baixo)', items: ['Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por ouvintes mensais no Spotify (mais → menos)', items: ['The Weeknd', 'Taylor Swift', 'Ed Sheeran', 'Bruno Mars'], correctOrder: [0, 1, 3, 2] },
    { question: 'Ordene por número de Copas do Mundo (mais → menos)', items: ['Brasil', 'Alemanha', 'Itália', 'Argentina'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por números de inscritos no YouTube (mais → menos)', items: ['MrBeast', 'PewDiePie', 'Cocomelon', 'T-Series'], correctOrder: [3, 0, 2, 1] },
    { question: 'Ordene por duração (maior → menor)', items: ['O Senhor dos Anéis: Retorno do Rei', 'Titanic', 'Interestelar', 'Matrix'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por velocidade máxima (mais rápido → lento)', items: ['Bugatti Chiron', 'Lamborghini Aventador', 'Ferrari LaFerrari', 'Porsche 911 GT3'], correctOrder: [0, 2, 1, 3] },
    { question: 'Ordene por PIB nominal (maior → menor)', items: ['EUA', 'China', 'Japão', 'Alemanha'], correctOrder: [0, 1, 2, 3] },
];

function getRandomRanking() {
    return RANKING_CHALLENGES[Math.floor(Math.random() * RANKING_CHALLENGES.length)];
}

function scoreRanking(playerOrder, correctOrder) {
    let correct = 0;
    for (let i = 0; i < correctOrder.length; i++) {
        if (playerOrder[i] === correctOrder[i]) correct++;
    }
    return correct;
}

// ===== SERVER =====
app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        transports: ['websocket', 'polling'],
    });

    global.__io = io;

    io.on('connection', (socket) => {
        console.log(`[Socket] Conectado: ${socket.id}`);

        const rooms = global.__rooms || (global.__rooms = new Map());
        const socketToRoom = global.__socketToRoom || (global.__socketToRoom = new Map());
        const normalizeCode = (code) => String(code || '').toUpperCase();
        const isHost = (room) => room?.hostSocketId === socket.id;
        const isValidPlayerSocket = (roomCode, playerId) => {
            const mapping = socketToRoom.get(socket.id);
            return !!mapping && mapping.roomCode === normalizeCode(roomCode) && mapping.playerId === playerId;
        };
        const ensurePlayerSocketBinding = (room, roomCode, playerId) => {
            if (!room || !playerId) return false;
            if (isValidPlayerSocket(roomCode, playerId)) return true;
            const player = room.players[playerId];
            if (player?.socketId === socket.id) {
                socketToRoom.set(socket.id, { roomCode: normalizeCode(roomCode), playerId });
                return true;
            }
            return false;
        };

        // ===== ROOM MANAGEMENT =====
        socket.on('room:create', (settings, callback) => {
            const code = generateRoomCode();
            const room = createGameRoom(code, socket.id, settings);
            rooms.set(code, room);
            socket.join(code);
            console.log(`[Room] Sala criada: ${code}`);
            callback({ success: true, roomCode: code, state: sanitizeState(room) });
        });

        socket.on('room:join', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const { playerName, device } = data;
            const room = rooms.get(roomCode);
            if (!room) return callback({ success: false, error: 'Sala nao encontrada' });
            if (room.phase !== 'lobby') return callback({ success: false, error: 'Jogo ja iniciado' });
            const connectedPlayers = Object.values(room.players).filter((p) => p.isConnected).length;
            if (connectedPlayers >= MAX_PLAYERS_PER_ROOM) {
                return callback({ success: false, error: `Sala lotada (${MAX_PLAYERS_PER_ROOM})` });
            }

            const playerId = generateId();
            const player = {
                id: playerId, name: playerName, teamId: null,
                socketId: socket.id, isReady: false, isConnected: true,
                score: 0, device: device || 'unknown',
            };

            room.players[playerId] = player;
            if (room.mode === 'solo') assignPlayerToSoloTeam(room, playerId);
            else assignPlayerToBalancedTeam(room, playerId);

            socketToRoom.set(socket.id, { roomCode, playerId });
            socket.join(roomCode);

            io.to(roomCode).emit('room:playerJoined', { player, state: sanitizeState(room) });
            callback({ success: true, playerId, state: sanitizeState(room) });
        });

        socket.on('room:rejoin', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const playerId = data.playerId;
            const room = rooms.get(roomCode);
            if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
            if (!playerId || !room.players[playerId]) return callback?.({ success: false, error: 'Sessao nao encontrada' });

            const player = room.players[playerId];
            if (player.socketId && player.socketId !== socket.id) {
                socketToRoom.delete(player.socketId);
            }
            player.socketId = socket.id;
            player.isConnected = true;
            if (data.device) player.device = data.device;

            socketToRoom.set(socket.id, { roomCode, playerId });
            socket.join(roomCode);

            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true, playerId, state: sanitizeState(room) });
        });

        socket.on('room:playerReady', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (room && room.players[data.playerId] && ensurePlayerSocketBinding(room, roomCode, data.playerId)) {
                room.players[data.playerId].isReady = true;
                io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            }
            callback?.({ success: true });
        });

        // ===== SETTINGS =====
        socket.on('game:settingsUpdate', (data) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'lobby') return;
            if (!isHost(room)) return;

            if (data.settings.mode && data.settings.mode !== room.mode) {
                room.mode = data.settings.mode;
                if (room.mode === 'solo') {
                    rebuildSoloTeams(room);
                } else {
                    rebuildTeamMode(room);
                }
            }
            if (data.settings.boxCount) {
                const nextBoxCount = Math.max(5, Math.min(13, Number(data.settings.boxCount) || 13));
                room.boxCount = nextBoxCount;
                room.boxes = getDefaultBoxes().slice(0, nextBoxCount).map(b => ({ ...b, isOpen: false }));
            }
            if (data.settings.maxRounds) {
                room.maxRounds = Math.max(1, Number(data.settings.maxRounds) || DEFAULT_MAX_ROUNDS);
            }
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        });

        // ===== TEST BOTS =====
        socket.on('host:addBots', (data, callback) => {
            const roomCode = normalizeCode(data?.roomCode);
            const room = rooms.get(roomCode);
            if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode adicionar bots' });
            if (room.phase !== 'lobby') return callback?.({ success: false, error: 'Bots so podem ser adicionados no lobby' });

            const requested = Math.max(1, Math.min(20, Number(data?.count) || 1));
            const connectedPlayers = Object.values(room.players).filter((p) => p.isConnected).length;
            const remainingSlots = Math.max(0, MAX_PLAYERS_PER_ROOM - connectedPlayers);
            const toAdd = Math.min(requested, remainingSlots);

            if (toAdd <= 0) {
                return callback?.({ success: false, error: `Limite de ${MAX_PLAYERS_PER_ROOM} jogadores atingido` });
            }

            for (let i = 0; i < toAdd; i++) {
                const botPlayer = createBotPlayer(room);
                room.players[botPlayer.id] = botPlayer;
                if (room.mode === 'solo') assignPlayerToSoloTeam(room, botPlayer.id);
                else assignPlayerToBalancedTeam(room, botPlayer.id);
            }

            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({
                success: true,
                added: toAdd,
                totalBots: Object.values(room.players).filter((p) => p.isBot).length,
            });
        });

        socket.on('host:clearBots', (data, callback) => {
            const roomCode = normalizeCode(data?.roomCode);
            const room = rooms.get(roomCode);
            if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode remover bots' });
            if (room.phase !== 'lobby') return callback?.({ success: false, error: 'Bots so podem ser removidos no lobby' });

            const botIds = Object.values(room.players)
                .filter((p) => p.isBot)
                .map((p) => p.id);

            botIds.forEach((botId) => removePlayerFromRoom(room, botId));

            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true, removed: botIds.length });
        });

        // ===== GAME START =====
        socket.on('game:start', async (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode iniciar' });

            const connected = Object.values(room.players).filter(p => p.isConnected);
            if (connected.length < MIN_PLAYERS_TO_START) {
                return callback?.({ success: false, error: `Minimo ${MIN_PLAYERS_TO_START} jogadores` });
            }

            console.log('[Game] Buscando perguntas do Tryvia API...');
            room._questionPool = await fetchTryviaQuestions(40);
            console.log(`[Game] ${room._questionPool.length} perguntas carregadas`);

            room.phase = 'trivia_all';
            room.round = 1;
            startTrivia(room, roomCode, io);
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true });
        });

        // ===== TRIVIA: ALL PLAYERS ANSWER SIMULTANEOUSLY =====
        socket.on('trivia:answer', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
            if (room.phase !== 'trivia_all') return callback?.({ success: false, error: 'Rodada de trivia nao esta ativa' });
            if (!room.currentQuestion) return callback?.({ success: false, error: 'Pergunta indisponivel' });
            if (!ensurePlayerSocketBinding(room, roomCode, data.playerId)) {
                return callback?.({ success: false, error: 'Jogador invalido' });
            }
            const result = submitTriviaAnswer(room, roomCode, io, data.playerId, data.answerIndex);
            callback?.(result);
        });

        // ===== HOST: FORCE RESOLVE TRIVIA (timeout) =====
        socket.on('trivia:forceResolve', (data) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'trivia_all' || !isHost(room)) return;
            resolveTriviaRound(room, roomCode, io);
        });

        // ===== BOX SELECT =====
        socket.on('box:select', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'box_select' || !isHost(room)) return callback?.({ success: false });
            if (!room.triviaWinnerId) return callback?.({ success: false, error: 'Sem vencedor da trivia' });

            const box = room.boxes.find(b => b.id === data.boxId && !b.isOpen);
            if (!box) return callback?.({ success: false });

            room.selectedBoxId = data.boxId;
            room.lastRevealedBoxId = null;
            room.cardGrid = generateCardGrid(box);
            room.lockedKeys = 0;
            room.attackerTeamId = room.triviaWinnerId ? room.players[room.triviaWinnerId]?.teamId || null : null;

            // Go to ranking challenge
            room.currentRanking = getRandomRanking();
            room.phase = 'ranking_challenge';

            io.to(roomCode).emit('box:selected', { boxId: box.id, box });
            io.to(roomCode).emit('game:phaseChange', { phase: 'ranking_challenge' });
            io.to(roomCode).emit('ranking:show', {
                question: room.currentRanking.question,
                items: room.currentRanking.items,
            });
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true });
        });

        // ===== RANKING CHALLENGE (host submits order) =====
        socket.on('ranking:submit', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'ranking_challenge' || !room.currentRanking || !isHost(room)) return callback?.({ success: false });

            const currentRanking = room.currentRanking;
            const correctCount = scoreRanking(data.order, currentRanking.correctOrder);
            const chances = correctCount >= 4 ? DEFAULT_MAX_CHANCES : Math.max(1, DEFAULT_MAX_CHANCES - 1);

            room.chances = chances;
            room.phase = 'card_open';
            room.currentRanking = null;

            io.to(roomCode).emit('ranking:result', {
                correctCount,
                correctOrder: currentRanking.correctOrder,
                chances,
            });

            // Small delay before card open phase
            setTimeout(() => {
                io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
                io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
                io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            }, 2000);

            callback?.({ success: true, correctCount, chances });
        });

        // ===== OPEN A CARD (uses 1 chance) =====
        socket.on('card:open', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'card_open' || room.chances <= 0 || !isHost(room)) return callback?.({ success: false });

            const card = room.cardGrid.find(c => c.id === data.cardId && c.status === 'hidden');
            if (!card) return callback?.({ success: false, error: 'Carta invalida' });

            card.status = 'revealed';

            if (card.type === 'key') {
                room.lockedKeys++;
                card.status = 'locked';
                // Key doesn't consume a chance!
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'key',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });

                // 3 keys found? Open the box!
                if (room.lockedKeys >= 3) {
                    setTimeout(() => openBox(room, roomCode, io), 1500);
                    io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
                    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
                    return callback?.({ success: true });
                }

            } else if (card.type === 'lost_turn') {
                room.chances = 0; // All chances gone!
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'lost_turn',
                    lockedKeys: room.lockedKeys, chances: 0,
                });
                // Turn ends -> back to trivia with same active box
                setTimeout(() => backToTrivia(room, roomCode, io), 2500);

            } else if (card.type === 'duel') {
                room.chances--; // Costs 1 chance
                room._duelCardId = card.id;
                room.phase = 'duel';
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'duel',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });
                // Start duel
                const duelQ = getNextQuestion(room);
                room.timerEndAt = Date.now() + (duelQ.timeLimit * 1000);
                io.to(roomCode).emit('game:phaseChange', { phase: 'duel' });
                io.to(roomCode).emit('duel:start', {
                    question: { ...duelQ, correctIndex: -1 },
                    currentPlayerId: room.triviaWinnerId,
                    timerEndAt: room.timerEndAt,
                });
                scheduleBotDuelAnswer(room, roomCode, io, room.triviaWinnerId, duelQ);

            } else {
                // Distractor - lose 1 chance
                room.chances--;
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'distractor',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });

                if (room.chances <= 0) {
                    setTimeout(() => backToTrivia(room, roomCode, io), 2000);
                }
            }

            io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true });
        });

        // ===== DUEL ANSWER =====
        socket.on('duel:answer', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
            if (room.phase !== 'duel') return callback?.({ success: false, error: 'Duelo nao esta ativo' });
            if (!room.currentQuestion) return callback?.({ success: false, error: 'Pergunta indisponivel' });
            if (!ensurePlayerSocketBinding(room, roomCode, data.playerId)) {
                return callback?.({ success: false, error: 'Jogador invalido' });
            }
            const result = submitDuelAnswer(room, roomCode, io, data.playerId, data.answerIndex);
            callback?.(result);
        });

        // ===== HOST CONTROLS =====
        socket.on('host:forceNext', (data) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || !isHost(room)) return;

            if (room.phase === 'reveal') {
                // After reveal: wildcard check or next box
                if (room.boxesOpened > 0 && room.boxesOpened % 2 === 0) {
                    const deck = [
                        { type: 'FREEZE', name: 'CONGELAR', description: 'Time perde 1 rodada de trivia.', icon: 'ac_unit' },
                        { type: 'STEAL', name: 'ROUBAR', description: 'Rouba 1 premio de outro time!', icon: 'swap_horizontal_circle' },
                        { type: 'SHIELD', name: 'ESCUDO', description: 'Bloqueia o proximo efeito negativo.', icon: 'shield' },
                        { type: 'SWAP', name: 'TROCA', description: 'Troca premios entre dois times.', icon: 'swap_horiz' },
                    ];
                    room.currentWildcard = deck[Math.floor(Math.random() * deck.length)];
                    room.phase = 'wildcard';
                    io.to(roomCode).emit('game:phaseChange', { phase: 'wildcard' });
                    io.to(roomCode).emit('wildcard:draw', { card: room.currentWildcard });
                } else {
                    goToNextRound(room, roomCode, io);
                }
            } else if (room.phase === 'wildcard') {
                goToNextRound(room, roomCode, io);
            } else if (room.phase === 'trivia_all') {
                resolveTriviaRound(room, roomCode, io);
            } else if (room.phase === 'ranking_challenge' || room.phase === 'card_open') {
                backToTrivia(room, roomCode, io);
            } else if (room.phase === 'duel') {
                clearBotTimers(room);
                room.timerEndAt = null;
                if (room.chances > 0) {
                    room.phase = 'card_open';
                    io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
                } else {
                    backToTrivia(room, roomCode, io);
                }
            }

            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        });

        // ===== WILDCARD =====
        socket.on('wildcard:apply', (data) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'wildcard' || !room.currentWildcard || !isHost(room)) return;
            const team = room.teams[data.targetTeamId];
            if (!team) return;
            const card = room.currentWildcard;
            let applied = true;

            switch (card.type) {
                case 'FREEZE':
                    if (room._lastFrozenTeamId === data.targetTeamId) { applied = false; }
                    else { team.frozenUntilRound = room.round + 1; room._lastFrozenTeamId = data.targetTeamId; }
                    break;
                case 'STEAL':
                    if (room.triviaWinnerId) {
                        const winnerTeamId = room.players[room.triviaWinnerId]?.teamId;
                        if (winnerTeamId && room.teams[winnerTeamId]?.stealUsed) { applied = false; }
                        else if (winnerTeamId && room.teams[winnerTeamId]) {
                            const stealable = team.inventory.filter(i => !i.shielded);
                            if (stealable.length > 0) {
                                const stolen = stealable[Math.floor(Math.random() * stealable.length)];
                                team.inventory = team.inventory.filter(i => i !== stolen);
                                team.score = Math.max(0, team.score - stolen.points);
                                room.teams[winnerTeamId].inventory.push(stolen);
                                room.teams[winnerTeamId].score += stolen.points;
                                room.teams[winnerTeamId].stealUsed = true;
                            } else { applied = false; }
                        }
                    }
                    break;
                case 'SHIELD':
                    team.shields++;
                    break;
                case 'SWAP':
                    if (room.triviaWinnerId) {
                        const atkTeamId = room.players[room.triviaWinnerId]?.teamId;
                        if (atkTeamId && room.teams[atkTeamId]) {
                            const atkTeam = room.teams[atkTeamId];
                            const tItems = team.inventory.filter(i => !i.shielded);
                            const aItems = atkTeam.inventory.filter(i => !i.shielded);
                            if (tItems.length > 0 && aItems.length > 0) {
                                const tI = tItems[Math.floor(Math.random() * tItems.length)];
                                const aI = aItems.find(i => i.rarity === tI.rarity) || aItems[Math.floor(Math.random() * aItems.length)];
                                team.inventory = team.inventory.filter(i => i !== tI);
                                atkTeam.inventory = atkTeam.inventory.filter(i => i !== aI);
                                team.inventory.push(aI); atkTeam.inventory.push(tI);
                                team.score = team.score - tI.points + aI.points;
                                atkTeam.score = atkTeam.score - aI.points + tI.points;
                            } else { applied = false; }
                        }
                    }
                    break;
                default:
                    applied = false;
            }

            room.currentWildcard = null;
            io.to(roomCode).emit('wildcard:effect', { targetTeamId: data.targetTeamId, type: card.type, applied });
            goToNextRound(room, roomCode, io);
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        });

        socket.on('wildcard:skip', (data) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'wildcard' || !isHost(room)) return;
            room.currentWildcard = null;
            goToNextRound(room, roomCode, io);
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        });

        // ===== DISCONNECT =====
        socket.on('disconnect', () => {
            console.log(`[Socket] Desconectado: ${socket.id}`);
            const mapping = socketToRoom.get(socket.id);
            if (mapping) {
                const room = rooms.get(mapping.roomCode);
                if (room) {
                    const player = Object.values(room.players).find(p => p.socketId === socket.id);
                    if (player) {
                        player.isConnected = false;
                        if (room.phase === 'lobby') {
                            if (player.teamId && room.teams[player.teamId]) {
                                const team = room.teams[player.teamId];
                                team.playerIds = team.playerIds.filter(id => id !== player.id);
                                if (team.playerIds.length === 0) delete room.teams[player.teamId];
                            }
                            delete room.players[player.id];
                        }
                        io.to(mapping.roomCode).emit('room:playerLeft', { playerId: player.id });
                        io.to(mapping.roomCode).emit('game:stateSync', sanitizeState(room));

                        if (room.phase === 'trivia_all') {
                            const eligibleCount = getEligiblePlayerIds(room).length;
                            const answeredCount = Object.keys(room._triviaAnswers || {}).length;
                            if (eligibleCount === 0 || answeredCount >= eligibleCount) {
                                resolveTriviaRound(room, mapping.roomCode, io);
                            }
                        }
                    }
                }
                socketToRoom.delete(socket.id);
            }
        });
    });

    httpServer.listen(port, hostname, () => {
        const localIP = getLocalIP();
        console.log('\n========================================');
        console.log('  🎮 CAIXA MISTERIOSA - GAME SERVER');
        console.log('========================================');
        console.log(`  Host:    http://${localIP}:${port}/host`);
        console.log(`  Players: http://${localIP}:${port}/play`);
        console.log(`  Local:   http://localhost:${port}`);
        console.log('========================================\n');
        global.__localIP = localIP;
        global.__port = port;
    });
});

// ===== GAME FLOW HELPERS =====

function submitTriviaAnswer(room, roomCode, io, playerId, answerIndex) {
    const player = room.players[playerId];
    if (!player || !player.isConnected) return { success: false, error: 'Jogador desconectado' };
    if (isPlayerFrozen(room, playerId)) return { success: false, error: 'Seu time esta congelado nesta rodada' };
    if (!room.timerEndAt) return { success: false, error: 'Rodada encerrada' };
    if (Date.now() > room.timerEndAt) return { success: false, error: 'Tempo esgotado' };

    const optionCount = Array.isArray(room.currentQuestion?.options) ? room.currentQuestion.options.length : 4;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= optionCount) {
        return { success: false, error: 'Alternativa invalida' };
    }

    if (room._triviaAnswers[playerId]) return { success: false, error: 'Ja respondeu' };

    const correct = answerIndex === room.currentQuestion.correctIndex;
    room._triviaAnswers[playerId] = {
        playerId,
        answerIndex,
        correct,
        timestamp: Date.now(),
    };

    const totalPlayers = getEligiblePlayerIds(room).length;
    io.to(roomCode).emit('trivia:playerAnswered', {
        playerId,
        playerName: room.players[playerId]?.name,
        totalAnswered: Object.keys(room._triviaAnswers).length,
        totalPlayers,
    });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));

    if (totalPlayers > 0 && Object.keys(room._triviaAnswers).length >= totalPlayers) {
        resolveTriviaRound(room, roomCode, io);
    }

    return { success: true, correct };
}

function submitDuelAnswer(room, roomCode, io, playerId, answerIndex) {
    if (room.triviaWinnerId && playerId !== room.triviaWinnerId) {
        return { success: false, error: 'Apenas o duelista pode responder' };
    }
    if (!room.timerEndAt) return { success: false, error: 'Duelo encerrado' };
    if (Date.now() > room.timerEndAt) return { success: false, error: 'Tempo esgotado' };

    const optionCount = Array.isArray(room.currentQuestion?.options) ? room.currentQuestion.options.length : 4;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= optionCount) {
        return { success: false, error: 'Alternativa invalida' };
    }

    clearBotTimers(room);
    const correct = answerIndex === room.currentQuestion.correctIndex;
    const player = room.players[playerId];
    const teamId = player?.teamId;

    if (correct && teamId && room.teams[teamId]) {
        room.teams[teamId].score += 200;
    }
    room.timerEndAt = null;

    io.to(roomCode).emit('duel:result', {
        playerId,
        correct,
        correctIndex: room.currentQuestion.correctIndex,
        points: correct ? 200 : 0,
    });

    setTimeout(() => {
        if (room.chances > 0) {
            room.phase = 'card_open';
            io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
        } else {
            backToTrivia(room, roomCode, io);
        }
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    }, 2500);

    return { success: true, correct };
}

function clearTriviaTimer(room) {
    if (room._triviaTimeout) {
        clearTimeout(room._triviaTimeout);
        room._triviaTimeout = null;
    }
}

function startTrivia(room, roomCode, io) {
    clearTriviaTimer(room);
    clearBotTimers(room);
    room.phase = 'trivia_all';
    room._triviaAnswers = {};
    const q = getNextQuestion(room);
    room.timerEndAt = Date.now() + (q.timeLimit * 1000);

    const eligiblePlayers = getEligiblePlayerIds(room);

    io.to(roomCode).emit('game:phaseChange', { phase: 'trivia_all' });
    io.to(roomCode).emit('trivia:question', {
        question: { ...q, correctIndex: -1 },
        timerEndAt: room.timerEndAt,
        eligiblePlayerIds: eligiblePlayers,
    });
    scheduleBotTriviaAnswers(room, roomCode, io, q);

    // Server-side timeout fallback so the round resolves even if host client is unavailable.
    const questionId = q.id;
    room._triviaTimeout = setTimeout(() => {
        if (room.phase !== 'trivia_all') return;
        if (!room.currentQuestion || room.currentQuestion.id !== questionId) return;
        resolveTriviaRound(room, roomCode, io);
    }, (q.timeLimit * 1000) + 500);

    if (eligiblePlayers.length === 0) {
        // Fallback: no one can answer this round (e.g. all frozen) -> resolve automatically.
        setTimeout(() => resolveTriviaRound(room, roomCode, io), 1000);
    }
}

function resolveTriviaRound(room, roomCode, io) {
    if (room.phase !== 'trivia_all') return;

    clearTriviaTimer(room);
    clearBotTimers(room);
    room.timerEndAt = null;
    const answers = Object.values(room._triviaAnswers);
    // Find fastest correct answer
    const correctAnswers = answers.filter(a => a.correct).sort((a, b) => a.timestamp - b.timestamp);

    let winnerId = null;
    let winnerName = '';

    if (correctAnswers.length > 0) {
        winnerId = correctAnswers[0].playerId;
        winnerName = room.players[winnerId]?.name || '???';
        const winnerTeamId = room.players[winnerId]?.teamId;
        room.attackerTeamId = winnerTeamId || null;
        if (winnerTeamId && room.teams[winnerTeamId]) {
            room.teams[winnerTeamId].score += 10;
        }
    } else {
        room.attackerTeamId = null;
    }

    room.triviaWinnerId = winnerId;

    io.to(roomCode).emit('trivia:result', {
        winnerId,
        winnerName,
        correctIndex: room.currentQuestion?.correctIndex,
        answers: answers.map(a => ({
            playerId: a.playerId,
            playerName: room.players[a.playerId]?.name,
            correct: a.correct,
            answerIndex: a.answerIndex,
        })),
    });

    if (winnerId) {
        // Winner picks a box (or if box already active, go to ranking)
        setTimeout(() => {
            if (room.selectedBoxId && !room.boxes.find(b => b.id === room.selectedBoxId)?.isOpen) {
                // Same box still active - go straight to ranking
                room.currentRanking = getRandomRanking();
                room.phase = 'ranking_challenge';
                io.to(roomCode).emit('game:phaseChange', { phase: 'ranking_challenge' });
                io.to(roomCode).emit('ranking:show', {
                    question: room.currentRanking.question,
                    items: room.currentRanking.items,
                });
            } else {
                room.phase = 'box_select';
                io.to(roomCode).emit('game:phaseChange', { phase: 'box_select' });
            }
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        }, 3000);
    } else {
        // Nobody got it right - new trivia question
        setTimeout(() => {
            startTrivia(room, roomCode, io);
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        }, 3000);
    }
}

function backToTrivia(room, roomCode, io) {
    // Same box persists! Just go back to trivia
    room.chances = 0;
    room.phase = 'trivia_all';
    room.round++;

    if (room.round > room.maxRounds) {
        room.phase = 'game_over';
        io.to(roomCode).emit('game:phaseChange', { phase: 'game_over' });
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        return;
    }

    startTrivia(room, roomCode, io);
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

function openBox(room, roomCode, io) {
    const box = room.boxes.find(b => b.id === room.selectedBoxId);
    if (!box) return;

    box.isOpen = true;
    box.openedByTeamId = room.players[room.triviaWinnerId]?.teamId || undefined;
    room.boxesOpened++;

    const teamId = box.openedByTeamId;
    if (teamId && room.teams[teamId]) {
        const team = room.teams[teamId];
        if (box.type === 'pegadinha') {
            const PENALTY = { comum: -50, raro: -100, lendario: -150 };
            const pen = PENALTY[box.rarity] || -50;
            if (team.shields > 0) {
                team.shields--;
                box._shielded = true;
                box.points = 0;
            } else {
                team.score = Math.max(0, team.score + pen);
                box.points = pen;
            }
        } else {
            const pts = box.points * (box.multiplier || 1);
            team.score += pts;
            box.points = pts;
        }
        team.inventory.push({
            boxId: box.id, prizeLabel: box.prizeLabel,
            points: box.points, rarity: box.rarity, shielded: !!box._shielded,
        });
    }

    room.phase = 'reveal';
    room.lastRevealedBoxId = box.id;
    room.selectedBoxId = null;
    room.cardGrid = [];
    room.lockedKeys = 0;
    room.timerEndAt = null;

    io.to(roomCode).emit('game:phaseChange', { phase: 'reveal' });
    io.to(roomCode).emit('box:reveal', { box });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

function goToNextRound(room, roomCode, io) {
    const closedBoxes = room.boxes.filter(b => !b.isOpen);
    if (closedBoxes.length === 0 || room.round >= room.maxRounds) {
        room.phase = 'game_over';
        io.to(roomCode).emit('game:phaseChange', { phase: 'game_over' });
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        return;
    }

    room.round++;
    room.lastRevealedBoxId = null;
    startTrivia(room, roomCode, io);
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

// ===== HELPERS =====

const TEAM_COLORS = ['#3713ec', '#ec1337', '#13ec6b', '#ec9c13', '#13c4ec', '#ec13d4', '#8b13ec', '#ecec13'];

function createTeam(name, colorIndex) {
    return {
        id: generateId(),
        name,
        color: TEAM_COLORS[colorIndex % TEAM_COLORS.length],
        playerIds: [],
        score: 0,
        inventory: [],
        wildcards: [],
        shields: 0,
        frozenUntilRound: null,
        stealUsed: false,
    };
}

function assignPlayerToTeam(room, playerId, teamId) {
    const player = room.players[playerId];
    if (!player || !room.teams[teamId]) return;

    if (player.teamId && room.teams[player.teamId]) {
        room.teams[player.teamId].playerIds = room.teams[player.teamId].playerIds.filter(id => id !== playerId);
    }

    player.teamId = teamId;
    if (!room.teams[teamId].playerIds.includes(playerId)) {
        room.teams[teamId].playerIds.push(playerId);
    }
}

function assignPlayerToSoloTeam(room, playerId) {
    const player = room.players[playerId];
    if (!player) return;
    const colorIndex = Object.keys(room.teams).length;
    const team = createTeam(player.name, colorIndex);
    room.teams[team.id] = team;
    assignPlayerToTeam(room, playerId, team.id);
}

function assignPlayerToBalancedTeam(room, playerId) {
    const teamIds = Object.keys(room.teams);
    if (teamIds.length === 0) {
        room.teams = {};
        const teamA = createTeam('Equipe A', 0);
        const teamB = createTeam('Equipe B', 1);
        room.teams[teamA.id] = teamA;
        room.teams[teamB.id] = teamB;
    }

    const teams = Object.values(room.teams);
    const target = [...teams].sort((a, b) => a.playerIds.length - b.playerIds.length)[0];
    assignPlayerToTeam(room, playerId, target.id);
}

function rebuildSoloTeams(room) {
    room.teams = {};
    Object.values(room.players).forEach((player) => {
        assignPlayerToSoloTeam(room, player.id);
    });
}

function rebuildTeamMode(room) {
    room.teams = {};
    const teamA = createTeam('Equipe A', 0);
    const teamB = createTeam('Equipe B', 1);
    room.teams[teamA.id] = teamA;
    room.teams[teamB.id] = teamB;

    const players = Object.values(room.players);
    players.forEach((player, index) => {
        const teamId = index % 2 === 0 ? teamA.id : teamB.id;
        assignPlayerToTeam(room, player.id, teamId);
    });
}

function isPlayerFrozen(room, playerId) {
    const teamId = room.players[playerId]?.teamId;
    if (!teamId || !room.teams[teamId]) return false;
    const frozenUntilRound = room.teams[teamId].frozenUntilRound;
    return frozenUntilRound !== null && frozenUntilRound >= room.round;
}

function getEligiblePlayerIds(room) {
    return Object.values(room.players)
        .filter(p => p.isConnected && !isPlayerFrozen(room, p.id))
        .map(p => p.id);
}

function createBotPlayer(room) {
    room._botCounter = Number(room._botCounter || 0) + 1;
    const takenNames = new Set(Object.values(room.players).map((p) => String(p.name || '').toLowerCase()));
    let botName = `Bot ${room._botCounter}`;
    while (takenNames.has(botName.toLowerCase())) {
        room._botCounter++;
        botName = `Bot ${room._botCounter}`;
    }
    const botId = `bot_${generateId()}`;
    return {
        id: botId,
        name: botName,
        teamId: null,
        socketId: `bot:${botId}`,
        isReady: true,
        isConnected: true,
        score: 0,
        device: 'BOT',
        isBot: true,
    };
}

function removePlayerFromRoom(room, playerId) {
    const player = room.players[playerId];
    if (!player) return;
    if (player.teamId && room.teams[player.teamId]) {
        const team = room.teams[player.teamId];
        team.playerIds = team.playerIds.filter((id) => id !== playerId);
        if (team.playerIds.length === 0) {
            delete room.teams[player.teamId];
        }
    }
    if (room._triviaAnswers && room._triviaAnswers[playerId]) {
        delete room._triviaAnswers[playerId];
    }
    delete room.players[playerId];
}

function clearBotTimers(room) {
    if (!room._botTimers) return;
    for (const timer of room._botTimers) {
        clearTimeout(timer);
    }
    room._botTimers.clear();
}

function scheduleBotTimer(room, fn, delayMs) {
    if (!room._botTimers) {
        room._botTimers = new Set();
    }
    let timer = null;
    timer = setTimeout(() => {
        if (room._botTimers) room._botTimers.delete(timer);
        fn();
    }, Math.max(50, Number(delayMs) || 50));
    room._botTimers.add(timer);
}

function pickBotAnswerIndex(question, accuracy) {
    const optionCount = Array.isArray(question?.options) ? question.options.length : 4;
    const safeOptionCount = Math.max(2, optionCount);
    const safeAccuracy = Math.max(0, Math.min(1, accuracy));
    const willBeCorrect = Math.random() < safeAccuracy;
    if (willBeCorrect) return question.correctIndex;

    const wrongIndexes = [];
    for (let i = 0; i < safeOptionCount; i++) {
        if (i !== question.correctIndex) wrongIndexes.push(i);
    }
    return wrongIndexes[Math.floor(Math.random() * wrongIndexes.length)];
}

function scheduleBotTriviaAnswers(room, roomCode, io, question) {
    const eligibleBotIds = getEligiblePlayerIds(room).filter((playerId) => room.players[playerId]?.isBot);
    const maxDelay = Math.max(1200, (question.timeLimit * 1000) - 900);

    for (const botId of eligibleBotIds) {
        const delay = Math.floor(Math.random() * (maxDelay - 400 + 1)) + 400;
        scheduleBotTimer(room, () => {
            if (room.phase !== 'trivia_all') return;
            if (!room.currentQuestion || room.currentQuestion.id !== question.id) return;
            if (!room.players[botId]?.isConnected) return;
            if (room._triviaAnswers?.[botId]) return;

            const variance = (Math.random() - 0.5) * 0.25;
            const answerIndex = pickBotAnswerIndex(question, BOT_TRIVIA_ACCURACY + variance);
            submitTriviaAnswer(room, roomCode, io, botId, answerIndex);
        }, delay);
    }
}

function scheduleBotDuelAnswer(room, roomCode, io, playerId, question) {
    if (!playerId || !room.players[playerId]?.isBot || !room.players[playerId]?.isConnected) return;

    const maxDelay = Math.max(900, (question.timeLimit * 1000) - 800);
    const delay = Math.floor(Math.random() * (maxDelay - 350 + 1)) + 350;
    scheduleBotTimer(room, () => {
        if (room.phase !== 'duel') return;
        if (room.triviaWinnerId !== playerId) return;
        if (!room.currentQuestion || room.currentQuestion.id !== question.id) return;
        if (!room.players[playerId]?.isConnected) return;

        const variance = (Math.random() - 0.5) * 0.2;
        const answerIndex = pickBotAnswerIndex(question, BOT_DUEL_ACCURACY + variance);
        submitDuelAnswer(room, roomCode, io, playerId, answerIndex);
    }, delay);
}

function generateRoomCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += c[Math.floor(Math.random() * c.length)];
    return code;
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== KEYWORD BANK =====
const KEYWORD_BANK = {
    tech: ['processador', 'tela', 'bateria', 'pixel', 'memória', 'código', 'algoritmo', 'servidor', 'nuvem', 'bluetooth', 'wifi', 'chip', 'app', 'dados', 'cache', 'firmware', 'debug', 'render', 'driver', 'kernel'],
    viagem: ['passaporte', 'mala', 'embarque', 'aeroporto', 'hotel', 'roteiro', 'destino', 'turismo', 'bilhete', 'voo', 'escala', 'alfândega', 'câmbio', 'itinerário', 'cruzeiro', 'mochila', 'check-in', 'resort', 'aventura'],
    meme: ['viral', 'trend', 'repost', 'emoji', 'sticker', 'filtro', 'hashtag', 'curtida', 'compartilhar', 'story', 'feed', 'reel', 'meme', 'gif', 'troll', 'reaction', 'follow', 'engajar'],
    experiencia: ['adrenalina', 'aventura', 'imersão', 'emoção', 'surpresa', 'radicais', 'mergulho', 'salto', 'escalar', 'explorar', 'acampar', 'trilha', 'rapel', 'surfar', 'voar', 'correr', 'navegar'],
    misterio: ['enigma', 'segredo', 'pista', 'código', 'chave', 'cifra', 'sombra', 'labirinto', 'detetive', 'mistério', 'oculto', 'escondido', 'revelação', 'investigação', 'suspeito'],
    pegadinha: ['trollagem', 'surpresa', 'armadilha', 'piada', 'susto', 'blefe', 'aposta', 'risco', 'perigo', 'engano', 'falsificação', 'rasteira', 'sabotagem', 'truque', 'cilada'],
};

const DECOY_BANK = [
    'abacaxi', 'dinossauro', 'terremoto', 'poltrona', 'esfinge', 'vulcão', 'saxofone', 'pergaminho',
    'besouro', 'pirâmide', 'relógio', 'telescópio', 'origami', 'cachoeira', 'cogumelo', 'fantasia',
    'dominó', 'caravela', 'beterraba', 'caleidoscópio', 'gárgula', 'sanfona', 'tridente', 'catapulta',
    'constelação', 'papiro', 'âncora', 'palhaço', 'xadrez', 'borboleta', 'diamante', 'trovão',
    'espada', 'ampulheta', 'lanterna', 'caverna', 'lagartixa', 'macarrão', 'girassol', 'foguete',
    'tornado', 'paraquedas', 'bússola', 'canguru', 'samurai', 'iceberg', 'violeta', 'camaleão',
];

function generateCardGrid(box) {
    const type = box.type || 'misterio';
    const kw = KEYWORD_BANK[type] || KEYWORD_BANK['misterio'];
    const keys = shuffleArray(kw).slice(0, 3);
    const availDecoys = DECOY_BANK.filter(d => !keys.includes(d));
    const decoys = shuffleArray(availDecoys).slice(0, 7); // 7 distractors

    // 3 keys + 7 distractors + 1 lost_turn + 1 duel = 12
    const cards = [
        ...keys.map(w => ({ word: w, type: 'key' })),
        ...decoys.map(w => ({ word: w, type: 'distractor' })),
        { word: 'PERDEU A VEZ!', type: 'lost_turn' },
        { word: 'DUELO!', type: 'duel' },
    ];

    return shuffleArray(cards).map((c, i) => ({
        id: i + 1, word: c.word, type: c.type, status: 'hidden',
    }));
}

function getPublicGrid(cardGrid) {
    return (cardGrid || []).map(c => ({
        id: c.id,
        status: c.status,
        word: c.status !== 'hidden' ? c.word : null,
        type: c.status !== 'hidden' ? c.type : null,
    }));
}

function getDefaultBoxes() {
    return [
        { id: 1, prizeLabel: 'Caixa Tech', points: 200, rarity: 'comum', risk: 'baixo', type: 'tech', icon: 'devices' },
        { id: 2, prizeLabel: 'Caixa Meme', points: 150, rarity: 'comum', risk: 'baixo', type: 'meme', icon: 'sentiment_very_satisfied' },
        { id: 3, prizeLabel: 'Caixa Viagem', points: 500, rarity: 'raro', risk: 'medio', type: 'viagem', icon: 'flight_takeoff' },
        { id: 4, prizeLabel: 'Caixa Mistério', points: 300, rarity: 'comum', risk: 'medio', type: 'misterio', icon: 'help_center' },
        { id: 5, prizeLabel: 'Caixa Experiência', points: 350, rarity: 'raro', risk: 'medio', type: 'experiencia', icon: 'local_activity' },
        { id: 6, prizeLabel: 'Caixa Pegadinha', points: -50, rarity: 'comum', risk: 'alto', type: 'pegadinha', icon: 'warning' },
        { id: 7, prizeLabel: 'Caixa Tech Pro', points: 400, rarity: 'raro', risk: 'medio', type: 'tech', icon: 'computer' },
        { id: 8, prizeLabel: 'Caixa Meme Gold', points: 250, rarity: 'comum', risk: 'baixo', type: 'meme', icon: 'emoji_events' },
        { id: 9, prizeLabel: 'Caixa Surpresa', points: 100, rarity: 'comum', risk: 'alto', type: 'misterio', icon: 'redeem' },
        { id: 10, prizeLabel: 'Caixa Aventura', points: 450, rarity: 'raro', risk: 'medio', type: 'experiencia', icon: 'explore' },
        { id: 11, prizeLabel: 'Caixa Lendária', points: 1000, rarity: 'lendario', risk: 'alto', type: 'experiencia', icon: 'auto_awesome' },
        { id: 12, prizeLabel: 'Caixa Viagem VIP', points: 800, rarity: 'lendario', risk: 'alto', type: 'viagem', icon: 'flight' },
        { id: 13, prizeLabel: 'A Caixa Final', points: 500, rarity: 'lendario', risk: 'alto', type: 'misterio', icon: 'diamond', multiplier: 2 },
    ];
}

function getFallbackQuestions() {
    return [
        { id: 'q1', text: 'Qual é o maior planeta do sistema solar?', options: ['Terra', 'Marte', 'Júpiter', 'Saturno'], correctIndex: 2, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q2', text: 'Em que ano o Brasil foi descoberto?', options: ['1492', '1500', '1510', '1498'], correctIndex: 1, category: 'História', difficulty: 'easy', timeLimit: 10 },
        { id: 'q3', text: 'Qual é a capital da Austrália?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correctIndex: 2, category: 'Geografia', difficulty: 'medium', timeLimit: 12 },
        { id: 'q4', text: 'Quantos ossos tem o corpo humano adulto?', options: ['186', '206', '216', '196'], correctIndex: 1, category: 'Ciência', difficulty: 'medium', timeLimit: 12 },
        { id: 'q5', text: "Qual é o elemento químico 'Au'?", options: ['Prata', 'Alumínio', 'Ouro', 'Argônio'], correctIndex: 2, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q6', text: 'Quem pintou a Mona Lisa?', options: ['Michelangelo', 'Da Vinci', 'Rafael', 'Donatello'], correctIndex: 1, category: 'Arte', difficulty: 'easy', timeLimit: 10 },
        { id: 'q7', text: 'Qual é o rio mais longo do mundo?', options: ['Amazonas', 'Nilo', 'Mississipi', 'Yangtze'], correctIndex: 0, category: 'Geografia', difficulty: 'medium', timeLimit: 12 },
        { id: 'q8', text: 'Quantas cordas tem um violão?', options: ['4', '5', '6', '7'], correctIndex: 2, category: 'Música', difficulty: 'easy', timeLimit: 10 },
        { id: 'q9', text: 'Qual país tem forma de bota?', options: ['Grécia', 'Portugal', 'Itália', 'Espanha'], correctIndex: 2, category: 'Geografia', difficulty: 'easy', timeLimit: 10 },
        { id: 'q10', text: 'Fórmula química da água?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correctIndex: 1, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q11', text: 'Ano da 1ª pisada na Lua?', options: ['1965', '1967', '1969', '1971'], correctIndex: 2, category: 'História', difficulty: 'easy', timeLimit: 10 },
        { id: 'q12', text: 'Criador do JavaScript?', options: ['Guido van Rossum', 'James Gosling', 'Brendan Eich', 'Bjarne Stroustrup'], correctIndex: 2, category: 'Tech', difficulty: 'medium', timeLimit: 12 },
    ];
}

function getNextQuestion(room) {
    if (!room._questionPool || room._questionPool.length === 0) {
        room._questionPool = shuffleArray([...getFallbackQuestions()]);
    }
    const q = room._questionPool.pop();
    room.currentQuestion = q;
    return q;
}

function createGameRoom(code, hostSocketId, settings = {}) {
    const boxCount = settings.boxCount || 13;
    return {
        roomCode: code, hostSocketId,
        mode: settings.mode || 'solo',
        phase: 'lobby',
        round: 0,
        maxRounds: settings.maxRounds || DEFAULT_MAX_ROUNDS,
        players: {}, teams: {},
        boxes: getDefaultBoxes().slice(0, boxCount).map(b => ({ ...b, isOpen: false })),
        boxCount,
        currentQuestion: null,
        currentRanking: null,
        triviaWinnerId: null,
        attackerTeamId: null,
        selectedBoxId: null,
        lastRevealedBoxId: null,
        cardGrid: [],
        lockedKeys: 0,
        chances: 0,
        maxChances: DEFAULT_MAX_CHANCES,
        currentWildcard: null,
        timerEndAt: null,
        boxesOpened: 0,
        _questionPool: [],
        _triviaAnswers: {},
        _triviaTimeout: null,
        _botTimers: new Set(),
        _botCounter: 0,
        _lastFrozenTeamId: null,
        _duelCardId: null,
    };
}

function sanitizeState(room) {
    const state = { ...room };
    delete state._questionPool;
    delete state._triviaAnswers;
    delete state._triviaTimeout;
    delete state._botTimers;
    delete state._botCounter;
    delete state._lastFrozenTeamId;
    delete state._duelCardId;
    if (state.currentQuestion) {
        state.currentQuestion = { ...state.currentQuestion, correctIndex: -1 };
    }
    if (state.currentRanking) {
        state.currentRanking = {
            question: state.currentRanking.question,
            items: state.currentRanking.items,
        };
    }
    state.cardGrid = getPublicGrid(room.cardGrid || []);
    state.answeredCount = Object.keys(room._triviaAnswers || {}).length;
    state.eligibleCount = getEligiblePlayerIds(room).length;
    return state;
}
