const MIN_PLAYERS_TO_START = 3;
const MAX_PLAYERS_PER_ROOM = 8;
const DEFAULT_MAX_ROUNDS = 30;
const DEFAULT_MAX_CHANCES = 3;
const DEFAULT_TRIVIA_WIN_POINTS = 10;
const DEFAULT_DUEL_WIN_POINTS = 120;
const DEFAULT_DUEL_SELECT_TIMEOUT_MS = 8000;
const DEFAULT_RANKING_TIMEOUT_MS = 25000;
const DEFAULT_WILDCARD_FREQUENCY = 2;
const CARD_SOLVE_BONUS_PER_CHANCE = 25;
const BOT_TRIVIA_ACCURACY = 0.62;
const BOT_DUEL_ACCURACY = 0.58;
const QUESTION_FETCH_AMOUNT = 120;
const FAST_MODE = process.env.GAMEBOX_TEST_FAST === '1';

const QUESTION_CATEGORY_OPTIONS = [
    'geral',
    'ciencia',
    'historia',
    'geografia',
    'arte',
    'musica',
    'tech',
    'esportes',
    'entretenimento',
    'internet',
    'memes',
    'familia',
    'nostalgia',
    'brasil',
    'comida',
    'tv',
    'games',
    'role',
    'pegadinha',
];

// Centralized runtime knobs used by the game server.
module.exports = {
    BOT_DUEL_ACCURACY,
    BOT_TRIVIA_ACCURACY,
    DEFAULT_DUEL_SELECT_TIMEOUT_MS,
    DEFAULT_DUEL_WIN_POINTS,
    DEFAULT_MAX_CHANCES,
    DEFAULT_MAX_ROUNDS,
    DEFAULT_RANKING_TIMEOUT_MS,
    DEFAULT_TRIVIA_WIN_POINTS,
    DEFAULT_WILDCARD_FREQUENCY,
    FAST_MODE,
    CARD_SOLVE_BONUS_PER_CHANCE,
    MAX_PLAYERS_PER_ROOM,
    MIN_PLAYERS_TO_START,
    QUESTION_CATEGORY_OPTIONS,
    QUESTION_FETCH_AMOUNT,
};
