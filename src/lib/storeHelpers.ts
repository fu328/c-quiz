import type { AnswerRecord, PracticeMode, Question } from '../types';
import { shuffle } from '../lib/utils';

export function buildRecord(questionId: string): AnswerRecord {
  return {
    questionId,
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastAnswer: [],
    lastAt: 0,
    wrongBook: false,
    manualWrong: false,
    starred: false,
  };
}

/** 判重用的题干指纹：忽略空白和标点 */
export function normalAnswerKey(stem: string): string {
  return stem
    .replace(/\s+/g, '')
    .replace(/[，,。.；;：:"'“”‘’（）()【】\[\]?？!！]/g, '')
    .toLowerCase()
    .slice(0, 240);
}

export function buildQueue(
  questions: Question[],
  records: Record<string, AnswerRecord>,
  mode: PracticeMode,
  tag?: string,
): Question[] {
  let pool = questions;
  if (mode === 'wrong') {
    pool = pool.filter((q) => records[q.id]?.wrongBook);
  } else if (mode === 'unseen') {
    pool = pool.filter((q) => !records[q.id]?.attempts);
  } else if (mode === 'tag' && tag) {
    pool = pool.filter((q) => q.tags.includes(tag));
  } else if (mode === 'random') {
    pool = shuffle(pool);
  }
  return pool;
}
