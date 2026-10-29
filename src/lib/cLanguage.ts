export type CompletionKind = 'snippet' | 'function' | 'keyword' | 'type' | 'macro';

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  /** 右侧显示的签名 / 说明 */
  detail: string;
  /** 插入文本，用 | 标记插入后光标位置 */
  insert: string;
}

export const C_KEYWORDS = [
  'auto',
  'break',
  'case',
  'const',
  'continue',
  'default',
  'do',
  'else',
  'enum',
  'extern',
  'for',
  'goto',
  'if',
  'inline',
  'register',
  'restrict',
  'return',
  'sizeof',
  'static',
  'struct',
  'switch',
  'typedef',
  'union',
  'volatile',
  'while',
  '_Alignas',
  '_Alignof',
  '_Atomic',
  '_Bool',
  '_Complex',
  '_Generic',
  '_Noreturn',
  '_Static_assert',
  '_Thread_local',
];

export const C_TYPES = [
  'void',
  'char',
  'short',
  'int',
  'long',
  'float',
  'double',
  'signed',
  'unsigned',
  'size_t',
  'ssize_t',
  'ptrdiff_t',
  'FILE',
  'time_t',
  'bool',
  'int8_t',
  'int16_t',
  'int32_t',
  'int64_t',
  'uint8_t',
  'uint16_t',
  'uint32_t',
  'uint64_t',
];

export const C_MACROS = ['NULL', 'EOF', 'true', 'false', 'stdin', 'stdout', 'stderr'];

const K = (label: string): CompletionItem => ({
  label,
  kind: 'keyword',
  detail: '关键字',
  insert: label,
});

const T = (label: string): CompletionItem => ({
  label,
  kind: 'type',
  detail: '类型',
  insert: label,
});

const M = (label: string): CompletionItem => ({
  label,
  kind: 'macro',
  detail: '宏 / 常量',
  insert: label,
});

function F(label: string, detail: string, insert: string): CompletionItem {
  return { label, kind: 'function', detail, insert };
}

function S(label: string, detail: string, insert: string): CompletionItem {
  return { label, kind: 'snippet', detail, insert };
}

export const C_FUNCTIONS: CompletionItem[] = [
  F('printf', 'int printf(const char *fmt, ...)', 'printf("|")'),
  F('scanf', 'int scanf(const char *fmt, ...)', 'scanf("%d", &|)'),
  F('puts', 'int puts(const char *s)', 'puts("|")'),
  F('putchar', 'int putchar(int c)', 'putchar(|)'),
  F('getchar', 'int getchar(void)', 'getchar()'),
  F('fgets', 'char *fgets(char *s, int n, FILE *f)', 'fgets(|, 100, stdin)'),
  F('strlen', 'size_t strlen(const char *s)', 'strlen(|)'),
  F('strcpy', 'char *strcpy(char *dst, const char *src)', 'strcpy(|, src)'),
  F('strncpy', 'char *strncpy(char *dst, const char *src, size_t n)', 'strncpy(|, src, n)'),
  F('strcat', 'char *strcat(char *dst, const char *src)', 'strcat(|, src)'),
  F('strcmp', 'int strcmp(const char *a, const char *b)', 'strcmp(|, s2)'),
  F('strncmp', 'int strncmp(const char *a, const char *b, size_t n)', 'strncmp(|, s2, n)'),
  F('strstr', 'char *strstr(const char *hay, const char *needle)', 'strstr(|, needle)'),
  F('strchr', 'char *strchr(const char *s, int c)', 'strchr(|, c)'),
  F('memset', 'void *memset(void *s, int c, size_t n)', 'memset(|, 0, sizeof(int))'),
  F('memcpy', 'void *memcpy(void *dst, const void *src, size_t n)', 'memcpy(|, src, n)'),
  F('memmove', 'void *memmove(void *dst, const void *src, size_t n)', 'memmove(|, src, n)'),
  F('malloc', 'void *malloc(size_t size)', 'malloc(|)'),
  F('calloc', 'void *calloc(size_t n, size_t size)', 'calloc(|, sizeof(int))'),
  F('realloc', 'void *realloc(void *p, size_t size)', 'realloc(|, size)'),
  F('free', 'void free(void *p)', 'free(|)'),
  F('atoi', 'int atoi(const char *s)', 'atoi(|)'),
  F('atof', 'double atof(const char *s)', 'atof(|)'),
  F('abs', 'int abs(int x)', 'abs(|)'),
  F('labs', 'long labs(long x)', 'labs(|)'),
  F('sqrt', 'double sqrt(double x)', 'sqrt(|)'),
  F('pow', 'double pow(double x, double y)', 'pow(|, 2)'),
  F('fabs', 'double fabs(double x)', 'fabs(|)'),
  F('fopen', 'FILE *fopen(const char *path, const char *mode)', 'fopen("|", "r")'),
  F('fclose', 'int fclose(FILE *f)', 'fclose(|)'),
  F('fprintf', 'int fprintf(FILE *f, const char *fmt, ...)', 'fprintf(|, "%d", x)'),
  F('fscanf', 'int fscanf(FILE *f, const char *fmt, ...)', 'fscanf(|, "%d", &x)'),
  F('fread', 'size_t fread(void *p, size_t size, size_t n, FILE *f)', 'fread(|, 1, n, fp)'),
  F('fwrite', 'size_t fwrite(const void *p, size_t size, size_t n, FILE *f)', 'fwrite(|, 1, n, fp)'),
  F('exit', 'void exit(int status)', 'exit(|)'),
  F('qsort', 'void qsort(void *base, size_t n, size_t size, cmp)', 'qsort(|, n, sizeof(int), cmp)'),
  F('rand', 'int rand(void)', 'rand()'),
  F('srand', 'void srand(unsigned seed)', 'srand(|)'),
  F('time', 'time_t time(time_t *t)', 'time(NULL)'),
];

