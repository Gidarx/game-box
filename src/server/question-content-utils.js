/* eslint-disable @typescript-eslint/no-require-imports */

const { QUESTION_CATEGORY_OPTIONS } = require('./config');
const { generateId } = require('./random');

const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'facil', 'medio', 'dificil']);
const ALLOWED_STATUSES = new Set(['active', 'draft', 'rejected']);
const ALLOWED_QUESTION_TYPES = new Set(['correct_choice', 'vibe_choice']);
const DEFAULT_SIMILARITY_THRESHOLD = 0.74;

const STOPWORDS = new Set([
    'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'dessa', 'desse',
    'essa', 'esse',
    'essas', 'esses', 'esta', 'este', 'mais', 'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'por',
    'qual', 'quando', 'que', 'se', 'tem', 'um', 'uma', 'voce', 'cara', 'energia', 'opcao', 'opcoes',
    'frase', 'frases', 'tipo',
]);

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function flattenQuestions(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    return Object.values(payload).flatMap((value) => Array.isArray(value) ? value : []);
}

function getContentTokens(value) {
    return normalizeText(value)
        .split(' ')
        .map((token) => {
            if (token.endsWith('gens') && token.length > 6) return `${token.slice(0, -3)}em`;
            if (token.endsWith('oes') && token.length > 5) return `${token.slice(0, -3)}ao`;
            if (token.endsWith('ns') && token.length > 4) return token.slice(0, -1);
            if (token.endsWith('es') && token.length > 5) return token.slice(0, -2);
            if (token.endsWith('s') && token.length > 4) return token.slice(0, -1);
            return token;
        })
        .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function getNgrams(value, size = 3) {
    const normalized = normalizeText(value).replace(/\s/g, '');
    if (normalized.length <= size) return normalized ? [normalized] : [];
    const grams = [];
    for (let index = 0; index <= normalized.length - size; index++) {
        grams.push(normalized.slice(index, index + size));
    }
    return grams;
}

function jaccardSimilarity(leftValues, rightValues) {
    const left = new Set(leftValues);
    const right = new Set(rightValues);
    if (left.size === 0 && right.size === 0) return 1;
    if (left.size === 0 || right.size === 0) return 0;

    let intersection = 0;
    for (const value of left) {
        if (right.has(value)) intersection++;
    }
    return intersection / (left.size + right.size - intersection);
}

function getQuestionSimilarity(left, right) {
    const leftText = typeof left === 'string' ? left : left?.text;
    const rightText = typeof right === 'string' ? right : right?.text;
    const normalizedLeft = normalizeText(leftText);
    const normalizedRight = normalizeText(rightText);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;

    const shortest = Math.min(normalizedLeft.length, normalizedRight.length);
    if (shortest > 24 && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))) {
        return 0.94;
    }

    const tokenScore = jaccardSimilarity(getContentTokens(normalizedLeft), getContentTokens(normalizedRight));
    const ngramScore = jaccardSimilarity(getNgrams(normalizedLeft), getNgrams(normalizedRight));
    return Math.max(tokenScore, (tokenScore * 0.65) + (ngramScore * 0.35));
}

function normalizeQuestionForStorage(question, defaults = {}) {
    const status = normalizeText(question.status || defaults.status || 'draft');
    const category = normalizeText(question.category || defaults.category || 'geral');
    const difficulty = normalizeText(question.difficulty || defaults.difficulty || 'easy');
    const questionType = question.questionType || defaults.questionType || 'vibe_choice';

    return {
        ...question,
        id: String(question.id || defaults.id || `ai_${Date.now()}_${generateId()}`),
        text: String(question.text || '').trim(),
        options: Array.isArray(question.options) ? question.options.map((option) => String(option).trim()) : [],
        correctIndex: Number(question.correctIndex),
        category,
        difficulty,
        timeLimit: Math.max(6, Math.min(30, Number(question.timeLimit) || 12)),
        status: ALLOWED_STATUSES.has(status) ? status : 'draft',
        locale: question.locale || defaults.locale || 'pt-BR',
        source: question.source || defaults.source || 'ai',
        style: question.style || defaults.style || 'fun',
        questionType: ALLOWED_QUESTION_TYPES.has(questionType) ? questionType : 'vibe_choice',
        updatedAt: new Date().toISOString(),
    };
}

