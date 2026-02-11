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
const DEFAULT_TRIVIA_WIN_POINTS = 10;
const DEFAULT_DUEL_WIN_POINTS = 120;
const DEFAULT_DUEL_SELECT_TIMEOUT_MS = 8000;
const DEFAULT_RANKING_TIMEOUT_MS = 25000;
const BOT_TRIVIA_ACCURACY = 0.62;
const BOT_DUEL_ACCURACY = 0.58;
const QUESTION_FETCH_AMOUNT = 120;
const FAST_MODE = process.env.GAMEBOX_TEST_FAST === '1';

const QUESTION_CATEGORY_OPTIONS = [
    'geral',
    'ciencia',
    'historia',
    'geografia',
    'arte',
    'musica',
    'tech',
    'esportes',
    'entretenimento',
];

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
async function fetchTryviaQuestions(amount = 30, categories = ['all']) {
    const shouldUseFallbackOnly = process.env.DISABLE_TRYVIA === '1';
    if (shouldUseFallbackOnly) {
        return buildQuestionCatalog({ questionCategories: categories }, getFallbackQuestions());
    }

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
            const mapped = filtered.map((q, i) => {
                const options = shuffleArray([q.correct_answer, ...q.incorrect_answers]);
                const mappedQuestion = {
                    id: `tryvia_${i}_${Date.now()}`,
                    text: decodeHTML(q.question),
                    options: options.map(o => decodeHTML(o)),
                    correctIndex: options.indexOf(q.correct_answer),
                    category: q.category || 'Geral',
                    difficulty: normalizeDifficulty(q.difficulty || 'medium'),
                    timeLimit: q.difficulty === 'hard' ? 15 : q.difficulty === 'easy' ? 10 : 12,
                };
                return normalizeQuestionPayload(mappedQuestion, 'tryvia');
            });

            const withCategories = mapped
                .filter(Boolean)
                .filter((question) => shouldIncludeQuestionByCategory(question, categories));
            if (withCategories.length > 0) {
                return withCategories;
            }
        }
    } catch (err) {
        console.error('[Tryvia] Falha:', err.message);
    }
    return buildQuestionCatalog({ questionCategories: categories }, getFallbackQuestions());
}

function decodeHTML(text) {
    if (!text) return '';
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&eacute;/g, 'é')
        .replace(/&atilde;/g, 'ã').replace(/&ccedil;/g, 'ç').replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
        .replace(/&otilde;/g, 'õ').replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô');
}

