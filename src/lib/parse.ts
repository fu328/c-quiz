import type { Option, QType } from '../types';
import { detectType, normalizeAnswerText, parseJudgeValue, plainStem, unique } from './utils';

export interface ParsedQuestion {
  type: QType;
  stem: string;
  options: Option[];
  answer: string[];
  explanation: string;
  tags: string[];
  warnings: string[];
  raw: string;
}

const ANSWER_RE = /^(?:正确答案|参考答案|标准答案|答案|answer|ans)\s*[:：]?\s*(.*)$/i;
const EXPLAIN_RE = /^(?:答案解析|试题解析|解析|分析|解释|说明|考点|点评|思路|备注)\s*[:：]?\s*(.*)$/;
const TAG_RE = /^(?:标签|知识点|考点|分类|章节)\s*[:：]\s*(.*)$/;
const NUMBERED_RE = /^\s*(?:第\s*)?(\d{1,3})\s*(?:题)?\s*[.、．)）:：]\s*(.*)$/;
const BRACKET_NUMBERED_RE = /^\s*[（(]\s*(\d{1,3})\s*[）)]\s*(.*)$/;
const OPTION_RE = /^\s*([A-Ja-j])\s*[.、．)）]\s*(.*)$/;
const OPTION_ONLY_RE = /^\s*([A-Ja-j])\s*[.、．)）]?\s*$/;

/** 全角转半角，统一标点，便于稳定解析 */
export function normalizeText(input: string): string {
  let text = input.replace(/\r\n?/g, '\n').replace(/\u00a0|\u3000/g, ' ').replace(/[\u200b-\u200f\ufeff]/g, '');
  text = text.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  text = text.replace(/\t/g, '    ');
  return text;
}

/** OCR 结果里中文字符之间常有空格，这里清掉（只处理行内空格，不能吞掉换行） */
export function cleanupOcrText(input: string): string {
  return normalizeText(input)
    .replace(/([\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1')
    .replace(/([\u4e00-\u9fa5])[ \t]+(?=[，。；：、？！])/g, '$1')
    .replace(/[ \t]+([，。；：、？！])/g, '$1');
}

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

function stripNumber(raw: string): { number: number; rest: string } | null {
  const m = NUMBERED_RE.exec(raw);
  if (m) return { number: Number(m[1]), rest: m[2] };
  const b = BRACKET_NUMBERED_RE.exec(raw);
  if (b) return { number: Number(b[1]), rest: b[2] };
  return null;
}

/** 把同一行里的多个选项拆开，例如 “A. 1  B. 2  C. 3” */
function explodeInlineOptions(line: string): string[] {
  if (!/[A-J]\s*[.、．)）]/.test(line)) return [line];
  const marker = /(?:^|\s)([A-J])\s*[.、．)）]\s*/g;
  const hits: Array<{ index: number; letter: string; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(line))) {
    hits.push({ index: match.index, letter: match[1], end: match.index + match[0].length });
  }
  if (hits.length < 2) return [line];
  // 只接受从 A 开始连续的选项，避免误伤正文
  const letters = hits.map((h) => h.letter);
  if (letters[0] !== 'A') return [line];
  const segments: string[] = [];
  const head = line.slice(0, hits[0].index).trim();
  if (head) segments.push(head);
  hits.forEach((hit, i) => {
    const stop = i + 1 < hits.length ? hits[i + 1].index : line.length;
    const content = line.slice(hit.end, stop).trim();
    segments.push(`${hit.letter}. ${content}`);
  });
  return segments;
}

/** 把行尾的 “答案：A” / “解析：…” 拆到单独一行 */
function splitTrailingMarkers(line: string): string[] {
  const markerRe = /(?:^|\s)((?:正确答案|参考答案|标准答案|答案|答案解析|解析|分析)\s*[:：]\s*\S[\s\S]*)$/;
  const match = markerRe.exec(line);
  if (match && match.index > 0) {
    return [line.slice(0, match.index).trimEnd(), match[1].trim()];
  }
  return [line];
}

