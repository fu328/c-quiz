import { C_FUNCTION_SET, C_KEYWORD_SET, C_TYPE_SET } from './cLanguage';

export type TokenKind = 'kw' | 'type' | 'fn' | 'num' | 'str' | 'com' | 'pre' | 'txt';

export interface Token {
  text: string;
  kind: TokenKind;
}

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|([A-Za-z_][A-Za-z0-9_]*)|(\d(?:[0-9a-fA-FxX.]|[uUlL])*)/gm;

const cache = new Map<string, Token[]>();

/** 轻量 C 语法着色：关键字、类型、标准库函数、字符串、注释、预处理指令、数字 */
export function tokenizeC(source: string): Token[] {
  const cached = cache.get(source);
  if (cached) return cached;

  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source))) {
    if (match.index > last) {
      tokens.push({ text: source.slice(last, match.index), kind: 'txt' });
    }
    let kind: TokenKind = 'txt';
    if (match[1]) kind = 'com';
    else if (match[2]) kind = 'str';
    else if (match[3]) kind = 'pre';
    else if (match[4]) {
      const word = match[4];
      if (C_KEYWORD_SET.has(word)) kind = 'kw';
      else if (C_TYPE_SET.has(word)) kind = 'type';
      else if (C_FUNCTION_SET.has(word)) kind = 'fn';
    } else if (match[5]) kind = 'num';
    tokens.push({ text: match[0], kind });
    last = match.index + match[0].length;
  }
  if (last < source.length) tokens.push({ text: source.slice(last), kind: 'txt' });

  if (cache.size > 60) cache.clear();
  cache.set(source, tokens);
  return tokens;
}

export function highlightC(source: string) {
  return tokenizeC(source).map((token, index) =>
    token.kind === 'txt' ? (
      token.text
    ) : (
      <span key={index} className={`tok-${token.kind}`}>
        {token.text}
      </span>
    ),
  );
}