// ===== RANKING CHALLENGE BANKS =====
const ORDER_CHALLENGES = [
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

const TRUE_FALSE_CHALLENGES = [
    {
        question: 'Marque Verdadeiro ou Falso para cada afirmação:', statements: [
            { text: 'O Sol é uma estrela.', answer: true },
            { text: 'O ser humano tem 206 ossos.', answer: true },
            { text: 'A Grande Muralha da China é visível do espaço a olho nu.', answer: false },
            { text: 'A água ferve a 100°C ao nível do mar.', answer: true },
        ]
    },
    {
        question: 'Verdadeiro ou Falso — Fatos Curiosos:', statements: [
            { text: 'Os golfinhos dormem com um olho aberto.', answer: true },
            { text: 'Raios nunca caem duas vezes no mesmo lugar.', answer: false },
            { text: 'O coração de um camarão fica na cabeça.', answer: true },
            { text: 'O Everest é a montanha mais alta medida da base.', answer: false },
        ]
    },
    {
        question: 'Verdadeiro ou Falso — História & Ciência:', statements: [
            { text: 'Cleópatra viveu mais perto da construção da pizza do que das pirâmides.', answer: false },
            { text: 'A luz do Sol leva ~8 minutos para chegar à Terra.', answer: true },
            { text: 'Napoleão Bonaparte era baixo para a época dele.', answer: false },
            { text: 'O DNA humano é 99% idêntico ao de chimpanzés.', answer: true },
        ]
    },
    {
        question: 'Verdadeiro ou Falso — Tecnologia:', statements: [
            { text: 'O primeiro iPhone foi lançado em 2006.', answer: false },
            { text: 'Bitcoin foi criado em 2009.', answer: true },
            { text: 'A Nintendo foi fundada antes da Coca-Cola.', answer: true },
            { text: 'O primeiro computador pesava mais de 27 toneladas.', answer: true },
        ]
    },
    {
        question: 'Verdadeiro ou Falso — Natureza:', statements: [
            { text: 'Os polvos têm três corações.', answer: true },
            { text: 'Os elefantes são os únicos animais que não conseguem pular.', answer: false },
            { text: 'A banana é uma fruta e também uma baga.', answer: true },
            { text: 'Uma água-viva é composta por 95% de água.', answer: true },
        ]
    },
    {
        question: 'Verdadeiro ou Falso — Esportes:', statements: [
            { text: 'O Brasil é o país com mais títulos de Copa do Mundo.', answer: true },
            { text: 'O basquete foi inventado nos EUA.', answer: false },
            { text: 'Uma partida de tênis pode durar mais de 10 horas.', answer: true },
            { text: 'O golfe já foi jogado na Lua.', answer: true },
        ]
    },
];

const ESTIMATION_CHALLENGES = [
    { question: 'Quantos países existem no mundo?', answer: 195, tolerance: 10 },
    { question: 'Qual a altura da Torre Eiffel em metros?', answer: 330, tolerance: 30 },
    { question: 'Em que ano foi fundada a empresa Apple?', answer: 1976, tolerance: 3 },
    { question: 'Quantos ossos tem o corpo humano adulto?', answer: 206, tolerance: 15 },
    { question: 'Qual a velocidade da luz em km/s (arredondado)?', answer: 300000, tolerance: 20000 },
    { question: 'Quantos litros de sangue o corpo humano tem (em média)?', answer: 5, tolerance: 1 },
    { question: 'Em que ano caiu o Muro de Berlim?', answer: 1989, tolerance: 2 },
    { question: 'Qual a distância da Terra à Lua em km (arredondado)?', answer: 384400, tolerance: 30000 },
    { question: 'Quantas teclas tem um piano padrão?', answer: 88, tolerance: 5 },
    { question: 'Qual o QI médio de um ser humano?', answer: 100, tolerance: 8 },
    { question: 'Quantos estados tem o Brasil?', answer: 26, tolerance: 2 },
    { question: 'Em que ano o homem pisou na Lua pela primeira vez?', answer: 1969, tolerance: 2 },
];

function getRandomRanking() {
    const types = ['order', 'true_false', 'estimation'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'true_false') {
        const challenge = TRUE_FALSE_CHALLENGES[Math.floor(Math.random() * TRUE_FALSE_CHALLENGES.length)];
        return { type: 'true_false', question: challenge.question, statements: challenge.statements };
    }
    if (type === 'estimation') {
        const challenge = ESTIMATION_CHALLENGES[Math.floor(Math.random() * ESTIMATION_CHALLENGES.length)];
        return { type: 'estimation', question: challenge.question, answer: challenge.answer, tolerance: challenge.tolerance };
    }
    // default: order
    const challenge = ORDER_CHALLENGES[Math.floor(Math.random() * ORDER_CHALLENGES.length)];
    return { type: 'order', question: challenge.question, items: challenge.items, correctOrder: challenge.correctOrder };
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
            if (Array.isArray(data.settings.questionCategories)) {
                room.questionCategories = sanitizeQuestionCategories(data.settings.questionCategories);
            }
            if (data.settings.scoring && typeof data.settings.scoring === 'object') {
                if (Number.isFinite(data.settings.scoring.triviaWinPoints)) {
                    room.scoring.triviaWinPoints = Math.max(1, Math.min(100, Number(data.settings.scoring.triviaWinPoints)));
                }
                if (Number.isFinite(data.settings.scoring.duelWinPoints)) {
                    room.scoring.duelWinPoints = Math.max(20, Math.min(300, Number(data.settings.scoring.duelWinPoints)));
                }
            }
            if (typeof data.settings.autoBalanceScoring === 'boolean') {
                room.autoBalanceScoring = data.settings.autoBalanceScoring;
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
            const fetchedQuestions = await fetchTryviaQuestions(QUESTION_FETCH_AMOUNT, room.questionCategories);
            const fallbackQuestions = buildQuestionCatalog(room, getFallbackQuestions());
            room._questionCatalog = buildQuestionCatalog(room, [...fetchedQuestions, ...fallbackQuestions]);
            if (room._questionCatalog.length === 0) {
                room._questionCatalog = buildQuestionCatalog({ questionCategories: ['all'] }, getFallbackQuestions());
            }
            room._questionPool = shuffleArray([...room._questionCatalog]);
            room._usedQuestionSignatures = new Set();
            room.metrics = createEmptyMetrics();
            console.log(`[Game] ${room._questionCatalog.length} perguntas preparadas`);

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

            io.to(roomCode).emit('box:selected', { boxId: box.id, box });
            startRankingChallenge(room, roomCode, io);
            callback?.({ success: true });
        });

        // ===== RANKING CHALLENGE (host submits answer) =====
        socket.on('ranking:submit', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room || room.phase !== 'ranking_challenge' || !room.currentRanking || !isHost(room)) return callback?.({ success: false });
            const result = resolveRankingChallenge(room, roomCode, io, data.answer ?? data.order, 'host_submit');
            callback?.(result);
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
                recordCardTelemetry(room, card, 0);
                room.lockedKeys++;
                card.status = 'locked';
                // Key doesn't consume a chance!
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'key',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });

                // 3 keys found? Open the box!
                if (room.lockedKeys >= 3) {
                    setTimeout(() => openBox(room, roomCode, io), applyGameSpeed(1500));
                    io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
                    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
                    return callback?.({ success: true });
                }

            } else if (card.type === 'lost_turn') {
                const lostImpact = Math.max(1, Number(room.chances || 0));
                recordCardTelemetry(room, card, lostImpact);
                room.chances = 0; // All chances gone!
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'lost_turn',
                    lockedKeys: room.lockedKeys, chances: 0,
                });
                // Turn ends -> back to trivia with same active box
                setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(2500));

            } else if (card.type === 'duel') {
                recordCardTelemetry(room, card, 0);
                room.chances--; // Costs 1 chance
                room._duelCardId = card.id;
                room.phase = 'duel';
                room.duelOpponentId = null;
                room.duelSelectEndAt = Date.now() + applyGameSpeed(DEFAULT_DUEL_SELECT_TIMEOUT_MS);
                room.currentQuestion = null;
                room.timerEndAt = null;
                room._duelAnswers = {};
                clearDuelTimer(room);
                clearDuelSelectTimer(room);
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'duel',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });
                io.to(roomCode).emit('game:phaseChange', { phase: 'duel' });

                room._duelSelectTimeout = setTimeout(() => {
                    if (room.phase !== 'duel') return;
                    if (room.duelOpponentId) return;
                    const opponentId = pickRandomDuelOpponent(room, room.triviaWinnerId);
                    if (!opponentId) {
                        resetDuelState(room);
                        if (room.chances > 0) {
                            room.phase = 'card_open';
                            io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
                            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
                        } else {
                            backToTrivia(room, roomCode, io);
                        }
                        return;
                    }
                    selectDuelOpponent(room, roomCode, io, room.triviaWinnerId, opponentId, { source: 'timeout', allowSameTeam: true });
                }, applyGameSpeed(DEFAULT_DUEL_SELECT_TIMEOUT_MS));

                // If the duel chooser is a bot, pick an opponent automatically.
                if (room.triviaWinnerId && room.players[room.triviaWinnerId]?.isBot) {
                    const opponentId = pickRandomDuelOpponent(room, room.triviaWinnerId);
                    if (opponentId) {
                        scheduleBotTimer(room, () => {
                            if (room.phase !== 'duel') return;
                            if (room.duelOpponentId) return;
                            selectDuelOpponent(room, roomCode, io, room.triviaWinnerId, opponentId, { source: 'bot', allowSameTeam: true });
                        }, 650);
                    }
                }

            } else {
                recordCardTelemetry(room, card, 1);
                // Distractor - lose 1 chance
                room.chances--;
                io.to(roomCode).emit('card:opened', {
                    cardId: card.id, word: card.word, type: 'distractor',
                    lockedKeys: room.lockedKeys, chances: room.chances,
                });

                if (room.chances <= 0) {
                    setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(2000));
                }
            }

            io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            callback?.({ success: true });
        });

        // ===== DUEL ANSWER =====
        socket.on('duel:selectOpponent', (data, callback) => {
            const roomCode = normalizeCode(data.roomCode);
            const room = rooms.get(roomCode);
            if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
            if (room.phase !== 'duel') return callback?.({ success: false, error: 'Duelo nao esta ativo' });
            if (!ensurePlayerSocketBinding(room, roomCode, data.playerId)) {
                return callback?.({ success: false, error: 'Jogador invalido' });
            }
            const result = selectDuelOpponent(room, roomCode, io, data.playerId, data.opponentId);
            callback?.(result);
        });

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
                resetDuelState(room);
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
                        } else if (room.phase === 'duel') {
                            if (room.triviaWinnerId === player.id && !room.duelOpponentId) {
                                const fallbackOpponentId = pickRandomDuelOpponent(room, player.id);
                                if (fallbackOpponentId) {
                                    scheduleBotTimer(room, () => {
                                        if (room.phase !== 'duel' || room.duelOpponentId) return;
                                        selectDuelOpponent(room, mapping.roomCode, io, player.id, fallbackOpponentId, { source: 'disconnect', allowSameTeam: true });
                                    }, 600);
                                }
                            }

                            const connectedParticipants = getDuelParticipantIds(room)
                                .filter((participantId) => room.players[participantId]?.isConnected);
                            const answeredCount = Object.keys(room._duelAnswers || {}).length;
                            if (room.currentQuestion && connectedParticipants.length > 0 && answeredCount >= connectedParticipants.length) {
                                resolveDuelRound(room, mapping.roomCode, io, null, { reason: 'disconnect' });
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
    room.metrics.totalTriviaAnswers++;
    if (correct) room.metrics.totalTriviaCorrectAnswers++;
    room.metrics.triviaAccuracyRate = room.metrics.totalTriviaCorrectAnswers / Math.max(1, room.metrics.totalTriviaAnswers);

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

function applyGameSpeed(ms) {
    if (!FAST_MODE) return ms;
    return Math.max(400, Math.floor(ms * 0.25));
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeQuestionCategory(category) {
    const raw = normalizeText(category);
    if (!raw) return 'geral';
    if (raw.includes('science') || raw.includes('ciencia') || raw.includes('natureza')) return 'ciencia';
    if (raw.includes('history') || raw.includes('historia')) return 'historia';
    if (raw.includes('geography') || raw.includes('geografia')) return 'geografia';
    if (raw.includes('art') || raw.includes('arte')) return 'arte';
    if (raw.includes('music') || raw.includes('musica')) return 'musica';
    if (raw.includes('technology') || raw.includes('tech') || raw.includes('computer')) return 'tech';
    if (raw.includes('sport') || raw.includes('esporte') || raw.includes('football') || raw.includes('soccer')) return 'esportes';
    if (raw.includes('film') || raw.includes('movie') || raw.includes('tv') || raw.includes('entertainment') || raw.includes('celebr')) {
        return 'entretenimento';
    }
    return 'geral';
}

function sanitizeQuestionCategories(categories) {
    if (!Array.isArray(categories) || categories.length === 0) return ['all'];
    const normalized = [...new Set(
        categories
            .map((value) => normalizeText(value))
            .filter((value) => value === 'all' || QUESTION_CATEGORY_OPTIONS.includes(value))
    )];
    if (normalized.length === 0) return ['all'];
    if (normalized.includes('all')) return ['all'];
    return normalized;
}

function shouldIncludeQuestionByCategory(question, selectedCategories) {
    const categories = sanitizeQuestionCategories(selectedCategories);
    if (categories.includes('all')) return true;
    const questionCategory = normalizeQuestionCategory(question?.category);
    return categories.includes(questionCategory);
}

function normalizeDifficulty(value) {
    const raw = normalizeText(value);
    if (raw.startsWith('hard') || raw === 'dificil') return 'hard';
    if (raw.startsWith('easy') || raw === 'facil') return 'easy';
    return 'medium';
}

function getTargetDifficultyForRound(round) {
    if (round <= 4) return 'easy';
    if (round <= 10) return 'medium';
    return 'hard';
}

function getDifficultyPreferenceOrder(targetDifficulty) {
    if (targetDifficulty === 'easy') return ['easy', 'medium', 'hard'];
    if (targetDifficulty === 'hard') return ['hard', 'medium', 'easy'];
    return ['medium', 'hard', 'easy'];
}

function questionSignature(question) {
    const text = normalizeText(question?.text);
    const options = Array.isArray(question?.options)
        ? question.options.map((option) => normalizeText(option)).join('|')
        : '';
    return `${text}::${options}`;
}

function normalizeQuestionPayload(question, sourceTag = 'fallback') {
    if (!question || !Array.isArray(question.options) || question.options.length < 2) return null;
    const correctIndex = Number(question.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= question.options.length) return null;

    const difficulty = normalizeDifficulty(question.difficulty);
    const baseTimeLimit = Number(question.timeLimit)
        || (difficulty === 'hard' ? 15 : difficulty === 'easy' ? 10 : 12);
    const timeLimit = FAST_MODE ? Math.max(4, Math.min(baseTimeLimit, 7)) : baseTimeLimit;

    const normalized = {
        id: String(question.id || `${sourceTag}_${generateId()}`),
        text: String(question.text || '').trim(),
        options: question.options.map((option) => String(option)),
        correctIndex,
        category: String(question.category || 'Geral'),
        difficulty,
        timeLimit,
    };
    normalized.signature = questionSignature(normalized);
    return normalized;
}

function buildQuestionCatalog(room, questions) {
    const selectedCategories = room.questionCategories || ['all'];
    const seen = new Set();
    const catalog = [];

    for (const question of questions || []) {
        if (!shouldIncludeQuestionByCategory(question, selectedCategories)) continue;
        const normalized = normalizeQuestionPayload(question, 'catalog');
        if (!normalized || !normalized.signature) continue;
        if (seen.has(normalized.signature)) continue;
        seen.add(normalized.signature);
        catalog.push(normalized);
    }
    return catalog;
}

function createEmptyMetrics() {
    return {
        startedAt: Date.now(),
        triviaRoundsResolved: 0,
        duelRoundsResolved: 0,
        totalRoundDurationMs: 0,
        avgRoundDurationMs: 0,
        totalTriviaAnswers: 0,
        totalTriviaCorrectAnswers: 0,
        triviaAccuracyRate: 0,
        totalTriviaPointsAwarded: 0,
        totalDuelPointsAwarded: 0,
        cardTypeCount: { key: 0, distractor: 0, lost_turn: 0, duel: 0 },
        cardWordImpact: {},
        duelStats: {
            total: 0,
            wins: 0,
            noWinner: 0,
            chooserTimeouts: 0,
            resolvedByTimeout: 0,
            recentOutcomes: [],
        },
        teamStats: {},
        scoringAdjustments: [],
    };
}

function ensureTeamMetric(room, teamId) {
    if (!teamId) return null;
    if (!room.metrics.teamStats[teamId]) {
        room.metrics.teamStats[teamId] = {
            triviaWins: 0,
            duelWins: 0,
            totalWins: 0,
            winRate: 0,
        };
    }
    return room.metrics.teamStats[teamId];
}

function refreshTeamWinRates(room) {
    const totalResolvedContests = Math.max(1, room.metrics.triviaRoundsResolved + room.metrics.duelRoundsResolved);
    for (const [teamId, teamMetric] of Object.entries(room.metrics.teamStats)) {
        const safeMetric = teamMetric || {};
        safeMetric.totalWins = Number(safeMetric.triviaWins || 0) + Number(safeMetric.duelWins || 0);
        safeMetric.winRate = safeMetric.totalWins / totalResolvedContests;
        room.metrics.teamStats[teamId] = safeMetric;
    }
}

function getDeadliestCards(room, topN = 5) {
    const entries = Object.entries(room.metrics.cardWordImpact || {})
        .map(([word, impact]) => ({ word, impact: Number(impact) || 0 }))
        .filter((entry) => entry.impact > 0)
        .sort((a, b) => b.impact - a.impact);
    return entries.slice(0, topN);
}

function buildPublicMetrics(room) {
    const metrics = room.metrics || createEmptyMetrics();
    const teamWinRates = {};
    for (const [teamId, team] of Object.entries(room.teams || {})) {
        const teamMetric = metrics.teamStats?.[teamId] || {};
        teamWinRates[teamId] = {
            triviaWins: Number(teamMetric?.triviaWins || 0),
            duelWins: Number(teamMetric?.duelWins || 0),
            totalWins: Number(teamMetric?.totalWins || 0),
            winRate: Number(teamMetric?.winRate || 0),
            teamName: team?.name || 'Time',
        };
    }

    return {
        startedAt: metrics.startedAt,
        triviaRoundsResolved: Number(metrics.triviaRoundsResolved || 0),
        duelRoundsResolved: Number(metrics.duelRoundsResolved || 0),
        avgRoundDurationMs: Math.round(Number(metrics.avgRoundDurationMs || 0)),
        triviaAccuracyRate: Number(metrics.triviaAccuracyRate || 0),
        totalTriviaPointsAwarded: Number(metrics.totalTriviaPointsAwarded || 0),
        totalDuelPointsAwarded: Number(metrics.totalDuelPointsAwarded || 0),
        cardTypeCount: metrics.cardTypeCount || {},
        deadliestCards: getDeadliestCards(room),
        teamWinRates,
        duelStats: {
            total: Number(metrics.duelStats?.total || 0),
            wins: Number(metrics.duelStats?.wins || 0),
            noWinner: Number(metrics.duelStats?.noWinner || 0),
            chooserTimeouts: Number(metrics.duelStats?.chooserTimeouts || 0),
            resolvedByTimeout: Number(metrics.duelStats?.resolvedByTimeout || 0),
        },
        scoringAdjustments: Array.isArray(metrics.scoringAdjustments)
            ? metrics.scoringAdjustments.slice(-8)
            : [],
    };
}

function maybeAutoTuneDuelPoints(room) {
    if (!room.autoBalanceScoring) return;
    const duelStats = room.metrics.duelStats || {};
    const totalDuels = Number(duelStats.total || 0);
    if (totalDuels < 3) return;

    const wins = Number(duelStats.wins || 0);
    const duelWinRate = wins / Math.max(1, totalDuels);
    const duelToTriviaPointsRatio = room.metrics.totalDuelPointsAwarded / Math.max(1, room.metrics.totalTriviaPointsAwarded);
    const current = Number(room.scoring.duelWinPoints || DEFAULT_DUEL_WIN_POINTS);
    let next = current;
    let reason = '';

    if (duelToTriviaPointsRatio > 3.5 && current > 80) {
        next = current - 10;
        reason = 'duel_points_down_ratio';
    } else if (duelWinRate < 0.2 && current < 220) {
        next = current + 10;
        reason = 'duel_points_up_low_winrate';
    } else if (duelWinRate > 0.75 && current > 80) {
        next = current - 10;
        reason = 'duel_points_down_high_winrate';
    }

    if (next !== current) {
        room.scoring.duelWinPoints = next;
        room.metrics.scoringAdjustments.push({
            at: Date.now(),
            previous: current,
            next,
            reason,
        });
        if (room.metrics.scoringAdjustments.length > 12) {
            room.metrics.scoringAdjustments = room.metrics.scoringAdjustments.slice(-12);
        }
    }
}

function recordCardTelemetry(room, card, impact = 0) {
    if (!room?.metrics || !card) return;
    const type = String(card.type || 'unknown');
    if (!room.metrics.cardTypeCount[type]) room.metrics.cardTypeCount[type] = 0;
    room.metrics.cardTypeCount[type]++;

    const safeImpact = Math.max(0, Number(impact) || 0);
    if (safeImpact <= 0) return;

    const wordKey = String(card.word || type).toUpperCase();
    room.metrics.cardWordImpact[wordKey] = (room.metrics.cardWordImpact[wordKey] || 0) + safeImpact;
}

function submitDuelAnswer(room, roomCode, io, playerId, answerIndex) {
    if (!isDuelParticipant(room, playerId)) {
        return { success: false, error: 'Apenas os duelistas podem responder' };
    }
    if (!room.duelOpponentId) return { success: false, error: 'Oponente ainda nao foi escolhido' };
    if (!room.timerEndAt) return { success: false, error: 'Duelo encerrado' };
    if (Date.now() > room.timerEndAt) return { success: false, error: 'Tempo esgotado' };

    const optionCount = Array.isArray(room.currentQuestion?.options) ? room.currentQuestion.options.length : 4;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= optionCount) {
        return { success: false, error: 'Alternativa invalida' };
    }
    if (room._duelAnswers?.[playerId]) return { success: false, error: 'Ja respondeu' };

    const correct = answerIndex === room.currentQuestion.correctIndex;
    room._duelAnswers[playerId] = {
        playerId,
        answerIndex,
        correct,
        timestamp: Date.now(),
    };

    if (correct) {
        resolveDuelRound(room, roomCode, io, playerId, { reason: 'correct_answer' });
    } else {
        const participants = getDuelParticipantIds(room);
        const answeredCount = Object.keys(room._duelAnswers || {}).length;
        if (participants.length > 0 && answeredCount >= participants.length) {
            resolveDuelRound(room, roomCode, io, null, { reason: 'all_answered' });
        }
    }

    return { success: true, correct };
}

function selectDuelOpponent(room, roomCode, io, chooserId, opponentId, options = {}) {
    if (!room.triviaWinnerId || chooserId !== room.triviaWinnerId) {
        return { success: false, error: 'Apenas o jogador da vez pode escolher oponente' };
    }
    if (room.duelOpponentId) {
        return { success: false, error: 'Oponente ja foi escolhido' };
    }
    if (!opponentId || opponentId === chooserId) {
        return { success: false, error: 'Escolha um jogador valido' };
    }

    const chooser = room.players[chooserId];
    const opponent = room.players[opponentId];
    if (!chooser || !opponent || !opponent.isConnected) {
        return { success: false, error: 'Oponente indisponivel' };
    }

    if (!options?.allowSameTeam && chooser.teamId && opponent.teamId && chooser.teamId === opponent.teamId) {
        return { success: false, error: 'Escolha um jogador de outro time' };
    }

    clearDuelSelectTimer(room);
    room.duelOpponentId = opponentId;
    room.duelSelectEndAt = null;

    if (options?.source === 'timeout') {
        room.metrics.duelStats.chooserTimeouts = Number(room.metrics.duelStats.chooserTimeouts || 0) + 1;
    }

    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    startDuelQuestion(room, roomCode, io);

    return { success: true };
}

function startDuelQuestion(room, roomCode, io) {
    if (room.phase !== 'duel') return;

    const participants = getDuelParticipantIds(room);
    if (participants.length < 2) return;

    clearBotTimers(room);
    clearDuelTimer(room);
    room._duelAnswers = {};

    const duelQ = getNextQuestion(room);
    room.timerEndAt = Date.now() + (duelQ.timeLimit * 1000);

    io.to(roomCode).emit('duel:start', {
        question: { ...duelQ, correctIndex: -1 },
        currentPlayerId: room.triviaWinnerId,
        opponentPlayerId: room.duelOpponentId,
        playerIds: participants,
        timerEndAt: room.timerEndAt,
    });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));

    for (const participantId of participants) {
        scheduleBotDuelAnswer(room, roomCode, io, participantId, duelQ);
    }

    const questionId = duelQ.id;
    room._duelTimeout = setTimeout(() => {
        if (room.phase !== 'duel') return;
        if (!room.currentQuestion || room.currentQuestion.id !== questionId) return;
        resolveDuelRound(room, roomCode, io, null, { reason: 'timeout' });
    }, (duelQ.timeLimit * 1000) + 500);
}

