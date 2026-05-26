/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';

const { updateFirestoreQuestionStatus } = require('@/server/firebase-content');
const { ALLOWED_STATUSES } = require('@/server/question-content-utils');

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const status = String(body?.status || '').trim().toLowerCase();

    if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ success: false, error: 'Status invalido' }, { status: 400 });
    }

    const result = await updateFirestoreQuestionStatus(ids, status);
    if (result.error) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
}
