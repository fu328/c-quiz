import type { Option, Question, QType } from '../types';

export interface TemplateDraft {
  type: QType;
  stem: string;
  options: Option[];
  answer: string[];
  explanation: string;
  tags: string[];
  code: string;
  referenceCode: string;
}

export interface QuestionTemplate {
  id: string;
  name: string;
  desc: string;
  icon: 'text' | 'book' | 'checkCircle' | 'target' | 'code' | 'terminal';
  build: () => TemplateDraft;
}

const A = (text: string): Option => ({ key: 'A', text });
const B = (text: string): Option => ({ key: 'B', text });
const C = (text: string): Option => ({ key: 'C', text });
const D = (text: string): Option => ({ key: 'D', text });

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    id: 'single',
    name: '基础选择题',
    desc: '4 个选项，单选答案',
    icon: 'text',
    build: () => ({
      type: 'single',
      stem: '下列关于 C 语言的说法，正确的是？',
      options: [A('选项一'), B('选项二'), C('选项三'), D('选项四')],
      answer: [],
      explanation: '',
      tags: [],
      code: '',
      referenceCode: '',
    }),
  },
  {
    id: 'reading-choice',
    name: '程序阅读题（单选）',
    desc: '给一段代码，问输出结果',
    icon: 'book',
    build: () => ({
      type: 'single',
      stem: '以下程序的输出结果是？',
      options: [A('0'), B('1'), C('3'), D('随机值')],
      answer: ['A'],
      explanation: '数组只初始化了前 3 个元素，其余元素会被自动初始化为 0。',
      tags: ['程序阅读'],
      code: `#include <stdio.h>

int main(void) {
    int a[5] = {1, 2, 3};
    printf("%d\\n", a[3]);
    return 0;
}`,
      referenceCode: '',
    }),
  },
  {
    id: 'reading-fill',
    name: '程序阅读题（填空）',
    desc: '读程序，写出运行结果',
    icon: 'target',
    build: () => ({
      type: 'fill',
      stem: '以下程序的输出结果是 ____ 。',
      options: [],
      answer: ['9'],
      explanation: '偶数会被 continue 跳过，实际累加的是 1 + 3 + 5 = 9。',
      tags: ['程序阅读'],
      code: `#include <stdio.h>

int main(void) {
    int sum = 0;
    for (int i = 1; i <= 5; i++) {
        if (i % 2 == 0) {
            continue;
        }
        sum += i;
    }
    printf("%d\\n", sum);
    return 0;
}`,
      referenceCode: '',
    }),
  },
  {
    id: 'code-fill',
    name: '程序填空题',
    desc: '挖空一行代码，填写表达式',
    icon: 'terminal',
    build: () => ({
      type: 'fill',
      stem: '补全程序中的空缺，使其输出 1 到 100 的累加和 5050。',
      options: [],
      answer: ['sum += i'],
      explanation: '循环变量 i 从 1 到 100，每次把 i 累加到 sum 上即可。',
      tags: ['程序填空'],
      code: `#include <stdio.h>

int main(void) {
    int sum = 0;
    for (int i = 1; i <= 100; i++) {
        ____;
    }
    printf("%d\\n", sum);
    return 0;
}`,
      referenceCode: '',
    }),
  },
  {
    id: 'coding',
    name: '编程题',
    desc: '写代码作答，自评对错，带补全',
    icon: 'code',
    build: () => ({
      type: 'coding',
      stem: '编写函数 int max_of(int a[], int n)，返回数组中的最大值；若 n <= 0 返回 0。',
      options: [],
      answer: [],
      explanation: '先判断 n 是否合法，再用第一个元素初始化最大值，遍历其余元素更新。',
      tags: ['编程题'],
      code: `#include <stdio.h>

int max_of(int a[], int n) {
    // 在这里实现
}

int main(void) {
    int a[] = {3, 9, 2};
    printf("%d\\n", max_of(a, 3));
    return 0;
}`,
      referenceCode: `#include <stdio.h>

int max_of(int a[], int n) {
    if (n <= 0) {
        return 0;
    }
    int max = a[0];
    for (int i = 1; i < n; i++) {
        if (a[i] > max) {
            max = a[i];
        }
    }
    return max;
}

int main(void) {
    int a[] = {3, 9, 2};
    printf("%d\\n", max_of(a, 3));
    return 0;
}`,
    }),
  },
  {
    id: 'judge',
    name: '判断题',
    desc: '正确 / 错误二选一',
    icon: 'checkCircle',
    build: () => ({
      type: 'judge',
      stem: '在 C 语言中，数组的下标从 0 开始。',
      options: [],
      answer: ['对'],
      explanation: '',
      tags: [],
      code: '',
      referenceCode: '',
    }),
  },
];

export type TemplatePrefill = Pick<
  Question,
  'type' | 'stem' | 'options' | 'answer' | 'explanation' | 'tags' | 'code' | 'referenceCode'
>;
