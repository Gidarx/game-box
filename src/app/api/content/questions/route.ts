/* eslint-disable @typescript-eslint/no-require-imports */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const { getFirebaseDb, isFirebaseEnabled } = require('@/server/firebase-admin');
const { listFirestoreQuestions } = require('@/server/firebase-content');
const { isOpenAiConfigured } = require('@/server/ai-question-generator');
const { flattenQuestions } = require('@/server/question-content-utils');

export const runtime = 'nodejs';

async function getLocalSampleQuestions() {
    const samplePath = join(process.cwd(), 'content', 'questions.sample.pt-BR.json');
    const payload = JSON.parse(await readFile(samplePath, 'utf8'));
    return flattenQuestions(payload);
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit')) || 120));
    const firebaseConfigured = isFirebaseEnabled() && !!getFirebaseDb();

    if (!firebaseConfigured) {
        const questions = await getLocalSampleQuestions();
        return NextResponse.json({
            questions: questions.slice(0, limit),
            storage: 'local-sample',
            canPersist: false,
            firebaseConfigured: false,
            openaiConfigured: isOpenAiConfigured(),
        });
    }

    const questions = await listFirestoreQuestions({ limit, status });
    return NextResponse.json({
        questions,
        storage: 'firestore',
        canPersist: true,
        firebaseConfigured: true,
        openaiConfigured: isOpenAiConfigured(),
    });
}
