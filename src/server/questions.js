/* eslint-disable @typescript-eslint/no-require-imports */
const { FAST_MODE, QUESTION_CATEGORY_OPTIONS } = require('./config');
const { fetchFirestoreQuestionDocuments } = require('./firebase-content');
const { generateId, shuffleArray } = require('./random');

function decodeHTML(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&eacute;/g, 'e')
        .replace(/&atilde;/g, 'a')
        .replace(/&ccedil;/g, 'c')
        .replace(/&oacute;/g, 'o')
        .replace(/&uacute;/g, 'u')
        .replace(/&iacute;/g, 'i')
        .replace(/&aacute;/g, 'a')
        .replace(/&otilde;/g, 'o')
        .replace(/&ecirc;/g, 'e')
        .replace(/&ocirc;/g, 'o');
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeQuestionCategory(category) {
    const raw = normalizeText(category);
    if (!raw) return 'geral';
    if (raw.includes('internet') || raw.includes('whatsapp') || raw.includes('rede social')) return 'internet';
    if (raw.includes('meme') || raw.includes('viral') || raw.includes('trend')) return 'memes';
    if (raw.includes('familia') || raw.includes('parente')) return 'familia';
    if (raw.includes('nostalgia') || raw.includes('anos 90') || raw.includes('anos 2000')) return 'nostalgia';
    if (raw.includes('brasil') || raw.includes('brasileiro') || raw.includes('cotidiano')) return 'brasil';
    if (raw.includes('comida') || raw.includes('lanche') || raw.includes('churrasco')) return 'comida';
    if (raw === 'tv' || raw.includes('televisao') || raw.includes('novela')) return 'tv';
    if (raw.includes('game') || raw.includes('jogo')) return 'games';
    if (raw.includes('role') || raw.includes('festa')) return 'role';
    if (raw.includes('pegadinha') || raw.includes('troll')) return 'pegadinha';
    if (raw.includes('science') || raw.includes('ciencia') || raw.includes('natureza')) return 'ciencia';
    if (raw.includes('history') || raw.includes('historia')) return 'historia';
    if (raw.includes('geography') || raw.includes('geografia')) return 'geografia';
    if (raw.includes('art') || raw.includes('arte')) return 'arte';
    if (raw.includes('music') || raw.includes('musica')) return 'musica';
    if (raw.includes('technology') || raw.includes('tech') || raw.includes('computer')) return 'tech';
    if (raw.includes('sport') || raw.includes('esporte') || raw.includes('football') || raw.includes('soccer')) return 'esportes';
    if (raw.includes('film') || raw.includes('movie') || raw.includes('tv') || raw.includes('entertainment') || raw.includes('celebr')) {
        return 'entretenimento';
    }
    return 'geral';
}

function sanitizeQuestionCategories(categories) {
    if (!Array.isArray(categories) || categories.length === 0) return ['all'];
    const normalized = [...new Set(
        categories
            .map((value) => normalizeText(value))
            .filter((value) => value === 'all' || QUESTION_CATEGORY_OPTIONS.includes(value))
    )];
    if (normalized.length === 0) return ['all'];
    if (normalized.includes('all')) return ['all'];
    return normalized;
}

function shouldIncludeQuestionByCategory(question, selectedCategories) {
    const categories = sanitizeQuestionCategories(selectedCategories);
    if (categories.includes('all')) return true;
    const questionCategory = normalizeQuestionCategory(question?.category);
    return categories.includes(questionCategory);
}

function normalizeDifficulty(value) {
    const raw = normalizeText(value);
    if (raw.startsWith('hard') || raw === 'dificil') return 'hard';
    if (raw.startsWith('easy') || raw === 'facil') return 'easy';
    return 'medium';
}

function getTargetDifficultyForRound(round) {
    if (round <= 4) return 'easy';
    if (round <= 10) return 'medium';
    return 'hard';
}

function getDifficultyPreferenceOrder(targetDifficulty) {
    if (targetDifficulty === 'easy') return ['easy', 'medium', 'hard'];
    if (targetDifficulty === 'hard') return ['hard', 'medium', 'easy'];
    return ['medium', 'hard', 'easy'];
}

function questionSignature(question) {
    const text = normalizeText(question?.text);
    const options = Array.isArray(question?.options)
        ? question.options.map((option) => normalizeText(option)).join('|')
        : '';
    return `${text}::${options}`;
}

