function registerTriviaHandlers(context) {
    const { socket } = context;
    socket.on('trivia:answer', (data, callback) => onTriviaAnswer(context, data, callback));
    socket.on('trivia:forceResolve', (data) => onTriviaForceResolve(context, data));
}

function onTriviaAnswer(context, data, callback) {
    const { rooms, guards, operations, io } = context;
    const { ensurePlayerSocketBinding, normalizeCode } = guards;
    const { submitTriviaAnswer } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const playerId = data?.playerId;
    const answerIndex = data?.answerIndex;
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
    if (room.phase !== 'trivia_all') return callback?.({ success: false, error: 'Rodada de trivia nao esta ativa' });
    if (!room.currentQuestion) return callback?.({ success: false, error: 'Pergunta indisponivel' });
    if (!ensurePlayerSocketBinding(room, roomCode, playerId)) {
        return callback?.({ success: false, error: 'Jogador invalido' });
    }

    const result = submitTriviaAnswer(room, roomCode, io, playerId, answerIndex);
    callback?.(result);
}

function onTriviaForceResolve(context, data) {
    const { rooms, guards, operations, io } = context;
    const { isHost, normalizeCode } = guards;
    const { resolveTriviaRound } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'trivia_all' || !isHost(room)) return;
    resolveTriviaRound(room, roomCode, io);
}

module.exports = {
    registerTriviaHandlers,
};
