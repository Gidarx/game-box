/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const os = require('os');
const {
    BOT_DUEL_ACCURACY,
    BOT_TRIVIA_ACCURACY,
    DEFAULT_DUEL_SELECT_TIMEOUT_MS,
    DEFAULT_DUEL_WIN_POINTS,
    DEFAULT_MAX_CHANCES,
    DEFAULT_MAX_ROUNDS,
    DEFAULT_RANKING_TIMEOUT_MS,
    DEFAULT_TRIVIA_WIN_POINTS,
    FAST_MODE,
    MAX_PLAYERS_PER_ROOM,
    MIN_PLAYERS_TO_START,
    QUESTION_FETCH_AMOUNT,
} = require('./src/server/config');
const { generateId, generateRoomCode, shuffleArray } = require('./src/server/random');
const {
    buildPublicMetrics,
    createEmptyMetrics,
    ensureTeamMetric,
    maybeAutoTuneDuelPoints,
    recordCardTelemetry,
    refreshTeamWinRates,
} = require('./src/server/metrics');
const { getRandomRanking, scoreRanking } = require('./src/server/ranking');
const { generateCardGrid, getDefaultBoxes, getPublicGrid } = require('./src/server/game-content');
const {
    buildQuestionCatalog,
    fetchTryviaQuestions,
    getFallbackQuestions,
    getNextQuestion,
    sanitizeQuestionCategories,
} = require('./src/server/questions');
const { registerSocketHandlers } = require('./src/server/socket/register-handlers');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

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
        registerSocketHandlers({
            socket,
            io,
            rooms,
            socketToRoom,
            constants: {
                DEFAULT_DUEL_SELECT_TIMEOUT_MS,
                DEFAULT_MAX_ROUNDS,
                MAX_PLAYERS_PER_ROOM,
                MIN_PLAYERS_TO_START,
                QUESTION_FETCH_AMOUNT,
            },
            guards: {
                ensurePlayerSocketBinding,
                isHost,
                normalizeCode,
            },
            operations: {
                applyGameSpeed,
                assignPlayerToBalancedTeam,
                assignPlayerToSoloTeam,
                backToTrivia,
                buildQuestionCatalog,
                clearBotTimers,
                clearDuelSelectTimer,
                clearDuelTimer,
                createBotPlayer,
                createEmptyMetrics,
                createGameRoom,
                fetchTryviaQuestions,
                generateCardGrid,
                generateId,
                generateRoomCode,
                getDefaultBoxes,
                getDuelParticipantIds,
                getEligiblePlayerIds,
                getFallbackQuestions,
                getPublicGrid,
                goToNextRound,
                openBox,
                pickRandomDuelOpponent,
                rebuildSoloTeams,
                rebuildTeamMode,
                recordCardTelemetry,
                removePlayerFromRoom,
                resetDuelState,
                resolveDuelRound,
                resolveRankingChallenge,
                resolveTriviaRound,
                sanitizeQuestionCategories,
                sanitizeState,
                scheduleBotTimer,
                selectDuelOpponent,
                shuffleArray,
                startRankingChallenge,
                startTrivia,
                submitDuelAnswer,
                submitTriviaAnswer,
            },
        });
    });

    httpServer.listen(port, hostname, () => {
        const localIP = getLocalIP();
        console.log('\n========================================');
        console.log('  ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â® CAIXA MISTERIOSA - GAME SERVER');
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
        rankingPayload.hint = `A resposta ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© um nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero`;
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

