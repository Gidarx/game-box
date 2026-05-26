function registerBoardHandlers(context) {
    const { socket } = context;
    socket.on('box:select', (data, callback) => onBoxSelect(context, data, callback));
    socket.on('ranking:submit', (data, callback) => onRankingSubmit(context, data, callback));
    socket.on('card:open', (data, callback) => onCardOpen(context, data, callback));
    socket.on('card:testKeyword', (data, callback) => onCardTestKeyword(context, data, callback));
    socket.on('card:skipKeywordTest', (data, callback) => onCardSkipKeywordTest(context, data, callback));
    socket.on('card:solvePhrase', (data, callback) => onCardSolvePhrase(context, data, callback));
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
    const generated = generateCardGrid(box);
    room.cardGrid = generated.grid;
    room.unlockPhrase = generated.phrase;
    room.solveAttempts = 0;
    room._cardSolveBonus = 0;
    room.lockedKeys = 0;
    room.pendingKeywordCardId = null;
    room.attackerTeamId = room.triviaWinnerId ? room.players[room.triviaWinnerId]?.teamId || null : null;

    io.to(roomCode).emit('box:selected', { boxId: box.id, box: { id: box.id, isOpen: false } });
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
    if (room.pendingKeywordCardId) {
        return callback?.({ success: false, error: 'Finalize o teste da carta revelada antes de abrir outra' });
    }

    const card = room.cardGrid.find((item) => item.id === data?.cardId && item.status === 'hidden');
    if (!card) return callback?.({ success: false, error: 'Carta invalida' });

    card.status = 'revealed';
    card.tested = false;

    // Special cards resolve immediately after reveal (no test/skip decision).
    if (card.type === 'lost_turn') {
        card.tested = true;
        room.pendingKeywordCardId = null;
        openLostTurnCardTest(context, room, roomCode, card);
        return callback?.({ success: true, autoResolved: true, type: 'lost_turn' });
    }
    if (card.type === 'duel') {
        card.tested = true;
        room.pendingKeywordCardId = null;
        room.chances = Math.max(0, Number(room.chances || 0) - 1);
        openDuelCardTest(context, room, roomCode, card);
        return callback?.({ success: true, autoResolved: true, type: 'duel' });
    }

    room.pendingKeywordCardId = card.id;

    emitBoardState(context, room, roomCode);
    callback?.({ success: true, pendingCardId: card.id });
}

function onCardTestKeyword(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { applyGameSpeed, backToTrivia, openBox, recordCardTelemetry } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'card_open' || !isHost(room)) {
        return callback?.({ success: false });
    }
    if (room.chances <= 0) return callback?.({ success: false, error: 'Sem chances para testar palavra' });
    if (!room.pendingKeywordCardId) return callback?.({ success: false, error: 'Nenhuma carta pendente para teste' });
    if (Number(data?.cardId) && Number(data.cardId) !== room.pendingKeywordCardId) {
        return callback?.({ success: false, error: 'Carta pendente diferente da selecionada' });
    }

    const card = room.cardGrid.find((item) => item.id === room.pendingKeywordCardId);
    if (!card || card.status !== 'revealed') return callback?.({ success: false, error: 'Carta pendente invalida' });

    room.pendingKeywordCardId = null;
    card.tested = true;

    if (card.type === 'key') {
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

        emitBoardState(context, room, roomCode);

        if (room.lockedKeys >= 3) {
            setTimeout(() => openBox(room, roomCode, io), applyGameSpeed(1200));
        }

        return callback?.({ success: true, correct: true, chances: room.chances, lockedKeys: room.lockedKeys });
    }

    if (card.type === 'lost_turn') {
        openLostTurnCardTest(context, room, roomCode, card);
        return callback?.({ success: true, correct: false, chances: room.chances, lockedKeys: room.lockedKeys, type: 'lost_turn' });
    }
    if (card.type === 'duel') {
        room.chances = Math.max(0, Number(room.chances || 0) - 1);
        openDuelCardTest(context, room, roomCode, card);
        return callback?.({ success: true, correct: false, chances: room.chances, lockedKeys: room.lockedKeys, type: 'duel' });
    }

    room.chances = Math.max(0, Number(room.chances || 0) - 1);
    recordCardTelemetry(room, card, 1);
    io.to(roomCode).emit('card:opened', {
        cardId: card.id,
        word: card.word,
        type: 'distractor',
        lockedKeys: room.lockedKeys,
        chances: room.chances,
    });
    emitBoardState(context, room, roomCode);

    if (room.chances <= 0) {
        setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(1200));
    }

    callback?.({ success: true, correct: false, chances: room.chances, lockedKeys: room.lockedKeys });
}

