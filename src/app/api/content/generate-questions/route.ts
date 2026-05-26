/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';

const { QUESTION_CATEGORY_OPTIONS } = require('@/server/config');
const { generateQuestionsWithOpenAI, isOpenAiConfigured } = require('@/server/ai-question-generator');
const { getFirebaseDb, isFirebaseEnabled } = require('@/server/firebase-admin');
const { listFirestoreQuestions, saveFirestoreQuestions } = require('@/server/firebase-content');
const { DEFAULT_SIMILARITY_THRESHOLD, reviewGeneratedQuestions } = require('@/server/question-content-utils');

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const count = Math.max(1, Math.min(20, Number(body?.count) || 8));
    const categories = Array.isArray(body?.categories)
        ? body.categories
            .map((category: unknown) => String(category || '').trim().toLowerCase())
            .filter((category: string) => QUESTION_CATEGORY_OPTIONS.includes(category))
        : ['internet'];
    const resolvedCategories = categories.length > 0 ? categories : ['internet'];
    const theme = String(body?.theme || '').trim().slice(0, 220);
    const threshold = Number(process.env.QUESTION_SIMILARITY_THRESHOLD || DEFAULT_SIMILARITY_THRESHOLD);
    const firebaseConfigured = isFirebaseEnabled() && !!getFirebaseDb();

    if (!isOpenAiConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'OPENAI_API_KEY nao configurada. Configure a chave para gerar perguntas com IA.',
            openaiConfigured: false,
            firebaseConfigured,
        }, { status: 400 });
    }

    const existingQuestions = firebaseConfigured
        ? await listFirestoreQuestions({ limit: 500, status: 'all' })
        : [];

    try {
        const generated = await generateQuestionsWithOpenAI({
            count,
            categories: resolvedCategories,
            theme,
            existingQuestions,
        });

        const review = reviewGeneratedQuestions({
            generated: generated.questions,
            existing: existingQuestions,
            threshold,
            defaults: {
                status: 'draft',
                source: 'ai',
                style: 'fun',
                locale: 'pt-BR',
            },
        });

        let saveResult = { saved: 0 };
        if (firebaseConfigured && review.accepted.length > 0) {
            saveResult = await saveFirestoreQuestions(review.accepted);
        }

        return NextResponse.json({
            success: true,
            model: generated.model,
            accepted: review.accepted,
            rejected: review.rejected,
            saved: saveResult.saved,
            existingCount: existingQuestions.length,
            threshold,
            openaiConfigured: true,
            firebaseConfigured,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Falha ao gerar perguntas',
            openaiConfigured: true,
            firebaseConfigured,
        }, { status: 500 });
    }
}