function normalizeQuestionPayload(question, sourceTag = 'fallback') {
    if (!question || !Array.isArray(question.options) || question.options.length < 2) return null;
    const correctIndex = Number(question.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= question.options.length) return null;

    const difficulty = normalizeDifficulty(question.difficulty);
    const baseTimeLimit = Number(question.timeLimit)
        || (difficulty === 'hard' ? 15 : difficulty === 'easy' ? 10 : 12);
    const timeLimit = FAST_MODE ? Math.max(4, Math.min(baseTimeLimit, 7)) : baseTimeLimit;

    const normalized = {
        id: String(question.id || `${sourceTag}_${generateId()}`),
        text: String(question.text || '').trim(),
        options: question.options.map((option) => String(option)),
        correctIndex,
        category: String(question.category || 'Geral'),
        difficulty,
        timeLimit,
    };
    normalized.signature = questionSignature(normalized);
    return normalized;
}

function buildQuestionCatalog(room, questions) {
    const selectedCategories = room.questionCategories || ['all'];
    const seen = new Set();
    const catalog = [];

    for (const question of questions || []) {
        if (!shouldIncludeQuestionByCategory(question, selectedCategories)) continue;
        const normalized = normalizeQuestionPayload(question, 'catalog');
        if (!normalized || !normalized.signature) continue;
        if (seen.has(normalized.signature)) continue;
        seen.add(normalized.signature);
        catalog.push(normalized);
    }
    return catalog;
}

