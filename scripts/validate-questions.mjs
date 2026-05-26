import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { flattenQuestions, validateQuestions } from './question-content-utils.mjs';

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

console.log(`OK: ${questions.length} perguntas validas em ${inputPath}`);
