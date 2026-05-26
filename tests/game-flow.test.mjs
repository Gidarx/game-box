import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { io as createSocketClient } from 'socket.io-client';

const PORT = 4300 + Math.floor(Math.random() * 300);
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess = null;

function waitFor(condition, timeoutMs, intervalMs = 100) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const tick = async () => {
            try {
                const value = await condition();
                if (value) return resolve(value);
                if (Date.now() - startedAt >= timeoutMs) {
                    return reject(new Error(`Timeout after ${timeoutMs}ms`));
                }
                setTimeout(() => {
                    tick().catch(reject);
                }, intervalMs);
            } catch (error) {
                reject(error);
            }
        };
        tick().catch(reject);
    });
}

function emitAck(socket, event, payload, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Ack timeout: ${event}`));
        }, timeoutMs);
        socket.emit(event, payload, (response) => {
            clearTimeout(timer);
            resolve(response);
        });
    });
}

function connectClient() {
    return new Promise((resolve, reject) => {
        const socket = createSocketClient(BASE_URL, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 5000,
        });
        const onConnect = () => {
            socket.off('connect_error', onError);
            resolve(socket);
        };
        const onError = (err) => {
            socket.off('connect', onConnect);
            reject(err);
        };
        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
    });
}

function createStateTracker(socket, initialState = null) {
    let state = initialState;
    const listeners = new Set();
    const onState = (nextState) => {
        state = nextState;
        for (const listener of listeners) listener(nextState);
    };
    socket.on('game:stateSync', onState);

    return {
        get state() {
            return state;
        },
        waitFor(predicate, timeoutMs = 20000) {
            if (predicate(state)) return Promise.resolve(state);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    listeners.delete(listener);
                    reject(new Error(`State wait timeout (${timeoutMs}ms)`));
                }, timeoutMs);
                const listener = (nextState) => {
                    if (!predicate(nextState)) return;
                    clearTimeout(timer);
                    listeners.delete(listener);
                    resolve(nextState);
                };
                listeners.add(listener);
            });
        },
        dispose() {
            socket.off('game:stateSync', onState);
            listeners.clear();
        },
    };
}

function waitForSocketEvent(socket, event, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, onEvent);
            reject(new Error(`Event timeout: ${event}`));
        }, timeoutMs);
        const onEvent = (payload) => {
            clearTimeout(timer);
            socket.off(event, onEvent);
            resolve(payload);
        };
        socket.on(event, onEvent);
    });
}

async function createRoomSetup({ playerCount = 4 } = {}) {
    const sockets = [];
    const host = await connectClient();
    sockets.push(host);

    const createResult = await emitAck(host, 'room:create', {});
    assert.equal(createResult.success, true);
    const roomCode = createResult.roomCode;
    const tracker = createStateTracker(host, createResult.state);

    const players = [];
    for (let index = 0; index < playerCount; index++) {
        const socket = await connectClient();
        sockets.push(socket);
        const playerName = `P${index + 1}`;
        const joinResult = await emitAck(socket, 'room:join', {
            roomCode,
            playerName,
            device: 'TEST',
        });
        assert.equal(joinResult.success, true);
        players.push({
            socket,
            playerId: joinResult.playerId,
            playerName,
        });
        await emitAck(socket, 'room:playerReady', { roomCode, playerId: joinResult.playerId });
    }

    const triviaUnsubs = [];
    for (let index = 0; index < players.length; index++) {
        const player = players[index];
        const handler = (payload) => {
            const optionCount = Array.isArray(payload?.question?.options) ? payload.question.options.length : 4;
            const answerIndex = optionCount > 0 ? (index % optionCount) : 0;
            setTimeout(() => {
                player.socket.emit('trivia:answer', {
                    roomCode,
                    playerId: player.playerId,
                    answerIndex,
                }, () => { });
            }, index * 20);
        };
        player.socket.on('trivia:question', handler);
        triviaUnsubs.push(() => player.socket.off('trivia:question', handler));
    }

    return {
        host,
        players,
        roomCode,
        tracker,
        sockets,
        cleanup: async () => {
            triviaUnsubs.forEach((fn) => fn());
            tracker.dispose();
            sockets.forEach((socket) => {
                if (socket.connected) socket.disconnect();
            });
            await delay(40);
        },
    };
}

async function driveUntilPhaseActionable({ host, roomCode, tracker, targetPhase, timeoutMs = 45000 }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const state = tracker.state;
        if (state?.phase === targetPhase) return state;

        if (state?.phase === 'box_select') {
            const nextBox = (state.boxes || []).find((box) => !box.isOpen);
            if (nextBox) {
                await emitAck(host, 'box:select', { roomCode, boxId: nextBox.id });
            }
        } else if (state?.phase === 'ranking_challenge') {
            await emitAck(host, 'ranking:submit', {
                roomCode,
                order: [0, 1, 2, 3],
            });
        } else if (state?.phase === 'card_open') {
            if (state.pendingKeywordCardId) {
                const pendingCard = (state.cardGrid || []).find((card) => card.id === state.pendingKeywordCardId);
                const pendingWord = String(pendingCard?.word || '').toUpperCase();
                if (targetPhase === 'duel' && pendingWord !== 'DUELO') {
                    await emitAck(host, 'card:skipKeywordTest', { roomCode, cardId: state.pendingKeywordCardId });
                } else {
                    await emitAck(host, 'card:testKeyword', { roomCode, cardId: state.pendingKeywordCardId });
                }
            } else {
                const hiddenCard = (state.cardGrid || []).find((card) => card.status === 'hidden');
                if (hiddenCard) {
                    await emitAck(host, 'card:open', { roomCode, cardId: hiddenCard.id });
                } else {
                    host.emit('host:forceNext', { roomCode });
                }
            }
        }

        await delay(120);
    }
    throw new Error(`Could not reach phase "${targetPhase}" within ${timeoutMs}ms`);
}

async function driveUntilCardOpen({ host, roomCode, tracker, timeoutMs = 60000 }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const state = tracker.state;
        if (state?.phase === 'card_open' && state.chances > 0) return state;

        if (state?.phase === 'box_select') {
            const nextBox = (state.boxes || []).find((box) => !box.isOpen);
            if (nextBox) {
                await emitAck(host, 'box:select', { roomCode, boxId: nextBox.id });
            }
        } else if (state?.phase === 'ranking_challenge') {
            const type = state.currentRanking?.type || 'order';
            const answer = type === 'estimation'
                ? 0
                : type === 'true_false'
                    ? [true, true, true, true]
                    : [0, 1, 2, 3];
            await emitAck(host, 'ranking:submit', { roomCode, answer });
        } else if (state?.phase === 'duel' || state?.phase === 'reveal' || state?.phase === 'wildcard') {
            host.emit('host:forceNext', { roomCode });
        } else if (state?.phase === 'card_open' && state.chances <= 0) {
            host.emit('host:forceNext', { roomCode });
        }

        await delay(120);
    }
    throw new Error(`Could not reach actionable card_open within ${timeoutMs}ms`);
}

before(async () => {
    serverProcess = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: String(PORT),
            NODE_ENV: 'test',
            DISABLE_TRYVIA: '1',
            GAMEBOX_TEST_FAST: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', () => { });
    serverProcess.stderr.on('data', () => { });

    await waitFor(async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/server-info`);
            return response.ok;
        } catch {
            return false;
        }
    }, 40000, 250);
});

