/* eslint-disable @typescript-eslint/no-require-imports */

const { shuffleArray } = require('./random');

const KEYWORD_BANK = {
    tech: [
        ['CODIGO', 'NA', 'NUVEM'],
        ['APP', 'NO', 'CELULAR'],
        ['DADOS', 'DO', 'SERVIDOR'],
    ],
    viagem: [
        ['PASSAGEM', 'DE', 'AVIAO'],
        ['MALA', 'DE', 'VIAGEM'],
        ['CHECKIN', 'NO', 'HOTEL'],
    ],
    meme: [
        ['VIDEO', 'VIRA', 'MEME'],
        ['POST', 'COM', 'TREND'],
        ['STICKER', 'NO', 'GRUPO'],
    ],
    experiencia: [
        ['SALTO', 'DE', 'PARAQUEDAS'],
        ['TRILHA', 'NA', 'MONTANHA'],
        ['MERGULHO', 'NO', 'MAR'],
    ],
    misterio: [
        ['PISTA', 'DO', 'ENIGMA'],
        ['CHAVE', 'DO', 'COFRE'],
        ['SEGREDO', 'DO', 'CASO'],
    ],
    pegadinha: [
        ['RISADA', 'DA', 'PEGADINHA'],
        ['SUSTO', 'NO', 'PALCO'],
        ['TROLAGEM', 'DO', 'AMIGO'],
    ],
};

const DECOY_BANK = [
    'abacaxi', 'dinossauro', 'terremoto', 'poltrona', 'esfinge', 'vulcao', 'saxofone', 'pergaminho',
    'besouro', 'piramide', 'relogio', 'telescopio', 'origami', 'cachoeira', 'cogumelo', 'fantasia',
    'domino', 'caravela', 'beterraba', 'caleidoscopio', 'gargula', 'sanfona', 'tridente', 'catapulta',
    'constelacao', 'papiro', 'ancora', 'palhaco', 'xadrez', 'borboleta', 'diamante', 'trovao',
    'espada', 'ampulheta', 'lanterna', 'caverna', 'lagartixa', 'macarrao', 'girassol', 'foguete',
    'tornado', 'paraquedas', 'bussola', 'canguru', 'samurai', 'iceberg', 'violeta', 'camaleao',
];

// Builds a 12-card grid with 3 thematic keyword cards and special risk cards.
function generateCardGrid(box) {
    const type = box.type || 'misterio';
    const phraseBank = KEYWORD_BANK[type] || KEYWORD_BANK.misterio;
    const selectedPhrase = phraseBank[Math.floor(Math.random() * phraseBank.length)] || phraseBank[0];
    const keys = (selectedPhrase || ['CHAVE', 'DO', 'PREMIO']).slice(0, 3);
    const availableDecoys = DECOY_BANK.filter((word) => !keys.includes(word));
    const decoys = shuffleArray(availableDecoys).slice(0, 7);

    const cards = [
        ...keys.map((word) => ({ word, type: 'key' })),
        ...decoys.map((word) => ({ word, type: 'distractor' })),
        { word: 'PERDEU A VEZ', type: 'lost_turn' },
        { word: 'DUELO', type: 'duel' },
    ];

    return shuffleArray(cards).map((card, index) => ({
        id: index + 1,
        word: card.word,
        type: card.type,
        status: 'hidden',
        tested: false,
    }));
}

// Hides unrevealed words/types before broadcasting to clients.
function getPublicGrid(cardGrid) {
    return (cardGrid || []).map((card) => ({
        id: card.id,
        status: card.status,
        word: card.status !== 'hidden' ? card.word : null,
        type: card.status === 'locked' || card.tested ? card.type : null,
        tested: !!card.tested,
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