function resolveDuelRound(room, roomCode, io, winnerId = null, metadata = {}) {
    if (room.phase !== 'duel') return;

    clearBotTimers(room);
    clearDuelTimer(room);
    clearDuelSelectTimer(room);
    room.timerEndAt = null;
    room.duelSelectEndAt = null;

    const answers = Object.values(room._duelAnswers || {});
    const participants = getDuelParticipantIds(room);
    let resolvedWinnerId = winnerId;

    if (!resolvedWinnerId) {
        const correctAnswers = answers.filter((a) => a.correct).sort((a, b) => a.timestamp - b.timestamp);
        resolvedWinnerId = correctAnswers.length > 0 ? correctAnswers[0].playerId : null;
    }

    room.metrics.duelStats.total++;
    room.metrics.duelRoundsResolved++;
    if (metadata?.reason === 'timeout') {
        room.metrics.duelStats.resolvedByTimeout++;
    }

    const pointChanges = {};
    let points = 0;
    if (resolvedWinnerId) {
        room.metrics.duelStats.wins++;
        const winnerTeamId = room.players[resolvedWinnerId]?.teamId;
        const duelPoints = Number(room.scoring?.duelWinPoints || DEFAULT_DUEL_WIN_POINTS);
        if (winnerTeamId && room.teams[winnerTeamId]) {
            room.teams[winnerTeamId].score += duelPoints;
            points = duelPoints;
            room.metrics.totalDuelPointsAwarded += duelPoints;
            const teamMetric = ensureTeamMetric(room, winnerTeamId);
            if (teamMetric) {
                teamMetric.duelWins++;
            }
        }
    } else {
        room.metrics.duelStats.noWinner++;
    }

    for (const participantId of participants) {
        pointChanges[participantId] = participantId === resolvedWinnerId ? points : 0;
    }
    refreshTeamWinRates(room);

    room.metrics.duelStats.recentOutcomes.push(!!resolvedWinnerId ? 'win' : 'nowin');
    if (room.metrics.duelStats.recentOutcomes.length > 8) {
        room.metrics.duelStats.recentOutcomes = room.metrics.duelStats.recentOutcomes.slice(-8);
    }
    maybeAutoTuneDuelPoints(room);

    io.to(roomCode).emit('duel:result', {
        playerId: resolvedWinnerId,
        winnerId: resolvedWinnerId,
        winnerName: resolvedWinnerId ? room.players[resolvedWinnerId]?.name || '???' : '',
        correct: !!resolvedWinnerId,
        correctIndex: room.currentQuestion?.correctIndex ?? -1,
        points,
        pointChanges,
        resolvedReason: metadata?.reason || 'resolved',
        question: room.currentQuestion
            ? { text: room.currentQuestion.text, options: room.currentQuestion.options }
            : null,
        answers: answers.map((answer) => ({
            playerId: answer.playerId,
            playerName: room.players[answer.playerId]?.name,
            answerIndex: answer.answerIndex,
            correct: answer.correct,
        })),
    });

    setTimeout(() => {
        resetDuelState(room);
        if (room.chances > 0) {
            room.phase = 'card_open';
            io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        } else {
            backToTrivia(room, roomCode, io);
        }
    }, applyGameSpeed(2500));
}