after(async () => {
    if (!serverProcess) return;
    serverProcess.kill('SIGTERM');
    await delay(200);
    if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
    }
});

test('ranking timeout resolves phase without host submit', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        await tracker.waitFor((state) => state?.phase === 'box_select', 25000);

        const nextBox = (tracker.state.boxes || []).find((box) => !box.isOpen);
        assert.ok(nextBox, 'expected at least one unopened box');
        await emitAck(host, 'box:select', { roomCode, boxId: nextBox.id });

        await tracker.waitFor((state) => state?.phase === 'ranking_challenge', 12000);
        await tracker.waitFor((state) => state?.phase === 'card_open' || state?.phase === 'trivia_all', 20000);
        assert.ok(['card_open', 'trivia_all'].includes(tracker.state.phase));
    } finally {
        await setup.cleanup();
    }
});

test('public state hides unopened box rewards', async () => {
    const setup = await createRoomSetup({ playerCount: 3 });
    try {
        const firstBox = setup.tracker.state.boxes?.[0];
        assert.ok(firstBox, 'expected at least one box');
        assert.equal(firstBox.isOpen, false);
        assert.equal(firstBox.prizeLabel, undefined);
        assert.equal(firstBox.points, undefined);
        assert.equal(firstBox.type, undefined);
    } finally {
        await setup.cleanup();
    }
});

