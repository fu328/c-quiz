export type QType = 'single' | 'multiple' | 'judge' | 'fill' | 'coding';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  type: QType;
  stem: string;
  options: Option[];
  /** 标准答案：单选/多选为选项字母，判断题为「对」「错」，填空为文本 */
  answer: string[];
  explanation: string;
  tags: string[];
  /** 题干附带的代码：阅读题是要读的代码，编程题是起始代码 */
  code?: string;
  /** 编程题的参考答案代码 */
  referenceCode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AnswerRecord {
  questionId: string;
  attempts: number;
  correct: number;
  wrong: number;
  lastAnswer: string[];
  lastAt: number;
  /** 是否在错题本中 */
  wrongBook: boolean;
  /** 是否由用户手动标记（区别于答错自动收录） */
  manualWrong: boolean;
  starred: boolean;
}

export type PracticeMode = 'sequence' | 'random' | 'unseen' | 'wrong' | 'tag';

export interface PracticeSession {
  mode: PracticeMode;
  tag?: string;
  ids: string[];
  index: number;
  answers: Record<string, string[]>;
  /** 自评类题目（编程题）的判定结果 */
  results?: Record<string, boolean>;
  startedAt: number;
}

export interface Settings {
  theme: ThemeMode;
  /** 单选/判断题点击选项立即判题 */
  instantJudge: boolean;
  /** 答对后自动进入下一题 */
  autoNext: boolean;
  ocrLang: 'chi_sim+eng' | 'eng';
  /** 代码编辑器补全 */
  codeCompletion: boolean;
}

export interface DayStat {
  date: string;
  total: number;
  correct: number;
}

export interface BackupPayload {
  app: 'c-quiz';
  version: number;
  exportedAt: number;
  questions: Question[];
  records: AnswerRecord[];
  stats: DayStat[];
  settings: Settings;
}

export const QTYPE_LABEL: Record<QType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  coding: '编程题',
};

export const QTYPE_SHORT: Record<QType, string> = {
  single: '单',
  multiple: '多',
  judge: '判',
  fill: '填',
  coding: '编',
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  instantJudge: true,
  autoNext: true,
  ocrLang: 'chi_sim+eng',
  codeCompletion: true,
};