function clearTriviaTimer(room) {
    if (room._triviaTimeout) {
        clearTimeout(room._triviaTimeout);
        room._triviaTimeout = null;
    }
}

function clearRankingTimer(room) {
    if (room._rankingTimeout) {
        clearTimeout(room._rankingTimeout);
        room._rankingTimeout = null;
    }
}

function clearDuelTimer(room) {
    if (room._duelTimeout) {
        clearTimeout(room._duelTimeout);
        room._duelTimeout = null;
    }
}

function clearDuelSelectTimer(room) {
    if (room._duelSelectTimeout) {
        clearTimeout(room._duelSelectTimeout);
        room._duelSelectTimeout = null;
    }
}

function resetDuelState(room) {
    clearDuelTimer(room);
    clearDuelSelectTimer(room);
    room.currentQuestion = null;
    room.timerEndAt = null;
    room.duelOpponentId = null;
    room.duelSelectEndAt = null;
    room._duelAnswers = {};
}

function getDuelParticipantIds(room) {
    const participantIds = [];
    if (room.triviaWinnerId && room.players[room.triviaWinnerId]?.isConnected) {
        participantIds.push(room.triviaWinnerId);
    }
    if (
        room.duelOpponentId &&
        room.duelOpponentId !== room.triviaWinnerId &&
        room.players[room.duelOpponentId]?.isConnected
    ) {
        participantIds.push(room.duelOpponentId);
    }
    return participantIds;
}

