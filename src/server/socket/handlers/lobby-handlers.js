function registerLobbyHandlers(context) {
    const { socket } = context;
    socket.on('room:create', (settings, callback) => onRoomCreate(context, settings, callback));
    socket.on('room:join', (data, callback) => onRoomJoin(context, data, callback));
    socket.on('room:rejoin', (data, callback) => onRoomRejoin(context, data, callback));
    socket.on('room:playerReady', (data, callback) => onPlayerReady(context, data, callback));
    socket.on('game:settingsUpdate', (data) => onSettingsUpdate(context, data));
    socket.on('host:addBots', (data, callback) => onHostAddBots(context, data, callback));
    socket.on('host:clearBots', (data, callback) => onHostClearBots(context, data, callback));
}

function onRoomCreate(context, settings, callback) {
    const { socket, rooms, operations } = context;
    const { createGameRoom, generateRoomCode, sanitizeState } = operations;

    const code = generateRoomCode();
    const room = createGameRoom(code, socket.id, settings);
    rooms.set(code, room);
    socket.join(code);
    console.log(`[Room] Sala criada: ${code}`);
    callback?.({ success: true, roomCode: code, state: sanitizeState(room) });
}

function onRoomJoin(context, data, callback) {
    const { socket, io, rooms, socketToRoom, guards, constants, operations } = context;
    const { normalizeCode } = guards;
    const { MAX_PLAYERS_PER_ROOM } = constants;
    const { assignPlayerToBalancedTeam, assignPlayerToSoloTeam, generateId, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const { playerName, device } = data || {};
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
    if (room.phase !== 'lobby') return callback?.({ success: false, error: 'Jogo ja iniciado' });

    const connectedPlayers = Object.values(room.players).filter((player) => player.isConnected).length;
    if (connectedPlayers >= MAX_PLAYERS_PER_ROOM) {
        return callback?.({ success: false, error: `Sala lotada (${MAX_PLAYERS_PER_ROOM})` });
    }

    const playerId = generateId();
    const player = {
        id: playerId,
        name: playerName,
        teamId: null,
        socketId: socket.id,
        isReady: false,
        isConnected: true,
        score: 0,
        device: device || 'unknown',
    };

    room.players[playerId] = player;
    if (room.mode === 'solo') assignPlayerToSoloTeam(room, playerId);
    else assignPlayerToBalancedTeam(room, playerId);

    socketToRoom.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    io.to(roomCode).emit('room:playerJoined', { player, state: sanitizeState(room) });
    callback?.({ success: true, playerId, state: sanitizeState(room) });
}

function onRoomRejoin(context, data, callback) {
    const { socket, io, rooms, socketToRoom, guards, operations } = context;
    const { normalizeCode } = guards;
    const { sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const playerId = data?.playerId;
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ success: false, error: 'Sala nao encontrada' });
    if (!playerId || !room.players[playerId]) return callback?.({ success: false, error: 'Sessao nao encontrada' });

    const player = room.players[playerId];
    if (player.socketId && player.socketId !== socket.id) {
        socketToRoom.delete(player.socketId);
    }
    player.socketId = socket.id;
    player.isConnected = true;
    if (data?.device) player.device = data.device;

    socketToRoom.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    callback?.({ success: true, playerId, state: sanitizeState(room) });
}

function onPlayerReady(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { ensurePlayerSocketBinding, normalizeCode } = guards;
    const { sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const playerId = data?.playerId;
    const room = rooms.get(roomCode);

    if (room && playerId && room.players[playerId] && ensurePlayerSocketBinding(room, roomCode, playerId)) {
        room.players[playerId].isReady = true;
        io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    }
    callback?.({ success: true });
}

function onSettingsUpdate(context, data) {
    const { io, rooms, guards, constants, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { DEFAULT_MAX_ROUNDS } = constants;
    const {
        getDefaultBoxes,
        rebuildSoloTeams,
        rebuildTeamMode,
        sanitizeQuestionCategories,
        sanitizeState,
    } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const settings = data?.settings || {};
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby') return;
    if (!isHost(room)) return;

    if (settings.mode && settings.mode !== room.mode) {
        room.mode = settings.mode;
        if (room.mode === 'solo') rebuildSoloTeams(room);
        else rebuildTeamMode(room);
    }

    if (settings.boxCount) {
        const nextBoxCount = Math.max(5, Math.min(13, Number(settings.boxCount) || 13));
        room.boxCount = nextBoxCount;
        room.boxes = getDefaultBoxes().slice(0, nextBoxCount).map((box) => ({ ...box, isOpen: false }));
    }

    if (settings.maxRounds) {
        room.maxRounds = Math.max(1, Number(settings.maxRounds) || DEFAULT_MAX_ROUNDS);
    }
    if (Array.isArray(settings.questionCategories)) {
        room.questionCategories = sanitizeQuestionCategories(settings.questionCategories);
    }
    if (settings.scoring && typeof settings.scoring === 'object') {
        if (Number.isFinite(settings.scoring.triviaWinPoints)) {
            room.scoring.triviaWinPoints = Math.max(1, Math.min(100, Number(settings.scoring.triviaWinPoints)));
        }
        if (Number.isFinite(settings.scoring.duelWinPoints)) {
            room.scoring.duelWinPoints = Math.max(20, Math.min(300, Number(settings.scoring.duelWinPoints)));
        }
    }
    if (typeof settings.autoBalanceScoring === 'boolean') {
        room.autoBalanceScoring = settings.autoBalanceScoring;
    }

    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

function onHostAddBots(context, data, callback) {
    const { io, rooms, guards, constants, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { MAX_PLAYERS_PER_ROOM } = constants;
    const { assignPlayerToBalancedTeam, assignPlayerToSoloTeam, createBotPlayer, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode adicionar bots' });
    if (room.phase !== 'lobby') return callback?.({ success: false, error: 'Bots so podem ser adicionados no lobby' });

    const requested = Math.max(1, Math.min(20, Number(data?.count) || 1));
    const connectedPlayers = Object.values(room.players).filter((player) => player.isConnected).length;
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
        totalBots: Object.values(room.players).filter((player) => player.isBot).length,
    });
}

function onHostClearBots(context, data, callback) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { removePlayerFromRoom, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || !isHost(room)) return callback?.({ success: false, error: 'Apenas o host pode remover bots' });
    if (room.phase !== 'lobby') return callback?.({ success: false, error: 'Bots so podem ser removidos no lobby' });

    const botIds = Object.values(room.players)
        .filter((player) => player.isBot)
        .map((player) => player.id);

    botIds.forEach((botId) => removePlayerFromRoom(room, botId));

    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
    callback?.({ success: true, removed: botIds.length });
}

module.exports = {
    registerLobbyHandlers,
};