export const C_SNIPPETS: CompletionItem[] = [
  S('main', 'main 函数框架', 'int main(void) {\n    |\n    return 0;\n}'),
  S('for', 'for 循环', 'for (int i = 0; i < |; i++) {\n    \n}'),
  S('fori', '遍历数组', 'for (int i = 0; i < n; i++) {\n    |\n}'),
  S('while', 'while 循环', 'while (|) {\n    \n}'),
  S('do', 'do-while 循环', 'do {\n    \n} while (|);'),
  S('if', 'if 语句', 'if (|) {\n    \n}'),
  S('ifelse', 'if-else 语句', 'if (|) {\n    \n} else {\n    \n}'),
  S('switch', 'switch 语句', 'switch (|) {\n    case 1:\n        break;\n    default:\n        break;\n}'),
  S('struct', '结构体定义', 'struct | {\n    int x;\n};'),
  S('func', '函数定义', 'int |(void) {\n    \n}'),
  S('array', '数组定义', 'int arr[|] = {0};'),
  S('swap', '交换两个变量', 'int tmp = a;\na = b;\nb = tmp;'),
  S('printint', '打印整数', 'printf("%d\\n", |);'),
  S('readint', '读取整数', 'scanf("%d", &|);'),
  S('include', '#include 头文件', '#include <|>'),
  S('stdio', '#include <stdio.h>', '#include <stdio.h>'),
  S('stdlib', '#include <stdlib.h>', '#include <stdlib.h>'),
  S('string', '#include <string.h>', '#include <string.h>'),
  S('math', '#include <math.h>', '#include <math.h>'),
];

export const C_COMPLETIONS: CompletionItem[] = [
  ...C_SNIPPETS,
  ...C_FUNCTIONS,
  ...C_KEYWORDS.map(K),
  ...C_TYPES.map(T),
  ...C_MACROS.map(M),
];

/** 输入 # 时只提示常用的头文件片段 */
export const C_HEADERS: CompletionItem[] = C_SNIPPETS.filter((item) =>
  ['include', 'stdio', 'stdlib', 'string', 'math'].includes(item.label),
);

const KIND_WEIGHT: Record<CompletionKind, number> = {
  function: 0,
  snippet: 0.5,
  keyword: 1,
  type: 1.5,
  macro: 2,
};

export function completeC(prefix: string, limit = 9): CompletionItem[] {
  const q = prefix.toLowerCase();
  if (!q) return C_COMPLETIONS.slice(0, limit);
  const scored: Array<{ item: CompletionItem; score: number }> = [];
  for (const item of C_COMPLETIONS) {
    const label = item.label.toLowerCase();
    let base = -1;
    if (label === q) base = 0;
    else if (label.startsWith(q)) base = 10;
    else if (q.length >= 3 && label.includes(q)) base = 25;
    if (base < 0) continue;
    // 名称越接近输入越靠前，避免 pri 时片段排在 printf 之前
    const lengthPenalty = Math.min(3, label.length - q.length) * 0.25;
    scored.push({ item, score: base + KIND_WEIGHT[item.kind] + lengthPenalty });
  }
  scored.sort(
    (a, b) => a.score - b.score || a.item.label.length - b.item.label.length || a.item.label.localeCompare(b.item.label),
  );
  const seen = new Set<string>();
  const result: CompletionItem[] = [];
  for (const { item } of scored) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export const C_KEYWORD_SET = new Set(C_KEYWORDS);
export const C_TYPE_SET = new Set([...C_TYPES, ...C_MACROS]);
export const C_FUNCTION_SET = new Set(C_FUNCTIONS.map((f) => f.label));