test('card phrase is only exposed as public progress', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        await driveUntilCardOpen({ host, roomCode, tracker, timeoutMs: 60000 });

        assert.equal(tracker.state.unlockPhrase, undefined);
        assert.ok(Array.isArray(tracker.state.unlockPhraseProgress));
        assert.ok(tracker.state.unlockPhraseProgress.length > 0);
        assert.ok(tracker.state.unlockPhraseProgress.every((word) => word === null || typeof word === 'string'));
        assert.equal(typeof tracker.state.solveAttempts, 'number');
    } finally {
        await setup.cleanup();
    }
});

test('host can manually edit teams and wildcard frequency in lobby', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, players, roomCode, tracker } = setup;

        host.emit('game:settingsUpdate', {
            roomCode,
            settings: {
                mode: 'equipes',
                wildcardFrequency: 0,
            },
        });

        await tracker.waitFor((state) => state?.mode === 'equipes' && state.wildcardFrequency === 0, 8000);
        const teamIds = Object.keys(tracker.state.teams || {});
        assert.ok(teamIds.length >= 2, 'expected at least two teams in team mode');

        const renameResult = await emitAck(host, 'team:rename', {
            roomCode,
            teamId: teamIds[0],
            name: 'Alpha',
        });
        assert.equal(renameResult.success, true);
        await tracker.waitFor((state) => state?.teams?.[teamIds[0]]?.name === 'Alpha', 8000);

        const player = players[0];
        const currentTeamId = tracker.state.players[player.playerId].teamId;
        const targetTeamId = teamIds.find((teamId) => teamId !== currentTeamId) || teamIds[0];

        const assignResult = await emitAck(host, 'team:assign', {
            roomCode,
            playerId: player.playerId,
            teamId: targetTeamId,
        });
        assert.equal(assignResult.success, true);

        await tracker.waitFor((state) => state?.players?.[player.playerId]?.teamId === targetTeamId, 8000);
        const memberships = Object.values(tracker.state.teams)
            .flatMap((team) => team.playerIds)
            .filter((playerId) => playerId === player.playerId);
        assert.deepEqual(memberships, [player.playerId]);
    } finally {
        await setup.cleanup();
    }
});

test('game cannot be started again after leaving lobby', async () => {
    const setup = await createRoomSetup({ playerCount: 3 });
    try {
        const { host, roomCode } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        const restartResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(restartResult.success, false);
        assert.match(restartResult.error, /iniciado/i);
    } finally {
        await setup.cleanup();
    }
});

test('duel opponent timeout auto-selects and duel resolves', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, players, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        await driveUntilPhaseActionable({ host, roomCode, tracker, targetPhase: 'duel', timeoutMs: 60000 });
        assert.equal(tracker.state.phase, 'duel');

        const chooserId = tracker.state.triviaWinnerId;
        const chooserPlayer = players.find((player) => player.playerId === chooserId);

        if (chooserPlayer) {
            chooserPlayer.socket.disconnect();
            const rejoinSocket = await connectClient();
            const rejoinResult = await emitAck(rejoinSocket, 'room:rejoin', {
                roomCode,
                playerId: chooserPlayer.playerId,
                playerName: chooserPlayer.playerName,
                device: 'TEST_REJOIN',
            });
            assert.equal(rejoinResult.success, true);
            chooserPlayer.socket = rejoinSocket;
        }

        const duelStart = await waitForSocketEvent(host, 'duel:start', 18000);
        assert.ok(duelStart.opponentPlayerId, 'duel should have an auto-selected opponent');

        const duelResult = await waitForSocketEvent(host, 'duel:result', 20000);
        assert.ok(Array.isArray(duelResult?.question?.options), 'duel result should include question options');
        assert.ok(typeof duelResult.correctIndex === 'number');

        await tracker.waitFor((state) => state?.phase === 'card_open' || state?.phase === 'trivia_all', 20000);
        assert.ok(['card_open', 'trivia_all'].includes(tracker.state.phase));
    } finally {
        await setup.cleanup();
    }
});