function isDuelParticipant(room, playerId) {
    return getDuelParticipantIds(room).includes(playerId);
}

function pickRandomDuelOpponent(room, chooserId) {
    const chooser = room.players[chooserId];
    if (!chooser) return null;

    const connectedOthers = Object.values(room.players).filter((player) => {
        return player.id !== chooserId && player.isConnected;
    });
    if (connectedOthers.length === 0) return null;

    const differentTeamCandidates = connectedOthers.filter((player) => {
        if (!chooser.teamId || !player.teamId) return true;
        return player.teamId !== chooser.teamId;
    });
    const pool = differentTeamCandidates.length > 0 ? differentTeamCandidates : connectedOthers;
    return pool[Math.floor(Math.random() * pool.length)]?.id || null;
}

function getAutoRankingOrder(room) {
    const itemCount = Array.isArray(room.currentRanking?.items) ? room.currentRanking.items.length : 0;
    const baseOrder = Array.from({ length: itemCount }, (_, idx) => idx);
    const winnerId = room.triviaWinnerId;
    const winnerIsBot = winnerId ? !!room.players[winnerId]?.isBot : false;

    if (winnerIsBot && room.currentRanking?.correctOrder) {
        const shouldBeGood = Math.random() < 0.65;
        if (shouldBeGood) {
            const correctOrder = [...room.currentRanking.correctOrder];
            if (Math.random() < 0.35 && correctOrder.length >= 2) {
                const a = Math.floor(Math.random() * correctOrder.length);
                const b = Math.floor(Math.random() * correctOrder.length);
                [correctOrder[a], correctOrder[b]] = [correctOrder[b], correctOrder[a]];
            }
            return correctOrder;
        }
    }
    return shuffleArray(baseOrder);
}

