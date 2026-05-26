import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import questions from '../src/server/questions.js';
import { flattenQuestions, validateQuestions } from '../scripts/question-content-utils.mjs';
import contentUtils from '../src/server/question-content-utils.js';

test('fun categories are accepted by question catalog', () => {
    const catalog = questions.buildQuestionCatalog(
        { questionCategories: ['internet'] },
        [
            {
                id: 'internet_fun',
                text: 'Qual frase parece mais status de internet?',
                options: ['Hoje tem', 'Planilha', 'Contrato', 'Recibo'],
                correctIndex: 0,
                category: 'internet',
                difficulty: 'easy',
                timeLimit: 12,
            },
            {
                id: 'classic',
                text: 'Qual e o maior planeta?',
                options: ['Terra', 'Marte', 'Jupiter', 'Saturno'],
                correctIndex: 2,
                category: 'ciencia',
                difficulty: 'easy',
                timeLimit: 12,
            },
        ],
    );

    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].id, 'internet_fun');
});

test('sample fun question seed content is valid', async () => {
    const payload = JSON.parse(await readFile(new URL('../content/questions.sample.pt-BR.json', import.meta.url), 'utf8'));
    const questionsPayload = flattenQuestions(payload);
    const errors = validateQuestions(questionsPayload);

    assert.equal(questionsPayload.length > 0, true);
    assert.deepEqual(errors, []);
});

test('question review rejects semantically similar prompts', () => {
    const existing = [
        {
            id: 'familia_existing',
            text: 'Qual dessas mensagens tem mais energia de grupo da familia no WhatsApp?',
            options: ['Bom dia com flores', 'Relatorio', 'Reuniao', 'Deploy'],
            correctIndex: 0,
            category: 'familia',
            status: 'active',
        },
    ];

    const generated = [
        {
            text: 'Qual mensagem tem mais cara de grupo da familia no WhatsApp?',
            options: ['Bom dia com glitter', 'Contrato revisado', 'Ata enviada', 'Servidor atualizado'],
            correctIndex: 0,
            category: 'familia',
            difficulty: 'easy',
            timeLimit: 12,
            questionType: 'vibe_choice',
        },
        {
            text: 'Qual sinal mostra que o role foi planejado em cima da hora?',
            options: ['Bora ver na hora', 'Cronograma por minuto', 'Contrato assinado', 'Planilha impressa'],
            correctIndex: 0,
            category: 'role',
            difficulty: 'easy',
            timeLimit: 12,
            questionType: 'vibe_choice',
        },
    ];

    const review = contentUtils.reviewGeneratedQuestions({ generated, existing, threshold: 0.62 });

    assert.equal(review.accepted.length, 1);
    assert.equal(review.rejected.length, 1);
    assert.equal(review.rejected[0].reason, 'similar_question');
});