test('duel returns to flow if chooser disconnects and does not rejoin', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, players, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        await driveUntilPhaseActionable({ host, roomCode, tracker, targetPhase: 'duel', timeoutMs: 60000 });
        const chooserId = tracker.state.triviaWinnerId;
        const chooserPlayer = players.find((player) => player.playerId === chooserId);
        assert.ok(chooserPlayer, 'expected chooser to be a connected test player');

        chooserPlayer.socket.disconnect();

        await tracker.waitFor((state) => state?.phase === 'card_open' || state?.phase === 'trivia_all', 12000);
        assert.ok(['card_open', 'trivia_all'].includes(tracker.state.phase));
        assert.equal(tracker.state.duelOpponentId, null);
        if (tracker.state.phase === 'card_open') {
            assert.equal(tracker.state.currentQuestion, null);
        } else {
            assert.ok(tracker.state.currentQuestion, 'expected a new trivia question after returning to trivia');
        }
    } finally {
        await setup.cleanup();
    }
});

test('key cards do not spend chances', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        const startedAt = Date.now();
        while (Date.now() - startedAt < 90000) {
            await driveUntilCardOpen({ host, roomCode, tracker, timeoutMs: 30000 });

            while (tracker.state?.phase === 'card_open' && tracker.state.chances > 0) {
                if (tracker.state.pendingKeywordCardId) {
                    const pendingCard = (tracker.state.cardGrid || []).find((card) => card.id === tracker.state.pendingKeywordCardId);
                    const pendingWord = String(pendingCard?.word || '');
                    if (pendingWord && pendingWord === pendingWord.toUpperCase()) {
                        const chancesBefore = tracker.state.chances;
                        const result = await emitAck(host, 'card:testKeyword', {
                            roomCode,
                            cardId: tracker.state.pendingKeywordCardId,
                        });
                        if (result.correct) {
                            assert.equal(result.chances, chancesBefore);
                            assert.equal(tracker.state.chances, chancesBefore);
                            return;
                        }
                    } else {
                        await emitAck(host, 'card:skipKeywordTest', {
                            roomCode,
                            cardId: tracker.state.pendingKeywordCardId,
                        });
                    }
                } else {
                    const hiddenCard = (tracker.state.cardGrid || []).find((card) => card.status === 'hidden');
                    if (!hiddenCard) break;
                    await emitAck(host, 'card:open', { roomCode, cardId: hiddenCard.id });
                }

                await delay(120);
            }

            if (tracker.state?.phase === 'duel' || tracker.state?.phase === 'card_open') {
                host.emit('host:forceNext', { roomCode });
            }
            await delay(300);
        }

        assert.fail('expected to find and test a key card');
    } finally {
        await setup.cleanup();
    }
});

test('player rejoin during ranking phase does not stall game flow', async () => {
    const setup = await createRoomSetup({ playerCount: 4 });
    try {
        const { host, players, roomCode, tracker } = setup;
        const startResult = await emitAck(host, 'game:start', { roomCode });
        assert.equal(startResult.success, true);

        await tracker.waitFor((state) => state?.phase === 'box_select', 25000);

        const nextBox = (tracker.state.boxes || []).find((box) => !box.isOpen);
        assert.ok(nextBox, 'expected at least one unopened box');
        await emitAck(host, 'box:select', { roomCode, boxId: nextBox.id });
        await tracker.waitFor((state) => state?.phase === 'ranking_challenge', 12000);

        const reconnectingPlayer = players[0];
        reconnectingPlayer.socket.disconnect();
        const rejoinSocket = await connectClient();
        const rejoinResult = await emitAck(rejoinSocket, 'room:rejoin', {
            roomCode,
            playerId: reconnectingPlayer.playerId,
            playerName: reconnectingPlayer.playerName,
            device: 'TEST_REJOIN',
        });
        assert.equal(rejoinResult.success, true);
        reconnectingPlayer.socket = rejoinSocket;

        await tracker.waitFor((state) => state?.phase === 'card_open' || state?.phase === 'trivia_all', 22000);
        assert.ok(['card_open', 'trivia_all'].includes(tracker.state.phase));
    } finally {
        await setup.cleanup();
    }
});
