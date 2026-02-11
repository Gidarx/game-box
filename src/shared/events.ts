export const EVENTS = {
  // Room
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_REJOIN: 'room:rejoin',
  ROOM_PLAYER_JOINED: 'room:playerJoined',
  ROOM_PLAYER_LEFT: 'room:playerLeft',
  ROOM_PLAYER_READY: 'room:playerReady',

  // Game flow
  GAME_START: 'game:start',
  GAME_STATE_SYNC: 'game:stateSync',
  GAME_PHASE_CHANGE: 'game:phaseChange',
  GAME_SETTINGS_UPDATE: 'game:settingsUpdate',
  HOST_FORCE_NEXT: 'host:forceNext',
  HOST_ADD_BOTS: 'host:addBots',
  HOST_CLEAR_BOTS: 'host:clearBots',

  // Trivia
  TRIVIA_QUESTION: 'trivia:question',
  TRIVIA_ANSWER: 'trivia:answer',
  TRIVIA_PLAYER_ANSWERED: 'trivia:playerAnswered',
  TRIVIA_RESULT: 'trivia:result',
  TRIVIA_FORCE_RESOLVE: 'trivia:forceResolve',

  // Box / ranking / cards
  BOX_SELECT: 'box:select',
  BOX_SELECTED: 'box:selected',
  BOX_REVEAL: 'box:reveal',
  RANKING_SHOW: 'ranking:show',
  RANKING_SUBMIT: 'ranking:submit',
  RANKING_RESULT: 'ranking:result',
  CARD_OPEN: 'card:open',
  CARD_OPENED: 'card:opened',
  CARD_GRID_STATE: 'card:gridState',

  // Duel
  DUEL_START: 'duel:start',
  DUEL_SELECT_OPPONENT: 'duel:selectOpponent',
  DUEL_ANSWER: 'duel:answer',
  DUEL_RESULT: 'duel:result',

  // Wildcard
  WILDCARD_DRAW: 'wildcard:draw',
  WILDCARD_APPLY: 'wildcard:apply',
  WILDCARD_EFFECT: 'wildcard:effect',
  WILDCARD_SKIP: 'wildcard:skip',

  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
} as const;