function resolveRankingChallenge(room, roomCode, io, data, source = 'host_submit') {
    if (room.phase !== 'ranking_challenge' || !room.currentRanking) {
        return { success: false, error: 'Ranking nao esta ativo' };
    }

    clearRankingTimer(room);
    room.timerEndAt = null;

    const currentRanking = room.currentRanking;
    const challengeType = currentRanking.type || 'order';
    let correctCount = 0;
    let resultPayload = {};

    if (challengeType === 'order') {
        const normalizedOrder = Array.isArray(data) ? data.map((value) => Number(value)) : [];
        const itemCount = currentRanking.correctOrder.length;
        const safeOrder = normalizedOrder.length === itemCount
            ? normalizedOrder
            : getAutoRankingOrder(room);
        correctCount = scoreRanking(safeOrder, currentRanking.correctOrder);
        resultPayload = {
            type: 'order',
            correctOrder: currentRanking.correctOrder,
        };
    } else if (challengeType === 'true_false') {
        const answers = Array.isArray(data) ? data : [];
        const statements = currentRanking.statements || [];
        correctCount = 0;
        for (let i = 0; i < statements.length; i++) {
            if (answers[i] === statements[i].answer) correctCount++;
        }
        resultPayload = {
            type: 'true_false',
            correctAnswers: statements.map(s => s.answer),
        };
    } else if (challengeType === 'estimation') {
        const guess = typeof data === 'number' ? data : Number(data) || 0;
        const answer = currentRanking.answer;
        const tolerance = currentRanking.tolerance || 10;
        const diff = Math.abs(guess - answer);
        const accuracy = Math.max(0, 1 - diff / (tolerance * 3));
        correctCount = accuracy >= 0.9 ? 4 : accuracy >= 0.5 ? 3 : accuracy >= 0.2 ? 2 : 1;
        resultPayload = {
            type: 'estimation',
            correctAnswer: answer,
            playerGuess: guess,
            accuracy: Math.round(accuracy * 100),
        };
    }

    const chances = correctCount >= 4 ? room.maxChances : Math.max(1, room.maxChances - 1);

    room.chances = chances;
    room.phase = 'card_open';
    room.currentRanking = null;

    io.to(roomCode).emit('ranking:result', {
        correctCount,
        chances,
        source,
        ...resultPayload,
    });

    setTimeout(() => {
        io.to(roomCode).emit('game:phaseChange', { phase: 'card_open' });
        io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    }, applyGameSpeed(2000));

    return { success: true, correctCount, chances };
}