function splitIntoBlocks(text: string): string[] {
  const lines = text.split('\n');
  const starts: number[] = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (isFence(line)) inFence = !inFence;
    if (inFence) return;
    const numbered = stripNumber(line);
    if (numbered && numbered.rest.trim().length >= 1) starts.push(i);
  });

  if (starts.length >= 2) {
    const blocks: string[] = [];
    const bounds = [...starts, lines.length];
    if (starts[0] > 0) {
      const preface = lines.slice(0, starts[0]).join('\n').trim();
      // 只保留看起来像题目的前言，丢弃“一、选择题”这类大标题
      if (preface && /(?:^\s*[A-J]\s*[.、．)）]|(?:正确答案|答案)\s*[:：])/m.test(preface)) {
        blocks.push(preface);
      }
    }
    for (let i = 0; i < bounds.length - 1; i += 1) {
      blocks.push(lines.slice(bounds[i], bounds[i + 1]).join('\n'));
    }
    return blocks.filter((b) => b.trim());
  }

  // 无编号：按空行分段（代码块内的空行不算），把没有选项/答案的碎片并入上一段
  const chunks: string[] = [];
  let buffer: string[] = [];
  let fence = false;
  text.split('\n').forEach((line) => {
    if (isFence(line)) fence = !fence;
    if (!fence && !line.trim()) {
      if (buffer.length) {
        chunks.push(buffer.join('\n'));
        buffer = [];
      }
      return;
    }
    buffer.push(line);
  });
  if (buffer.length) chunks.push(buffer.join('\n'));

  if (chunks.length <= 1) return [text.trim()];
  const merged: string[] = [];
  for (const chunk of chunks) {
    const hasOption = /^\s*[A-J]\s*[.、．)）]/m.test(chunk);
    const hasAnswer = /^\s*(?:正确答案|参考答案|答案)\s*[:：]/m.test(chunk);
    if (!hasOption && !hasAnswer && merged.length) {
      merged[merged.length - 1] += `\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged;
}

interface DraftOption {
  key: string;
  lines: string[];
}

function resolveAnswer(raw: string, options: Option[]): string[] {
  const text = raw.trim().replace(/^[：:]\s*/, '');
  if (!text) return [];
  const cleaned = text.replace(/[。．.]$/, '').trim();

  if (options.length) {
    const lettersOnly = cleaned.replace(/[\s,，、和及或\/|+]/g, '');
    if (/^[A-Ja-j]+$/.test(lettersOnly) && lettersOnly.length <= 4) {
      return unique(lettersOnly.toUpperCase().split('')).sort();
    }
    const lead = /^[A-Ja-j](?:\s*[、,，/和及]\s*[A-Ja-j])*/.exec(cleaned);
    if (lead) {
      return unique((lead[0].match(/[A-Ja-j]/g) ?? []).map((l) => l.toUpperCase())).sort();
    }
    const normalized = normalizeAnswerText(cleaned);
    const hit = options.find((o) => normalizeAnswerText(o.text) === normalized);
    if (hit) return [hit.key];
    const judge = parseJudgeValue(cleaned);
    if (judge) {
      const target = options.find((o) =>
        judge === '对' ? /正确|对/.test(o.text) : /错误|错/.test(o.text),
      );
      if (target) return [target.key];
    }
    const picked = /(?:选|答)\s*([A-Ja-j])/.exec(cleaned);
    if (picked) return [picked[1].toUpperCase()];
    return [];
  }

  const judge = parseJudgeValue(cleaned);
  if (judge) return [judge];
  return unique(cleaned.split(/[|｜]/).map((s) => s.trim()).filter(Boolean));
}

function parseBlock(block: string): ParsedQuestion | null {
  const rawLines = block.split('\n');
  const lines: string[] = [];
  let inFence = false;
  rawLines.forEach((line) => {
    if (isFence(line)) {
      inFence = !inFence;
      lines.push(line);
      return;
    }
    if (inFence) {
      lines.push(line);
      return;
    }
    splitTrailingMarkers(line).forEach((part) => lines.push(...explodeInlineOptions(part)));
  });

  const first = stripNumber(lines[0] ?? '');
  if (first) lines[0] = first.rest;

  const stemLines: string[] = [];
  const options: DraftOption[] = [];
  let answerRaw = '';
  const explanationLines: string[] = [];
  let tags: string[] = [];
  let lastTarget: 'stem' | 'option' | 'explain' = 'stem';
  let lockedStem = false; // 一旦出现选项/答案，后续普通行不再算题干

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (lastTarget === 'stem') stemLines.push('');
      continue;
    }
    if (isFence(trimmed)) {
      if (lastTarget === 'option' && options.length) options[options.length - 1].lines.push(line);
      else if (lastTarget === 'explain') explanationLines.push(line);
      else stemLines.push(line);
      continue;
    }

    const answerMatch = ANSWER_RE.exec(trimmed);
    if (answerMatch) {
      let value = answerMatch[1];
      const inlineExplain = /^(.*?)(?:答案解析|解析|分析|解释)\s*[:：]\s*([\s\S]*)$/.exec(value);
      if (inlineExplain && inlineExplain[1].trim()) {
        value = inlineExplain[1];
        explanationLines.push(inlineExplain[2]);
      }
      answerRaw = value;
      lastTarget = 'explain';
      lockedStem = true;
      continue;
    }
    const explainMatch = EXPLAIN_RE.exec(trimmed);
    if (explainMatch) {
      explanationLines.push(explainMatch[1]);
      lastTarget = 'explain';
      lockedStem = true;
      continue;
    }
    const tagMatch = TAG_RE.exec(trimmed);
    if (tagMatch) {
      tags = unique(
        tagMatch[1]
          .split(/[,，、;；\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
      continue;
    }

    const optionMatch = OPTION_RE.exec(trimmed) ?? OPTION_ONLY_RE.exec(trimmed);
    if (optionMatch && !(optionMatch[2] === '' && lastTarget === 'stem')) {
      options.push({ key: optionMatch[1].toUpperCase(), lines: [optionMatch[2] ?? ''] });
      lastTarget = 'option';
      lockedStem = true;
      continue;
    }

    if (!lockedStem) {
      stemLines.push(line);
    } else if (lastTarget === 'option' && options.length) {
      options[options.length - 1].lines.push(line);
    } else {
      explanationLines.push(line);
    }
  }

  const stem = stemLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:判断题?|填空题?|单选题?|多选题?|选择题)\s*[:：]\s*/, '')
    .trim();
  if (!stem) return null;
  const parsedOptions: Option[] = options.map((o) => ({
    key: o.key,
    text: o.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  })).filter((o) => o.text.length > 0);

  let answer = resolveAnswer(answerRaw, parsedOptions);
  const warnings: string[] = [];
  if (!answer.length) {
    // 兜底：整段里再找一次 “答案：A”
    const fallback = /(?:正确答案|答案)\s*[:：]\s*([A-Ja-j]{1,4}|对|错|正确|错误)/.exec(block);
    if (fallback) answer = resolveAnswer(fallback[1], parsedOptions);
  }
  const type = detectType(parsedOptions, answer);
  if (!answer.length) warnings.push('未识别到答案，请补充');
  if (parsedOptions.length === 1) warnings.push('只识别到 1 个选项，请检查格式');
  if (type === 'fill' && !/填空|____|（\s*）|\(\s*\)/.test(stem)) {
    warnings.push('未识别到选项，已按填空题处理');
  }
  if (type === 'multiple') answer = unique(answer).sort();

  const explanation = explanationLines.join('\n').trim();

  return {
    type,
    stem,
    options: parsedOptions,
    answer,
    explanation,
    tags,
    warnings,
    raw: block,
  };
}

export function parseQuestions(input: string): ParsedQuestion[] {
  const text = cleanupOcrText(input).trim();
  if (!text) return [];
  const blocks = splitIntoBlocks(text);
  const parsed: ParsedQuestion[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const question = parseBlock(block);
    if (!question) continue;
    const key = normalizeAnswerText(plainStem(question.stem, 400)).slice(0, 200);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    parsed.push(question);
  }
  return parsed;
}

/** 表单里的答案字符串 → 字符串数组 */
export function answerFromInput(type: string, value: string): string[] {
  const text = value.trim();
  if (!text) return [];
  if (type === 'single' || type === 'multiple') {
    const letters = text.toUpperCase().match(/[A-J]/g) ?? [];
    return unique(letters).sort();
  }
  if (type === 'judge') {
    const judge = parseJudgeValue(text);
    return judge ? [judge] : [];
  }
  return text.split(/[|｜]/).map((s) => s.trim()).filter(Boolean);
}

/** 答案数组 → 表单展示字符串 */
export function answerToInput(question: { type: string; answer: string[] }): string {
  if (question.type === 'fill') return question.answer.join('|');
  return question.answer.join('');
}

