/* eslint-disable @typescript-eslint/no-require-imports */

const { getFirebaseDb, isFirebaseEnabled } = require('./firebase-admin');
const { normalizeQuestionForStorage } = require('./question-content-utils');

function getQuestionsCollectionName() {
    return process.env.GAMEBOX_FIREBASE_QUESTIONS_COLLECTION || 'questions';
}

function normalizeFirestoreQuestion(id, data) {
    if (!data || data.status !== 'active') return null;
    if (data.locale && data.locale !== 'pt-BR') return null;

    return {
        id: data.id || id,
        text: data.text,
        options: data.options,
        correctIndex: data.correctIndex,
        category: data.category || 'geral',
        difficulty: data.difficulty || 'medium',
        timeLimit: data.timeLimit || 12,
    };
}

function mapQuestionDoc(doc) {
    return {
        id: doc.id,
        ...doc.data(),
    };
}

async function fetchFirestoreQuestionDocuments({ limit = 120 } = {}) {
    if (!isFirebaseEnabled()) return [];
    const db = getFirebaseDb();
    if (!db) return [];

    try {
        const collectionName = getQuestionsCollectionName();
        const safeLimit = Math.max(1, Math.min(500, Number(limit) || 120));
        const snapshot = await db
            .collection(collectionName)
            .where('status', '==', 'active')
            .where('locale', '==', 'pt-BR')
            .limit(safeLimit)
            .get();

        return snapshot.docs
            .map((doc) => normalizeFirestoreQuestion(doc.id, doc.data()))
            .filter(Boolean);
    } catch (error) {
        console.warn(`[Firebase] Falha ao buscar perguntas: ${error.message}`);
        return [];
    }
}

async function listFirestoreQuestions({ limit = 120, status = 'all' } = {}) {
    if (!isFirebaseEnabled()) return [];
    const db = getFirebaseDb();
    if (!db) return [];

    try {
        const collectionName = getQuestionsCollectionName();
        const safeLimit = Math.max(1, Math.min(500, Number(limit) || 120));
        let query = db
            .collection(collectionName)
            .where('locale', '==', 'pt-BR');

        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.limit(safeLimit).get();
        return snapshot.docs.map(mapQuestionDoc);
    } catch (error) {
        console.warn(`[Firebase] Falha ao listar perguntas: ${error.message}`);
        return [];
    }
}

async function saveFirestoreQuestions(questions) {
    const db = getFirebaseDb();
    if (!db) return { saved: 0, error: 'Firebase nao configurado' };

    const collectionRef = db.collection(getQuestionsCollectionName());
    const normalizedQuestions = (questions || []).map((question) => normalizeQuestionForStorage(question));
    const batchSize = 400;
    let saved = 0;

    for (let start = 0; start < normalizedQuestions.length; start += batchSize) {
        const batch = db.batch();
        const slice = normalizedQuestions.slice(start, start + batchSize);
        slice.forEach((question) => {
            batch.set(collectionRef.doc(question.id), question, { merge: true });
        });
        await batch.commit();
        saved += slice.length;
    }

    return { saved };
}

async function updateFirestoreQuestionStatus(ids, status) {
    const db = getFirebaseDb();
    if (!db) return { updated: 0, error: 'Firebase nao configurado' };

    const safeIds = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
    if (!safeIds.length) return { updated: 0 };

    const collectionRef = db.collection(getQuestionsCollectionName());
    const batch = db.batch();
    safeIds.forEach((id) => {
        batch.set(collectionRef.doc(id), {
            status,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    });
    await batch.commit();
    return { updated: safeIds.length };
}

module.exports = {
    fetchFirestoreQuestionDocuments,
    getQuestionsCollectionName,
    listFirestoreQuestions,
    saveFirestoreQuestions,
    updateFirestoreQuestionStatus,
};
