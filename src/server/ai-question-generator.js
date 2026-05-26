/* eslint-disable @typescript-eslint/no-require-imports */

const { QUESTION_CATEGORY_OPTIONS } = require('./config');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_AI_MODEL = 'gpt-5-mini';

function isOpenAiConfigured() {
    return !!process.env.OPENAI_API_KEY;
}

function getOutputText(responsePayload) {
    if (typeof responsePayload?.output_text === 'string') return responsePayload.output_text;
    const parts = [];
    for (const output of responsePayload?.output || []) {
        for (const content of output?.content || []) {
            if (typeof content?.text === 'string') parts.push(content.text);
        }
    }
    return parts.join('\n').trim();
}

function buildQuestionSchema(categories) {
    const safeCategories = categories.length > 0 ? categories : QUESTION_CATEGORY_OPTIONS;
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            questions: {
                type: 'array',
                minItems: 1,
                maxItems: 20,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        text: { type: 'string' },
                        options: {
                            type: 'array',
                            minItems: 4,
                            maxItems: 4,
                            items: { type: 'string' },
                        },
                        correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
                        category: { type: 'string', enum: safeCategories },
                        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                        timeLimit: { type: 'integer', minimum: 8, maximum: 20 },
                        questionType: { type: 'string', enum: ['correct_choice', 'vibe_choice'] },
                    },
                    required: ['text', 'options', 'correctIndex', 'category', 'difficulty', 'timeLimit', 'questionType'],
                },
            },
        },
        required: ['questions'],
    };
}

function buildGenerationPrompt({ count, categories, theme, existingQuestions }) {
    const existingList = (existingQuestions || [])
        .slice(0, 60)
        .map((question, index) => `${index + 1}. ${question.text}`)
        .join('\n');

    return [
        'Gere perguntas em PT-BR para um party game chamado Caixa Misteriosa.',
        `Quantidade desejada: ${count}.`,
        `Categorias permitidas: ${categories.join(', ')}.`,
        theme ? `Tema extra do lote: ${theme}.` : 'Tema extra do lote: humor brasileiro leve, internet, familia, nostalgia e cotidiano.',
        '',
        'Estilo obrigatorio:',
        '- Perguntas curtas, divertidas e faceis de entender em voz alta.',
        '- Deve parecer mesa de amigos, grupo de familia, internet brasileira, comida, TV, games ou role.',
        '- Evite conteudo ofensivo, sexual, politico pesado, tragedias, ataques a grupos ou fatos muito recentes.',
        '- Cada pergunta deve ter 4 alternativas.',
        '- correctIndex deve apontar para a alternativa mais esperada, obvia ou editorialmente engraçada.',
        '- Use questionType "correct_choice" para fato objetivo e "vibe_choice" para humor/opiniao editorial.',
        '- Nao repita estrutura, piada, resposta ou ideia das perguntas existentes.',
        '',
        existingList ? `Perguntas existentes para evitar:\n${existingList}` : 'Nao ha perguntas existentes no contexto.',
    ].join('\n');
}

async function generateQuestionsWithOpenAI({ count = 8, categories = ['internet'], theme = '', existingQuestions = [] } = {}) {
    if (!isOpenAiConfigured()) {
        const error = new Error('OPENAI_API_KEY nao configurada');
        error.code = 'OPENAI_NOT_CONFIGURED';
        throw error;
    }

    const safeCount = Math.max(1, Math.min(20, Number(count) || 8));
    const safeCategories = categories
        .map((category) => String(category || '').trim().toLowerCase())
        .filter((category) => QUESTION_CATEGORY_OPTIONS.includes(category));
    const resolvedCategories = safeCategories.length > 0 ? safeCategories : ['internet'];
    const model = process.env.OPENAI_MODEL || DEFAULT_AI_MODEL;

    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            input: [
                {
                    role: 'developer',
                    content: 'Voce cria conteudo de quiz em PT-BR. Responda apenas com JSON valido no schema pedido.',
                },
                {
                    role: 'user',
                    content: buildGenerationPrompt({
                        count: safeCount,
                        categories: resolvedCategories,
                        theme,
                        existingQuestions,
                    }),
                },
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'gamebox_fun_questions',
                    schema: buildQuestionSchema(resolvedCategories),
                    strict: true,
                },
            },
            max_output_tokens: 4000,
        }),
    });

    const payload = await response.json();
    if (!response.ok) {
        const error = new Error(payload?.error?.message || 'Falha ao gerar perguntas com IA');
        error.code = 'OPENAI_REQUEST_FAILED';
        throw error;
    }

    const outputText = getOutputText(payload);
    const parsed = JSON.parse(outputText);
    return {
        model,
        questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
    };
}

module.exports = {
    DEFAULT_AI_MODEL,
    generateQuestionsWithOpenAI,
    isOpenAiConfigured,
};
