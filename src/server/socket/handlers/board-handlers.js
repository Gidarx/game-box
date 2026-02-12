function registerBoardHandlers(context) {
    const { socket } = context;
    socket.on('box:select', (data, callback) => onBoxSelect(context, data, callback));
    socket.on('ranking:submit', (data, callback) => onRankingSubmit(context, data, callback));
    socket.on('card:open', (data, callback) => onCardOpen(context, data, callback));
}

function onBoxSelect(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { generateCardGrid, startRankingChallenge } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'box_select' || !isHost(room)) return callback?.({ success: false });
    if (!room.triviaWinnerId) return callback?.({ success: false, error: 'Sem vencedor da trivia' });

    const box = room.boxes.find((item) => item.id === data?.boxId && !item.isOpen);
    if (!box) return callback?.({ success: false });

    room.selectedBoxId = data.boxId;
    room.lastRevealedBoxId = null;
    room.cardGrid = generateCardGrid(box);
    room.lockedKeys = 0;
    room.attackerTeamId = room.triviaWinnerId ? room.players[room.triviaWinnerId]?.teamId || null : null;

    io.to(roomCode).emit('box:selected', { boxId: box.id, box });
    startRankingChallenge(room, roomCode, io);
    callback?.({ success: true });
}

function onRankingSubmit(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { resolveRankingChallenge } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'ranking_challenge' || !room.currentRanking || !isHost(room)) {
        return callback?.({ success: false });
    }

    const result = resolveRankingChallenge(room, roomCode, io, data?.answer ?? data?.order, 'host_submit');
    callback?.(result);
}

function onCardOpen(context, data, callback) {
    const { rooms, guards } = context;
    const { isHost, normalizeCode } = guards;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'card_open' || room.chances <= 0 || !isHost(room)) {
        return callback?.({ success: false });
    }

    const card = room.cardGrid.find((item) => item.id === data?.cardId && item.status === 'hidden');
    if (!card) return callback?.({ success: false, error: 'Carta invalida' });
    card.status = 'revealed';

    if (card.type === 'key') {
        const endedByKey = openKeyCard(context, room, roomCode, card);
        if (endedByKey) return callback?.({ success: true });
    } else if (card.type === 'lost_turn') {
        openLostTurnCard(context, room, roomCode, card);
    } else if (card.type === 'duel') {
        openDuelCard(context, room, roomCode, card);
    } else {
        openDistractorCard(context, room, roomCode, card);
    }

    emitBoardState(context, room, roomCode);
    callback?.({ success: true });
}

function openKeyCard(context, room, roomCode, card) {
    const { io, operations } = context;
    const { applyGameSpeed, getPublicGrid, openBox, recordCardTelemetry, sanitizeState } = operations;

    recordCardTelemetry(room, card, 0);
    room.lockedKeys++;
    card.status = 'locked';

    io.to(roomCode).emit('card:opened', {
        cardId: card.id,
        word: card.word,
        type: 'key',
        lockedKeys: room.lockedKeys,
        chances: room.chances,
    });

    if (room.lockedKeys < 3) return false;

    setTimeout(() => openBox(room, roomCode, io), applyGameSpeed(1500));
    io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    return true;
}

function openLostTurnCard(context, room, roomCode, card) {
    const { io, operations } = context;
    const { applyGameSpeed, backToTrivia, recordCardTelemetry } = operations;

    const lostImpact = Math.max(1, Number(room.chances || 0));
    recordCardTelemetry(room, card, lostImpact);
    room.chances = 0;

    io.to(roomCode).emit('card:opened', {
        cardId: card.id,
        word: card.word,
        type: 'lost_turn',
        lockedKeys: room.lockedKeys,
        chances: 0,
    });

    setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(2500));
}

function openDuelCard(context, room, roomCode, card) {
    const { io, constants, operations } = context;
    const { DEFAULT_DUEL_SELECT_TIMEOUT_MS } = constants;
    const {
        applyGameSpeed,
        backToTrivia,
        clearDuelSelectTimer,
        clearDuelTimer,
        pickRandomDuelOpponent,
        recordCardTelemetry,
        resetDuelState,
        sanitizeState,
        scheduleBotTimer,
        selectDuelOpponent,
    } = operations;

    recordCardTelemetry(room, card, 0);
    room.chances--;
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
        cardId: card.id,
        word: card.word,
        type: 'duel',
        lockedKeys: room.lockedKeys,
        chances: room.chances,
    });
    io.to(roomCode).emit('game:phaseChange', { phase: 'duel' });

    room._duelSelectTimeout = setTimeout(() => {
        if (room.phase !== 'duel' || room.duelOpponentId) return;
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

    if (room.triviaWinnerId && room.players[room.triviaWinnerId]?.isBot) {
        const opponentId = pickRandomDuelOpponent(room, room.triviaWinnerId);
        if (opponentId) {
            scheduleBotTimer(room, () => {
                if (room.phase !== 'duel' || room.duelOpponentId) return;
                selectDuelOpponent(room, roomCode, io, room.triviaWinnerId, opponentId, { source: 'bot', allowSameTeam: true });
            }, 650);
        }
    }
}

function openDistractorCard(context, room, roomCode, card) {
    const { io, operations } = context;
    const { applyGameSpeed, backToTrivia, recordCardTelemetry } = operations;

    recordCardTelemetry(room, card, 1);
    room.chances--;

    io.to(roomCode).emit('card:opened', {
        cardId: card.id,
        word: card.word,
        type: 'distractor',
        lockedKeys: room.lockedKeys,
        chances: room.chances,
    });

    if (room.chances <= 0) {
        setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(2000));
    }
}

function emitBoardState(context, room, roomCode) {
    const { io, operations } = context;
    const { getPublicGrid, sanitizeState } = operations;

    io.to(roomCode).emit('card:gridState', { grid: getPublicGrid(room.cardGrid) });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

module.exports = {
    registerBoardHandlers,
};
