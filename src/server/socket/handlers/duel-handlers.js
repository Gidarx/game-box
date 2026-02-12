function registerDuelHandlers(context) {
    const { socket } = context;
    socket.on('duel:selectOpponent', (data, callback) => onDuelSelectOpponent(context, data, callback));
    socket.on('duel:answer', (data, callback) => onDuelAnswer(context, data, callback));
}

function onDuelSelectOpponent(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { ensurePlayerSocketBinding, normalizeCode } = guards;
    const { selectDuelOpponent } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
    if (room.phase !== 'duel') return callback?.({ success: false, error: 'Duelo nao esta ativo' });
    if (!ensurePlayerSocketBinding(room, roomCode, data?.playerId)) {
        return callback?.({ success: false, error: 'Jogador invalido' });
    }

    const result = selectDuelOpponent(room, roomCode, io, data.playerId, data.opponentId);
    callback?.(result);
}

function onDuelAnswer(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { ensurePlayerSocketBinding, normalizeCode } = guards;
    const { submitDuelAnswer } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
    if (room.phase !== 'duel') return callback?.({ success: false, error: 'Duelo nao esta ativo' });
    if (!room.currentQuestion) return callback?.({ success: false, error: 'Pergunta indisponivel' });
    if (!ensurePlayerSocketBinding(room, roomCode, data?.playerId)) {
        return callback?.({ success: false, error: 'Jogador invalido' });
    }

    const result = submitDuelAnswer(room, roomCode, io, data.playerId, data.answerIndex);
    callback?.(result);
}

module.exports = {
    registerDuelHandlers,
};
