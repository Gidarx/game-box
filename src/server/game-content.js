/* eslint-disable @typescript-eslint/no-require-imports */

const { shuffleArray } = require('./random');

const KEYWORD_BANK = {
    tech: ['processador', 'tela', 'bateria', 'pixel', 'memoria', 'codigo', 'algoritmo', 'servidor', 'nuvem', 'bluetooth', 'wifi', 'chip', 'app', 'dados', 'cache', 'firmware', 'debug', 'render', 'driver', 'kernel'],
    viagem: ['passaporte', 'mala', 'embarque', 'aeroporto', 'hotel', 'roteiro', 'destino', 'turismo', 'bilhete', 'voo', 'escala', 'alfandega', 'cambio', 'itinerario', 'cruzeiro', 'mochila', 'check-in', 'resort', 'aventura'],
    meme: ['viral', 'trend', 'repost', 'emoji', 'sticker', 'filtro', 'hashtag', 'curtida', 'compartilhar', 'story', 'feed', 'reel', 'meme', 'gif', 'troll', 'reaction', 'follow', 'engajar'],
    experiencia: ['adrenalina', 'aventura', 'imersao', 'emocao', 'surpresa', 'radicais', 'mergulho', 'salto', 'escalar', 'explorar', 'acampar', 'trilha', 'rapel', 'surfar', 'voar', 'correr', 'navegar'],
    misterio: ['enigma', 'segredo', 'pista', 'codigo', 'chave', 'cifra', 'sombra', 'labirinto', 'detetive', 'misterio', 'oculto', 'escondido', 'revelacao', 'investigacao', 'suspeito'],
    pegadinha: ['trollagem', 'surpresa', 'armadilha', 'piada', 'susto', 'blefe', 'aposta', 'risco', 'perigo', 'engano', 'falsificacao', 'rasteira', 'sabotagem', 'truque', 'cilada'],
};

const DECOY_BANK = [
    'abacaxi', 'dinossauro', 'terremoto', 'poltrona', 'esfinge', 'vulcao', 'saxofone', 'pergaminho',
    'besouro', 'piramide', 'relogio', 'telescopio', 'origami', 'cachoeira', 'cogumelo', 'fantasia',
    'domino', 'caravela', 'beterraba', 'caleidoscopio', 'gargula', 'sanfona', 'tridente', 'catapulta',
    'constelacao', 'papiro', 'ancora', 'palhaco', 'xadrez', 'borboleta', 'diamante', 'trovao',
    'espada', 'ampulheta', 'lanterna', 'caverna', 'lagartixa', 'macarrao', 'girassol', 'foguete',
    'tornado', 'paraquedas', 'bussola', 'canguru', 'samurai', 'iceberg', 'violeta', 'camaleao',
];

// Builds a 12-card grid: 3 keys, 7 distractors, 1 lost_turn, 1 duel.
function generateCardGrid(box) {
    const type = box.type || 'misterio';
    const keywords = KEYWORD_BANK[type] || KEYWORD_BANK.misterio;
    const keys = shuffleArray(keywords).slice(0, 3);
    const availableDecoys = DECOY_BANK.filter((word) => !keys.includes(word));
    const decoys = shuffleArray(availableDecoys).slice(0, 7);

    const cards = [
        ...keys.map((word) => ({ word, type: 'key' })),
        ...decoys.map((word) => ({ word, type: 'distractor' })),
        { word: 'PERDEU A VEZ!', type: 'lost_turn' },
        { word: 'DUELO!', type: 'duel' },
    ];

    return shuffleArray(cards).map((card, index) => ({
        id: index + 1,
        word: card.word,
        type: card.type,
        status: 'hidden',
    }));
}

// Hides unrevealed words/types before broadcasting to clients.
function getPublicGrid(cardGrid) {
    return (cardGrid || []).map((card) => ({
        id: card.id,
        status: card.status,
        word: card.status !== 'hidden' ? card.word : null,
        type: card.status !== 'hidden' ? card.type : null,
    }));
}

// Master list of prize boxes used to initialize each room.
function getDefaultBoxes() {
    return [
        { id: 1, prizeLabel: 'Caixa Tech', points: 200, rarity: 'comum', risk: 'baixo', type: 'tech', icon: 'devices' },
        { id: 2, prizeLabel: 'Caixa Meme', points: 150, rarity: 'comum', risk: 'baixo', type: 'meme', icon: 'sentiment_very_satisfied' },
        { id: 3, prizeLabel: 'Caixa Viagem', points: 500, rarity: 'raro', risk: 'medio', type: 'viagem', icon: 'flight_takeoff' },
        { id: 4, prizeLabel: 'Caixa Misterio', points: 300, rarity: 'comum', risk: 'medio', type: 'misterio', icon: 'help_center' },
        { id: 5, prizeLabel: 'Caixa Experiencia', points: 350, rarity: 'raro', risk: 'medio', type: 'experiencia', icon: 'local_activity' },
        { id: 6, prizeLabel: 'Caixa Pegadinha', points: -50, rarity: 'comum', risk: 'alto', type: 'pegadinha', icon: 'warning' },
        { id: 7, prizeLabel: 'Caixa Tech Pro', points: 400, rarity: 'raro', risk: 'medio', type: 'tech', icon: 'computer' },
        { id: 8, prizeLabel: 'Caixa Meme Gold', points: 250, rarity: 'comum', risk: 'baixo', type: 'meme', icon: 'emoji_events' },
        { id: 9, prizeLabel: 'Caixa Surpresa', points: 100, rarity: 'comum', risk: 'alto', type: 'misterio', icon: 'redeem' },
        { id: 10, prizeLabel: 'Caixa Aventura', points: 450, rarity: 'raro', risk: 'medio', type: 'experiencia', icon: 'explore' },
        { id: 11, prizeLabel: 'Caixa Lendaria', points: 1000, rarity: 'lendario', risk: 'alto', type: 'experiencia', icon: 'auto_awesome' },
        { id: 12, prizeLabel: 'Caixa Viagem VIP', points: 800, rarity: 'lendario', risk: 'alto', type: 'viagem', icon: 'flight' },
        { id: 13, prizeLabel: 'A Caixa Final', points: 500, rarity: 'lendario', risk: 'alto', type: 'misterio', icon: 'diamond', multiplier: 2 },
    ];
}

module.exports = {
    generateCardGrid,
    getDefaultBoxes,
    getPublicGrid,
};
