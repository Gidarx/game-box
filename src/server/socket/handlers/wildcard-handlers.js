function registerWildcardHandlers(context) {
    const { socket } = context;
    socket.on('wildcard:apply', (data) => onWildcardApply(context, data));
    socket.on('wildcard:skip', (data) => onWildcardSkip(context, data));
}

function onWildcardApply(context, data) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { goToNextRound, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const targetTeamId = data?.targetTeamId;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'wildcard' || !room.currentWildcard || !isHost(room)) return;

    const team = room.teams[targetTeamId];
    if (!team) return;

    const card = room.currentWildcard;
    const applied = applyWildcardEffect(room, targetTeamId, card);

    room.currentWildcard = null;
    io.to(roomCode).emit('wildcard:effect', { targetTeamId, type: card.type, applied });
    goToNextRound(room, roomCode, io);
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

function onWildcardSkip(context, data) {
    const { io, rooms, guards, operations } = context;
    const { isHost, normalizeCode } = guards;
    const { goToNextRound, sanitizeState } = operations;

    const roomCode = normalizeCode(data?.roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'wildcard' || !isHost(room)) return;

    room.currentWildcard = null;
    goToNextRound(room, roomCode, io);
    io.to(roomCode).emit('game:stateSync', sanitizeState(room));
}

function applyWildcardEffect(room, targetTeamId, card) {
    switch (card.type) {
        case 'FREEZE':
            return applyFreezeEffect(room, targetTeamId);
        case 'STEAL':
            return applyStealEffect(room, targetTeamId);
        case 'SHIELD':
            return applyShieldEffect(room, targetTeamId);
        case 'SWAP':
            return applySwapEffect(room, targetTeamId);
        default:
            return false;
    }
}

function applyFreezeEffect(room, targetTeamId) {
    const team = room.teams[targetTeamId];
    if (!team) return false;
    if (room._lastFrozenTeamId === targetTeamId) return false;
    team.frozenUntilRound = room.round + 1;
    room._lastFrozenTeamId = targetTeamId;
    return true;
}

function applyStealEffect(room, targetTeamId) {
    if (!room.triviaWinnerId) return true;

    const winnerTeamId = room.players[room.triviaWinnerId]?.teamId;
    if (!winnerTeamId || !room.teams[winnerTeamId]) return true;
    if (room.teams[winnerTeamId].stealUsed) return false;

    const targetTeam = room.teams[targetTeamId];
    const stealableItems = targetTeam.inventory.filter((item) => !item.shielded);
    if (stealableItems.length === 0) return false;

    const stolenItem = stealableItems[Math.floor(Math.random() * stealableItems.length)];
    targetTeam.inventory = targetTeam.inventory.filter((item) => item !== stolenItem);
    targetTeam.score = Math.max(0, targetTeam.score - stolenItem.points);
    room.teams[winnerTeamId].inventory.push(stolenItem);
    room.teams[winnerTeamId].score += stolenItem.points;
    room.teams[winnerTeamId].stealUsed = true;
    return true;
}

function applyShieldEffect(room, targetTeamId) {
    const team = room.teams[targetTeamId];
    if (!team) return false;
    team.shields++;
    return true;
}

function applySwapEffect(room, targetTeamId) {
    if (!room.triviaWinnerId) return true;

    const attackerTeamId = room.players[room.triviaWinnerId]?.teamId;
    if (!attackerTeamId || !room.teams[attackerTeamId]) return true;

    const targetTeam = room.teams[targetTeamId];
    const attackerTeam = room.teams[attackerTeamId];
    const targetItems = targetTeam.inventory.filter((item) => !item.shielded);
    const attackerItems = attackerTeam.inventory.filter((item) => !item.shielded);
    if (targetItems.length === 0 || attackerItems.length === 0) return false;

    const targetItem = targetItems[Math.floor(Math.random() * targetItems.length)];
    const attackerItem = attackerItems.find((item) => item.rarity === targetItem.rarity)
        || attackerItems[Math.floor(Math.random() * attackerItems.length)];

    targetTeam.inventory = targetTeam.inventory.filter((item) => item !== targetItem);
    attackerTeam.inventory = attackerTeam.inventory.filter((item) => item !== attackerItem);
    targetTeam.inventory.push(attackerItem);
    attackerTeam.inventory.push(targetItem);
    targetTeam.score = targetTeam.score - targetItem.points + attackerItem.points;
    attackerTeam.score = attackerTeam.score - attackerItem.points + targetItem.points;
    return true;
}

module.exports = {
    registerWildcardHandlers,
};