function onCardSkipKeywordTest(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { applyGameSpeed, backToTrivia } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'card_open' || !isHost(room)) {
        return callback?.({ success: false });
    }
    if (!room.pendingKeywordCardId) return callback?.({ success: false, error: 'Nenhuma carta pendente para pular' });
    if (Number(data?.cardId) && Number(data.cardId) !== room.pendingKeywordCardId) {
        return callback?.({ success: false, error: 'Carta pendente diferente da selecionada' });
    }

    room.pendingKeywordCardId = null;
    emitBoardState(context, room, roomCode);
    const hasHiddenCards = room.cardGrid.some((card) => card.status === 'hidden');
    if (!hasHiddenCards && room.lockedKeys < 3) {
        setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(1200));
    }
    callback?.({ success: true, skipped: true, chances: room.chances });
}

function normalizePhrase(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toUpperCase();
}

function onCardSolvePhrase(context, data, callback) {
    const { io, rooms, guards, constants, operations } = context;
    const { ensurePlayerSocketBinding, normalizeCode } = guards;
    const { applyGameSpeed, backToTrivia, openBox, recordCardTelemetry, sanitizeState } = operations;
    const { CARD_SOLVE_BONUS_PER_CHANCE } = constants;

    const roomCode = normalizeCode(data?.roomCode);
    const playerId = data?.playerId;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'card_open') {
        return callback?.({ success: false, error: 'Cartas nao estao ativas' });
    }
    if (!ensurePlayerSocketBinding(room, roomCode, playerId)) {
        return callback?.({ success: false, error: 'Jogador invalido' });
    }
    const player = room.players[playerId];
    if (!player?.teamId || player.teamId !== room.attackerTeamId) {
        return callback?.({ success: false, error: 'Apenas o time atacante pode resolver' });
    }
    if (room.pendingKeywordCardId) {
        return callback?.({ success: false, error: 'Finalize a carta revelada antes de resolver a frase' });
    }
    if (room.chances <= 0) {
        return callback?.({ success: false, error: 'Sem chances para resolver' });
    }

    const expectedPhrase = normalizePhrase((room.unlockPhrase || []).join(' '));
    const submittedPhrase = normalizePhrase(data?.answer);
    if (!expectedPhrase || !submittedPhrase) {
        return callback?.({ success: false, error: 'Frase invalida' });
    }

    room.solveAttempts = Number(room.solveAttempts || 0) + 1;
    const correct = submittedPhrase === expectedPhrase;

    if (correct) {
        for (const card of room.cardGrid || []) {
            if (card.type === 'key') {
                card.status = 'locked';
                card.tested = true;
                recordCardTelemetry(room, card, 0);
            }
        }
        room.lockedKeys = 3;
        room._cardSolveBonus = Math.max(0, Number(room.chances || 0)) * Number(CARD_SOLVE_BONUS_PER_CHANCE || 0);
        io.to(roomCode).emit('card:phraseSolved', {
            playerId,
            teamId: player.teamId,
            correct: true,
            phrase: room.unlockPhrase || [],
            bonus: room._cardSolveBonus,
            chances: room.chances,
        });
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
        setTimeout(() => openBox(room, roomCode, io), applyGameSpeed(1200));
        return callback?.({ success: true, correct: true, bonus: room._cardSolveBonus, chances: room.chances });
    }

    room.chances = Math.max(0, Number(room.chances || 0) - 1);
    io.to(roomCode).emit('card:phraseSolved', {
        playerId,
        teamId: player.teamId,
        correct: false,
        bonus: 0,
        chances: room.chances,
    });
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    if (room.chances <= 0) {
        setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(1200));
    }
    return callback?.({ success: true, correct: false, bonus: 0, chances: room.chances });
}

function openLostTurnCardTest(context, room, roomCode, card) {
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

    emitBoardState(context, room, roomCode);
    setTimeout(() => backToTrivia(room, roomCode, io), applyGameSpeed(1200));
}

function openDuelCardTest(context, room, roomCode, card) {
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

    emitBoardState(context, room, roomCode);
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
