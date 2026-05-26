import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  flattenQuestions,
  normalizeQuestionForFirestore,
  validateQuestions,
} from './question-content-utils.mjs';

const require = createRequire(import.meta.url);
const { getFirebaseDb } = require('../src/server/firebase-admin.js');
const { getQuestionsCollectionName } = require('../src/server/firebase-content.js');

process.env.GAMEBOX_FIREBASE_ENABLED = process.env.GAMEBOX_FIREBASE_ENABLED || '1';

const inputPath = resolve(process.argv[2] || 'content/questions.sample.pt-BR.json');
const payload = JSON.parse(await readFile(inputPath, 'utf8'));
const questions = flattenQuestions(payload);
const errors = validateQuestions(questions);

if (questions.length === 0) {
  console.error(`Nenhuma pergunta encontrada em ${inputPath}`);
  process.exit(1);
}

if (errors.length > 0) {
  console.error(`Conteudo invalido em ${inputPath}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const db = getFirebaseDb();
if (!db) {
  console.error('Firebase nao inicializado. Configure GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}

const collectionName = getQuestionsCollectionName();
const collectionRef = db.collection(collectionName);
const batchSize = 400;
let written = 0;

for (let start = 0; start < questions.length; start += batchSize) {
  const batch = db.batch();
  const slice = questions.slice(start, start + batchSize);

  slice.forEach((question) => {
    const normalized = normalizeQuestionForFirestore(question);
    const id = normalized.id || collectionRef.doc().id;
    batch.set(collectionRef.doc(id), normalized, { merge: true });
  });

  await batch.commit();
  written += slice.length;
}

console.log(`OK: ${written} perguntas enviadas para Firestore (${collectionName})`);