function startRankingChallenge(room, roomCode, io) {
    clearRankingTimer(room);
    room.currentRanking = getRandomRanking();
    room.phase = 'ranking_challenge';
    room.timerEndAt = Date.now() + applyGameSpeed(DEFAULT_RANKING_TIMEOUT_MS);

    const rankingPayload = {
        type: room.currentRanking.type || 'order',
        question: room.currentRanking.question,
        timerEndAt: room.timerEndAt,
    };
    // Add type-specific data
    if (room.currentRanking.type === 'order') {
        rankingPayload.items = room.currentRanking.items;
    } else if (room.currentRanking.type === 'true_false') {
        rankingPayload.statements = room.currentRanking.statements.map(s => ({ text: s.text }));
    } else if (room.currentRanking.type === 'estimation') {
        // Don't send the answer to the client!
        rankingPayload.hint = `A resposta é um número`;
    }

    io.to(roomCode).emit('game:phaseChange', { phase: 'ranking_challenge' });
    io.to(roomCode).emit('ranking:show', rankingPayload);
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));

    room._rankingTimeout = setTimeout(() => {
        if (room.phase !== 'ranking_challenge') return;
        resolveRankingChallenge(room, roomCode, io, null, 'timeout');
    }, applyGameSpeed(DEFAULT_RANKING_TIMEOUT_MS));
}

