/* eslint-disable @typescript-eslint/no-require-imports */
const { registerBoardHandlers } = require('./handlers/board-handlers');
const { registerDisconnectHandler } = require('./handlers/disconnect-handler');
const { registerDuelHandlers } = require('./handlers/duel-handlers');
const { registerGameplayHandlers } = require('./handlers/gameplay-handlers');
const { registerLobbyHandlers } = require('./handlers/lobby-handlers');
const { registerTriviaHandlers } = require('./handlers/trivia-handlers');
const { registerWildcardHandlers } = require('./handlers/wildcard-handlers');

// Registers all socket events grouped by game domain.
function registerSocketHandlers(context) {
    registerLobbyHandlers(context);
    registerGameplayHandlers(context);
    registerTriviaHandlers(context);
    registerBoardHandlers(context);
    registerDuelHandlers(context);
    registerWildcardHandlers(context);
    registerDisconnectHandler(context);
}

module.exports = {
    registerSocketHandlers,
};
