import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ALLOWED_DIFFICULTIES,
  ALLOWED_QUESTION_TYPES,
  ALLOWED_STATUSES,
  flattenQuestions,
  normalizeQuestionForStorage,
  validateQuestions,
} = require('../src/server/question-content-utils.js');

export {
  ALLOWED_DIFFICULTIES,
  ALLOWED_QUESTION_TYPES,
  ALLOWED_STATUSES,
  flattenQuestions,
  validateQuestions,
};

export function normalizeQuestionForFirestore(question) {
  return normalizeQuestionForStorage(question, { source: question.source || 'manual' });
}
