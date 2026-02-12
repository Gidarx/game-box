function registerDisconnectHandler(context) {
    const { socket } = context;
    socket.on('disconnect', () => onDisconnect(context));
}

function onDisconnect(context) {
    const { socket, io, rooms, socketToRoom, operations } = context;
    const {
        getDuelParticipantIds,
        getEligiblePlayerIds,
        pickRandomDuelOpponent,
        resolveDuelRound,
        resolveTriviaRound,
        sanitizeState,
        scheduleBotTimer,
        selectDuelOpponent,
    } = operations;

    console.log(`[Socket] Desconectado: ${socket.id}`);
    const mapping = socketToRoom.get(socket.id);
    if (!mapping) return;

    const room = rooms.get(mapping.roomCode);
    if (!room) {
        socketToRoom.delete(socket.id);
        return;
    }

    const player = Object.values(room.players).find((entry) => entry.socketId === socket.id);
    if (!player) {
        socketToRoom.delete(socket.id);
        return;
    }

    player.isConnected = false;
    if (room.phase === 'lobby') removePlayerFromLobby(room, player.id);

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
                    selectDuelOpponent(room, mapping.roomCode, io, player.id, fallbackOpponentId, {
                        source: 'disconnect',
                        allowSameTeam: true,
                    });
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

    socketToRoom.delete(socket.id);
}

function removePlayerFromLobby(room, playerId) {
    const player = room.players[playerId];
    if (!player) return;

    if (player.teamId && room.teams[player.teamId]) {
        const team = room.teams[player.teamId];
        team.playerIds = team.playerIds.filter((id) => id !== playerId);
        if (team.playerIds.length === 0) {
            delete room.teams[player.teamId];
        }
    }
    delete room.players[playerId];
}

module.exports = {
    registerDisconnectHandler,
};
