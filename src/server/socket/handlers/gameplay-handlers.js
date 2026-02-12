const WILDCARD_DECK = [
    { type: 'FREEZE', name: 'CONGELAR', description: 'Time perde 1 rodada de trivia.', icon: 'ac_unit' },
    { type: 'STEAL', name: 'ROUBAR', description: 'Rouba 1 premio de outro time!', icon: 'swap_horizontal_circle' },
    { type: 'SHIELD', name: 'ESCUDO', description: 'Bloqueia o proximo efeito negativo.', icon: 'shield' },
    { type: 'SWAP', name: 'TROCA', description: 'Troca premios entre dois times.', icon: 'swap_horiz' },
];

function registerGameplayHandlers(context) {
    const { socket } = context;
    socket.on('game:start', async (data, callback) => onGameStart(context, data, callback));
    socket.on('host:forceNext', (data) => onHostForceNext(context, data));
}

async function onGameStart(context, data, callback) {
    const { io, rooms, guards, constants, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { MIN_PLAYERS_TO_START, QUESTION_FETCH_AMOUNT } = constants;
    const {
        buildQuestionCatalog,
        createEmptyMetrics,
        fetchTryviaQuestions,
        getFallbackQuestions,
        sanitizeState,
        shuffleArray,
        startTrivia,
    } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode iniciar' });

    const connectedPlayers = Object.values(room.players).filter((player) => player.isConnected);
    if (connectedPlayers.length < MIN_PLAYERS_TO_START) {
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
}

function onHostForceNext(context, data) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { backToTrivia, clearBotTimers, goToNextRound, resetDuelState, resolveTriviaRound, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || !isHost(room)) return;

    if (room.phase === 'reveal') {
        onRevealForceNext(room, roomCode, io, goToNextRound);
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
}

function onRevealForceNext(room, roomCode, io, goToNextRound) {
    if (room.boxesOpened > 0 && room.boxesOpened % 2 === 0) {
        room.currentWildcard = WILDCARD_DECK[Math.floor(Math.random() * WILDCARD_DECK.length)];
        room.phase = 'wildcard';
        io.to(roomCode).emit('game:phaseChange', { phase: 'wildcard' });
        io.to(roomCode).emit('wildcard:draw', { card: room.currentWildcard });
        return;
    }
    goToNextRound(room, roomCode, io);
}

module.exports = {
    registerGameplayHandlers,
};