function startTrivia(room, roomCode, io) {
    clearTriviaTimer(room);
    clearRankingTimer(room);
    clearBotTimers(room);
    resetDuelState(room);
    room.phase = 'trivia_all';
    room._triviaAnswers = {};
    room._roundStartedAt = Date.now();
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
    const roundDurationMs = room._roundStartedAt ? Math.max(0, Date.now() - room._roundStartedAt) : 0;
    room.metrics.triviaRoundsResolved++;
    room.metrics.totalRoundDurationMs += roundDurationMs;
    room.metrics.avgRoundDurationMs = room.metrics.totalRoundDurationMs / Math.max(1, room.metrics.triviaRoundsResolved);
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
            const points = Number(room.scoring?.triviaWinPoints || DEFAULT_TRIVIA_WIN_POINTS);
            room.teams[winnerTeamId].score += points;
            room.metrics.totalTriviaPointsAwarded += points;
            const teamMetric = ensureTeamMetric(room, winnerTeamId);
            if (teamMetric) {
                teamMetric.triviaWins++;
            }
        }
    } else {
        room.attackerTeamId = null;
    }
    refreshTeamWinRates(room);

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
                startRankingChallenge(room, roomCode, io);
            } else {
                room.phase = 'box_select';
                io.to(roomCode).emit('game:phaseChange', { phase: 'box_select' });
                io.to(roomCode).emit('game:stateSync', sanitizeState(room));
            }
        }, applyGameSpeed(3000));
    } else {
        // Nobody got it right - new trivia question
        setTimeout(() => {
            startTrivia(room, roomCode, io);
            io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        }, applyGameSpeed(3000));
    }
}

function backToTrivia(room, roomCode, io) {
    // Same box persists! Just go back to trivia
    clearRankingTimer(room);
    resetDuelState(room);
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
    clearRankingTimer(room);
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
    }, applyGameSpeed(Math.max(50, Number(delayMs) || 50)));
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
        if (!isDuelParticipant(room, playerId)) return;
        if (!room.currentQuestion || room.currentQuestion.id !== question.id) return;
        if (!room.players[playerId]?.isConnected) return;
        if (room._duelAnswers?.[playerId]) return;

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
    if (!Array.isArray(room._questionCatalog) || room._questionCatalog.length === 0) {
        room._questionCatalog = buildQuestionCatalog(room, getFallbackQuestions());
    }
    if (!room._usedQuestionSignatures || typeof room._usedQuestionSignatures.has !== 'function') {
        room._usedQuestionSignatures = new Set();
    }

    if (!Array.isArray(room._questionPool) || room._questionPool.length === 0) {
        const unseen = room._questionCatalog.filter((question) => !room._usedQuestionSignatures.has(question.signature));
        if (unseen.length === 0) {
            room._usedQuestionSignatures.clear();
            room._questionPool = shuffleArray([...room._questionCatalog]);
        } else {
            room._questionPool = shuffleArray(unseen);
        }
    }

    const targetDifficulty = getTargetDifficultyForRound(room.round || 1);
    const difficultyOrder = getDifficultyPreferenceOrder(targetDifficulty);

    let selectedIndex = -1;
    for (const difficulty of difficultyOrder) {
        selectedIndex = room._questionPool.findIndex((question) => normalizeDifficulty(question?.difficulty) === difficulty);
        if (selectedIndex >= 0) break;
    }

    if (selectedIndex < 0) {
        selectedIndex = 0;
    }

    let [q] = room._questionPool.splice(selectedIndex, 1);
    if (!q) {
        const fallback = normalizeQuestionPayload(getFallbackQuestions()[0], 'fallback');
        q = fallback || {
            id: `fallback_${generateId()}`,
            text: 'Pergunta indisponivel',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            category: 'Geral',
            difficulty: 'easy',
            timeLimit: FAST_MODE ? 4 : 10,
            signature: `fallback_${generateId()}`,
        };
    }
    room._usedQuestionSignatures.add(q.signature);
    room.currentQuestion = q;
    return q;
}

function createGameRoom(code, hostSocketId, settings = {}) {
    const boxCount = settings.boxCount || 13;
    const questionCategories = sanitizeQuestionCategories(settings.questionCategories);
    const triviaWinPoints = Math.max(1, Math.min(100, Number(settings?.scoring?.triviaWinPoints) || DEFAULT_TRIVIA_WIN_POINTS));
    const duelWinPoints = Math.max(20, Math.min(300, Number(settings?.scoring?.duelWinPoints) || DEFAULT_DUEL_WIN_POINTS));
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
        scoring: {
            triviaWinPoints,
            duelWinPoints,
        },
        autoBalanceScoring: typeof settings.autoBalanceScoring === 'boolean' ? settings.autoBalanceScoring : true,
        questionCategories,
        currentWildcard: null,
        timerEndAt: null,
        duelOpponentId: null,
        duelSelectEndAt: null,
        boxesOpened: 0,
        metrics: createEmptyMetrics(),
        _questionCatalog: [],
        _questionPool: [],
        _usedQuestionSignatures: new Set(),
        _triviaAnswers: {},
        _duelAnswers: {},
        _triviaTimeout: null,
        _rankingTimeout: null,
        _duelTimeout: null,
        _duelSelectTimeout: null,
        _roundStartedAt: null,
        _botTimers: new Set(),
        _botCounter: 0,
        _lastFrozenTeamId: null,
        _duelCardId: null,
    };
}

function sanitizeState(room) {
    const state = { ...room };
    delete state._questionPool;
    delete state._questionCatalog;
    delete state._usedQuestionSignatures;
    delete state._triviaAnswers;
    delete state._duelAnswers;
    delete state._triviaTimeout;
    delete state._rankingTimeout;
    delete state._duelTimeout;
    delete state._duelSelectTimeout;
    delete state._roundStartedAt;
    delete state._botTimers;
    delete state._botCounter;
    delete state._lastFrozenTeamId;
    delete state._duelCardId;
    if (state.currentQuestion) {
        state.currentQuestion = { ...state.currentQuestion, correctIndex: -1 };
        delete state.currentQuestion.signature;
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
    state.metrics = buildPublicMetrics(room);
    return state;
}