function getFallbackQuestions() {
    return [
        { id: 'q1', text: 'Qual é o maior planeta do sistema solar?', options: ['Terra', 'Marte', 'Júpiter', 'Saturno'], correctIndex: 2, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q2', text: 'Em que ano o Brasil foi descoberto?', options: ['1492', '1500', '1510', '1498'], correctIndex: 1, category: 'História', difficulty: 'easy', timeLimit: 10 },
        { id: 'q3', text: 'Qual é a capital da Austrália?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correctIndex: 2, category: 'Geografia', difficulty: 'medium', timeLimit: 12 },
        { id: 'q4', text: 'Quantos ossos tem o corpo humano adulto?', options: ['186', '206', '216', '196'], correctIndex: 1, category: 'Ciência', difficulty: 'medium', timeLimit: 12 },
        { id: 'q5', text: "Qual é o elemento químico 'Au'?", options: ['Prata', 'Alumínio', 'Ouro', 'Argônio'], correctIndex: 2, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q6', text: 'Quem pintou a Mona Lisa?', options: ['Michelangelo', 'Da Vinci', 'Rafael', 'Donatello'], correctIndex: 1, category: 'Arte', difficulty: 'easy', timeLimit: 10 },
        { id: 'q7', text: 'Qual é o rio mais longo do mundo?', options: ['Amazonas', 'Nilo', 'Mississipi', 'Yangtze'], correctIndex: 0, category: 'Geografia', difficulty: 'medium', timeLimit: 12 },
        { id: 'q8', text: 'Quantas cordas tem um violão?', options: ['4', '5', '6', '7'], correctIndex: 2, category: 'Música', difficulty: 'easy', timeLimit: 10 },
        { id: 'q9', text: 'Qual país tem forma de bota?', options: ['Grécia', 'Portugal', 'Itália', 'Espanha'], correctIndex: 2, category: 'Geografia', difficulty: 'easy', timeLimit: 10 },
        { id: 'q10', text: 'Fórmula química da água?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correctIndex: 1, category: 'Ciência', difficulty: 'easy', timeLimit: 10 },
        { id: 'q11', text: 'Ano da 1ª pisada na Lua?', options: ['1965', '1967', '1969', '1971'], correctIndex: 2, category: 'História', difficulty: 'easy', timeLimit: 10 },
        { id: 'q12', text: 'Criador do JavaScript?', options: ['Guido van Rossum', 'James Gosling', 'Brendan Eich', 'Bjarne Stroustrup'], correctIndex: 2, category: 'Tech', difficulty: 'medium', timeLimit: 12 },
    ];
}

// Tryvia is optional; if it fails we transparently fall back to the local catalog.
async function fetchTryviaQuestions(amount = 30, categories = ['all']) {
    const shouldUseFallbackOnly = process.env.DISABLE_TRYVIA === '1';
    if (shouldUseFallbackOnly) {
        return buildQuestionCatalog({ questionCategories: categories }, getFallbackQuestions());
    }

    try {
        const tokenRes = await fetch('https://tryvia.ptr.red/api_token.php?command=request');
        const tokenData = await tokenRes.json();
        const token = tokenData.token || '';
        const url = `https://tryvia.ptr.red/api.php?amount=${amount}&type=multiple&token=${token}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.response_code === 0 && data.results) {
            const filtered = data.results.filter((question) =>
                !question.category?.toLowerCase().includes('anime')
                && !question.category?.toLowerCase().includes('manga')
            );
            const mapped = filtered.map((question, index) => {
                const options = shuffleArray([question.correct_answer, ...question.incorrect_answers]);
                const mappedQuestion = {
                    id: `tryvia_${index}_${Date.now()}`,
                    text: decodeHTML(question.question),
                    options: options.map((option) => decodeHTML(option)),
                    correctIndex: options.indexOf(question.correct_answer),
                    category: question.category || 'Geral',
                    difficulty: normalizeDifficulty(question.difficulty || 'medium'),
                    timeLimit: question.difficulty === 'hard' ? 15 : question.difficulty === 'easy' ? 10 : 12,
                };
                return normalizeQuestionPayload(mappedQuestion, 'tryvia');
            });

            const withCategories = mapped
                .filter(Boolean)
                .filter((question) => shouldIncludeQuestionByCategory(question, categories));
            if (withCategories.length > 0) {
                return withCategories;
            }
        }
    } catch (error) {
        console.error('[Tryvia] Falha:', error.message);
    }

    return buildQuestionCatalog({ questionCategories: categories }, getFallbackQuestions());
}

async function fetchFirestoreQuestions(amount = 120, categories = ['all']) {
    const rawQuestions = await fetchFirestoreQuestionDocuments({ limit: Math.min(500, Math.max(amount, amount * 4)) });
    if (rawQuestions.length === 0) return [];
    return buildQuestionCatalog({ questionCategories: categories }, rawQuestions).slice(0, amount);
}

// Picks next question using pool reuse and target difficulty by round.
function getNextQuestion(room) {
    if (!Array.isArray(room._questionCatalog) || room._questionCatalog.length === 0) {
        room._questionCatalog = buildQuestionCatalog(room, getFallbackQuestions());
    }
    if (!room._usedQuestionSignatures || typeof room._usedQuestionSignatures.has !== 'function') {
        room._usedQuestionSignatures = new Set();
    }

    if (!Array.isArray(room._questionPool) || room._questionPool.length === 0) {
        const unseen = room._questionCatalog.filter((question) => !room._usedQuestionSignatures.has(question.signature));
        if (unseen.length === 0) {
            room._usedQuestionSignatures.clear();
            room._questionPool = shuffleArray([...room._questionCatalog]);
        } else {
            room._questionPool = shuffleArray(unseen);
        }
    }

    const targetDifficulty = getTargetDifficultyForRound(room.round || 1);
    const difficultyOrder = getDifficultyPreferenceOrder(targetDifficulty);

    let selectedIndex = -1;
    for (const difficulty of difficultyOrder) {
        selectedIndex = room._questionPool.findIndex((question) => normalizeDifficulty(question?.difficulty) === difficulty);
        if (selectedIndex >= 0) break;
    }
    if (selectedIndex < 0) {
        selectedIndex = 0;
    }

    let [question] = room._questionPool.splice(selectedIndex, 1);
    if (!question) {
        const fallback = normalizeQuestionPayload(getFallbackQuestions()[0], 'fallback');
        question = fallback || {
            id: `fallback_${generateId()}`,
            text: 'Pergunta indisponivel',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            category: 'Geral',
            difficulty: 'easy',
            timeLimit: FAST_MODE ? 4 : 10,
            signature: `fallback_${generateId()}`,
        };
    }

    room._usedQuestionSignatures.add(question.signature);
    room.currentQuestion = question;
    return question;
}

module.exports = {
    buildQuestionCatalog,
    fetchFirestoreQuestions,
    fetchTryviaQuestions,
    getFallbackQuestions,
    getNextQuestion,
    sanitizeQuestionCategories,
};