function validateQuestionShape(question, index = 0) {
    const errors = [];
    const prefix = `question[${index}]`;
    const text = String(question?.text || '').trim();
    const options = Array.isArray(question?.options) ? question.options.map((option) => String(option).trim()) : [];
    const category = normalizeText(question?.category || '');
    const difficulty = normalizeText(question?.difficulty || 'easy');
    const correctIndex = Number(question?.correctIndex);
    const status = question?.status ? normalizeText(question.status) : 'draft';
    const questionType = question?.questionType || 'vibe_choice';

    if (!question || typeof question !== 'object') errors.push(`${prefix}: deve ser objeto`);
    if (!text) errors.push(`${prefix}: text obrigatorio`);
    if (options.length !== 4) errors.push(`${prefix}: options deve ter exatamente 4 itens`);
    if (options.some((option) => !option)) errors.push(`${prefix}: options nao pode ter item vazio`);
    if (new Set(options.map(normalizeText)).size !== options.length) errors.push(`${prefix}: options tem alternativas duplicadas`);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        errors.push(`${prefix}: correctIndex invalido`);
    }
    if (!QUESTION_CATEGORY_OPTIONS.includes(category)) errors.push(`${prefix}: category invalida (${category || 'vazia'})`);
    if (!ALLOWED_DIFFICULTIES.has(difficulty)) errors.push(`${prefix}: difficulty invalida (${difficulty})`);
    if (!ALLOWED_STATUSES.has(status)) errors.push(`${prefix}: status invalido (${status})`);
    if (!ALLOWED_QUESTION_TYPES.has(questionType)) errors.push(`${prefix}: questionType invalido (${questionType})`);

    return errors;
}

function validateQuestions(questions) {
    const errors = [];
    const seenText = new Set();

    flattenQuestions(questions).forEach((question, index) => {
        const textKey = normalizeText(question?.text || '');
        if (textKey && seenText.has(textKey)) {
            errors.push(`question[${index}]: pergunta duplicada`);
        }
        if (textKey) seenText.add(textKey);
        errors.push(...validateQuestionShape(question, index));
    });

    return errors;
}

function findSimilarQuestion(question, candidates, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates || []) {
        const score = getQuestionSimilarity(question, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    if (bestScore >= threshold) {
        return {
            question: bestMatch,
            score: Number(bestScore.toFixed(3)),
        };
    }
    return null;
}

function reviewGeneratedQuestions({ generated, existing = [], threshold = DEFAULT_SIMILARITY_THRESHOLD, defaults = {} }) {
    const accepted = [];
    const rejected = [];
    const comparisonPool = [...existing];

    flattenQuestions(generated).forEach((rawQuestion, index) => {
        const normalized = normalizeQuestionForStorage(rawQuestion, defaults);
        const shapeErrors = validateQuestionShape(normalized, index);
        if (shapeErrors.length > 0) {
            rejected.push({
                question: normalized,
                reason: 'invalid_shape',
                details: shapeErrors,
            });
            return;
        }

        const similar = findSimilarQuestion(normalized, comparisonPool, threshold);
        if (similar) {
            rejected.push({
                question: normalized,
                reason: 'similar_question',
                similarity: similar.score,
                similarTo: {
                    id: similar.question?.id || null,
                    text: similar.question?.text || '',
                    category: similar.question?.category || '',
                    status: similar.question?.status || '',
                },
            });
            return;
        }

        accepted.push(normalized);
        comparisonPool.push(normalized);
    });

    return { accepted, rejected };
}

module.exports = {
    ALLOWED_DIFFICULTIES,
    ALLOWED_QUESTION_TYPES,
    ALLOWED_STATUSES,
    DEFAULT_SIMILARITY_THRESHOLD,
    findSimilarQuestion,
    flattenQuestions,
    getQuestionSimilarity,
    normalizeQuestionForStorage,
    normalizeText,
    reviewGeneratedQuestions,
    validateQuestionShape,
    validateQuestions,
};
