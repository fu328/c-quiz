import type { Option, QType, Question } from '../types';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = 'q'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function shuffle<T>(list: readonly T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function unique<T>(list: T[]): T[] {
  return Array.from(new Set(list));
}

/** 归一化用于答案比对的文本：去掉空白、标点、大小写差异 */
export function normalizeAnswerText(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[，,。.；;：:"'“”‘’`（）()【】\[\]]/g, '')
    .toLowerCase();
}

const JUDGE_TRUE = ['对', '正确', '是', '√', '✓', 't', 'true', 'y', 'yes'];
const JUDGE_FALSE = ['错', '错误', '否', '×', 'x', '✗', 'f', 'false', 'n', 'no'];

export function parseJudgeValue(raw: string): '对' | '错' | null {
  const v = normalizeAnswerText(raw);
  if (!v) return null;
  if (JUDGE_TRUE.includes(v)) return '对';
  if (JUDGE_FALSE.includes(v)) return '错';
  if (/^(正确|对)$/.test(raw.trim())) return '对';
  if (/^(错误|错)$/.test(raw.trim())) return '错';
  return null;
}

/** 判断作答是否正确。填空支持用 | 分隔多个可接受答案 */
export function isCorrect(question: Question, userAnswer: string[]): boolean {
  if (!userAnswer.length) return false;
  if (question.type === 'coding') return false;
  if (question.type === 'fill') {
    const alternatives = question.answer
      .join('|')
      .split(/[|｜]/)
      .map(normalizeAnswerText)
      .filter(Boolean);
    const mine = normalizeAnswerText(userAnswer.join(''));
    if (!mine) return false;
    return alternatives.some((alt) => alt === mine || alt.split('/').join('') === mine);
  }
  const std = [...question.answer].map((x) => x.toUpperCase()).sort().join(',');
  const mine = [...userAnswer].map((x) => x.toUpperCase()).sort().join(',');
  return std === mine;
}

export function answerText(question: Question): string {
  if (question.type === 'coding') return question.referenceCode ? '参考代码' : '—';
  if (question.type === 'fill') return question.answer.join(' / ');
  if (question.type === 'judge') return question.answer[0] === '对' ? '正确' : '错误';
  return question.answer.join('');
}

/** 是否属于代码类题目（含代码、编程题，或题干里带代码块） */
export function hasCode(question: Question): boolean {
  return Boolean(question.code || question.referenceCode) || question.type === 'coding' || question.stem.includes('```');
}

export function optionText(question: Question, keys: string[]): string {
  return keys
    .map((k) => question.options.find((o) => o.key === k)?.text ?? k)
    .join('；');
}

export function detectType(options: Option[], answer: string[]): QType {
  if (options.length >= 2) {
    return answer.length > 1 ? 'multiple' : 'single';
  }
  if (answer.length === 1 && (answer[0] === '对' || answer[0] === '错')) return 'judge';
  return 'fill';
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const today = todayKey();
  if (todayKey(d) === today) return `今天 ${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

/** 列表预览用的纯文本题干 */
export function plainStem(stem: string, max = 120): string {
  const text = stem
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function percent(correct: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((correct / total) * 100)}%`;
}

export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
