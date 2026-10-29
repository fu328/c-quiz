import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { C_HEADERS, completeC, type CompletionItem } from '../lib/cLanguage';
import { highlightC } from '../lib/highlight';
import { cx } from '../lib/utils';

const PAD_X = 16;
const PAD_Y = 12;
const LINE_H = 22;
const POPUP_W = 320;

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
};

const CLOSERS = new Set([')', ']', '}', '"', "'"]);

let measuredFont = '';
let measuredWidth = 0;

function charWidth(el: HTMLTextAreaElement | null): number {
  if (!el) return 7.8;
  const style = getComputedStyle(el);
  const font = `${style.fontSize} ${style.fontFamily}`;
  if (font === measuredFont && measuredWidth) return measuredWidth;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 7.8;
  ctx.font = font;
  measuredFont = font;
  measuredWidth = ctx.measureText('MMMMMMMMMM').width / 10 || 7.8;
  return measuredWidth;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  readOnly?: boolean;
  completion?: boolean;
  autoFocus?: boolean;
  /** 工具栏右侧自定义内容 */
  extra?: ReactNode;
}

interface PopupState {
  open: boolean;
  items: CompletionItem[];
  index: number;
  x: number;
  y: number;
}

const CLOSED: PopupState = { open: false, items: [], index: 0, x: 0, y: 0 };

const KIND_LABEL: Record<CompletionItem['kind'], string> = {
  snippet: '片段',
  function: '函数',
  keyword: '关键字',
  type: '类型',
  macro: '宏',
};

export function CodeEditor({
  value,
  onChange,
  height = 300,
  placeholder = '// 在这里编写 C 代码…',
  readOnly = false,
  completion = true,
  autoFocus = false,
  extra,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [caret, setCaret] = useState(0);
  const [popup, setPopup] = useState<PopupState>(CLOSED);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const popupRef = useRef(popup);
  popupRef.current = popup;

  const lineCount = useMemo(() => value.split('\n').length, [value]);
  const line = useMemo(() => value.slice(0, caret).split('\n').length, [value, caret]);
  const col = useMemo(() => caret - (value.lastIndexOf('\n', caret - 1) + 1) + 1, [value, caret]);

  const syncCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    setCaret(ta.selectionStart ?? 0);
  }, []);

  useLayoutEffect(() => {
    if (autoFocus) {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        syncCaret();
      }
    }
  }, [autoFocus, syncCaret]);

  const closePopup = useCallback(() => setPopup(CLOSED), []);

  const openPopup = useCallback(
    (text: string, pos: number, force = false) => {
      if (!completion || readOnly) return;
      const ta = taRef.current;
      const main = mainRef.current;
      if (!ta || !main) return;
      const before = text.slice(0, pos);
      const match = /(#?[A-Za-z_][A-Za-z0-9_]*|#)$/.exec(before);
      const prefix = match ? match[1] : '';
      const query = prefix.replace(/^#/, '');
      const isHeader = prefix.startsWith('#');
      if (!force && !isHeader && query.length < 2) {
        closePopup();
        return;
      }
      const items = isHeader
        ? C_HEADERS.filter((item) => item.label.startsWith(query.toLowerCase()))
        : completeC(query);
      if (!items.length) {
        closePopup();
        return;
      }
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineIndex = before.slice(0, lineStart).split('\n').length - 1;
      const beforeCaret = before.slice(lineStart).replace(/\t/g, '    ');
      const cw = charWidth(ta);
      const width = main.clientWidth;
      const boxHeight = main.clientHeight;
      const popupHeight = Math.min(items.length, 8) * 34 + 8;
      let x = PAD_X + beforeCaret.length * cw - ta.scrollLeft;
      let y = PAD_Y + (lineIndex + 1) * LINE_H - ta.scrollTop + 2;
      if (y + popupHeight > boxHeight - 4) {
        y = Math.max(4, PAD_Y + lineIndex * LINE_H - ta.scrollTop - popupHeight - 2);
      }
      x = Math.max(8, Math.min(x, Math.max(8, width - POPUP_W - 10)));
      setPopup({ open: true, items, index: 0, x, y });
    },
    [closePopup, completion, readOnly],
  );

  const applyEdit = useCallback(
    (start: number, end: number, text: string, selStart?: number, selEnd?: number) => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
      let ok = false;
      try {
        ok = document.execCommand('insertText', false, text);
      } catch {
        ok = false;
      }
      if (!ok) {
        const next = ta.value.slice(0, start) + text + ta.value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          ta.setSelectionRange(selStart ?? start + text.length, selEnd ?? start + text.length);
          syncCaret();
        });
      } else {
        // execCommand 已经把光标放在插入内容之后；这里只需处理片段里的光标标记
        const pos = selStart ?? start + text.length;
        ta.setSelectionRange(pos, selEnd ?? pos);
        syncCaret();
      }
    },
    [onChange, syncCaret],
  );

  const accept = useCallback(
    (item: CompletionItem) => {
      const ta = taRef.current;
      if (!ta) return;
      const pos = ta.selectionStart ?? 0;
      const before = ta.value.slice(0, pos);
      const match = /(#?[A-Za-z_][A-Za-z0-9_]*|#)$/.exec(before);
      const len = match ? match[1].length : 0;
      const start = pos - len;
      const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
      const indent = /^[ \t]*/.exec(ta.value.slice(lineStart, start))?.[0] ?? '';
      let insert = item.insert;
      if (insert.includes('\n') && indent) {
        insert = insert.split('\n').join(`\n${indent}`);
      }
      const marker = insert.indexOf('|');
      const clean = marker >= 0 ? insert.replace('|', '') : insert;
      const caretOffset = marker >= 0 ? marker : clean.length;
      closePopup();
      applyEdit(start, pos, clean, start + caretOffset, start + caretOffset);
    },
    [applyEdit, closePopup],
  );

  const change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);
    setCaret(e.target.selectionStart ?? 0);
    const native = e.nativeEvent as InputEvent;
    const data = typeof native.data === 'string' ? native.data : '';
    if (!composingRef.current && /^[A-Za-z_#]$/.test(data)) {
      openPopup(text, e.target.selectionStart ?? 0);
    } else {
      closePopup();
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const ta = e.currentTarget;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const text = ta.value;
    const current = popupRef.current;

    if (current.open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPopup((prev) => ({
          ...prev,
          index: (prev.index + (e.key === 'ArrowDown' ? 1 : -1) + prev.items.length) % prev.items.length,
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        accept(current.items[current.index]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePopup();
        return;
      }
    }

    if (
      ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) ||
      (e.altKey && e.key === '/')
    ) {
      e.preventDefault();
      openPopup(text, start, true);
      return;
    }
    if (e.key === 'Escape') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start !== end && text.slice(start, end).includes('\n')) {
        const from = text.lastIndexOf('\n', start - 1) + 1;
        const block = text.slice(from, end);
        if (e.shiftKey) {
          const lines = block.split('\n');
          let removedFirst = 0;
          lines.forEach((l, i) => {
            const cut = l.match(/^ {1,4}/)?.[0].length ?? 0;
            if (i === 0) removedFirst = cut;
            lines[i] = l.slice(cut);
          });
          const next = lines.join('\n');
          const removedTotal = block.length - next.length;
          applyEdit(from, end, next, Math.max(from, start - removedFirst), end - removedTotal);
        } else {
          const next = block
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n');
          applyEdit(from, end, next, start + 4, end + (next.length - block.length));
        }
      } else {
        applyEdit(start, end, '    ', start + 4, start + 4);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const indent = /^[ \t]*/.exec(text.slice(lineStart, start))?.[0] ?? '';
      if (start === end && text[start - 1] === '{' && text[start] === '}') {
        const inner = `${indent}    `;
        const insert = `\n${inner}\n${indent}`;
        applyEdit(start, start, insert, start + 1 + inner.length, start + 1 + inner.length);
        return;
      }
      const extraIndent = text.slice(lineStart, start).trimEnd().endsWith('{') ? '    ' : '';
      const insert = `\n${indent}${extraIndent}`;
      applyEdit(start, end, insert, start + insert.length, start + insert.length);
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && CLOSERS.has(e.key) && start === end && text[start] === e.key) {
      e.preventDefault();
      ta.setSelectionRange(start + 1, start + 1);
      setCaret(start + 1);
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && PAIRS[e.key]) {
      if (start !== end) {
        e.preventDefault();
        const selected = text.slice(start, end);
        const closing = PAIRS[e.key];
        applyEdit(start, end, `${e.key}${selected}${closing}`, start + 1, start + 1 + selected.length);
        return;
      }
      if (e.key === '"' || e.key === "'") {
        const prev = text[start - 1];
        if (prev && /[A-Za-z0-9_]/.test(prev)) return;
      }
      e.preventDefault();
      applyEdit(start, end, `${e.key}${PAIRS[e.key]}`, start + 1, start + 1);
      return;
    }
  };

  useEffect(() => {
    if (caret > value.length) setCaret(value.length);
  }, [value, caret]);

  useEffect(() => {
    if (!popup.open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (popupRef.current.open && !mainRef.current?.contains(e.target as Node)) closePopup();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [popup.open, closePopup]);

  const scrollTo = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setScroll({ x: el.scrollLeft, y: el.scrollTop });
  };

  return (
    <div className={cx('code-editor', composing && 'is-composing', readOnly && 'is-readonly')}>
      <div className="ce-toolbar">
        <span className="ce-lang">C</span>
        <span className="ce-file">main.c</span>
        {!readOnly && (
          <div className="ce-snips">
            {[
              { label: 'main', insert: 'int main(void) {\n    |\n    return 0;\n}' },
              { label: 'for', insert: 'for (int i = 0; i < |; i++) {\n    \n}' },
              { label: 'if', insert: 'if (|) {\n    \n}' },
              { label: 'printf', insert: 'printf("%d\\n", |);' },
              { label: '#include', insert: '#include <stdio.h>' },
            ].map((snip) => (
              <button
                key={snip.label}
                type="button"
                className="ce-snip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const ta = taRef.current;
                  if (!ta) return;
                  const pos = ta.selectionStart ?? 0;
                  const marker = snip.insert.indexOf('|');
                  const clean = marker >= 0 ? snip.insert.replace('|', '') : snip.insert;
                  applyEdit(pos, ta.selectionEnd ?? pos, clean, pos + (marker >= 0 ? marker : clean.length), pos + (marker >= 0 ? marker : clean.length));
                }}
                title={`插入 ${snip.label} 片段`}
              >
                {snip.label}
              </button>
            ))}
          </div>
        )}
        <div className="ce-toolbar-space" />
        {extra}
        <span className="ce-hint" title="Ctrl + 空格 或 Alt + /">
          {completion ? 'Ctrl+空格 补全' : '补全已关闭'}
        </span>
      </div>
      <div className="ce-body" style={{ height }}>
        <div className="ce-gutter" aria-hidden="true">
          <div className="ce-lines" style={{ transform: `translateY(${-scroll.y}px)` }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className={i + 1 === line ? 'active' : ''}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
        <div className="ce-main" ref={mainRef}>
          <pre className="ce-pre" aria-hidden="true">
            <code className="ce-code" style={{ transform: `translate(${-scroll.x}px, ${-scroll.y}px)` }}>
              {highlightC(value)}
            </code>
          </pre>
          <textarea
            ref={taRef}
            className="ce-input"
            value={value}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
            onChange={change}
            onKeyDown={onKeyDown}
            onScroll={scrollTo}
            onSelect={syncCaret}
            onClick={syncCaret}
            onKeyUp={syncCaret}
            onCompositionStart={() => {
              composingRef.current = true;
              setComposing(true);
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              setComposing(false);
              syncCaret();
            }}
          />
          {popup.open && (
            <div className="ce-popup" style={{ left: popup.x, top: popup.y, width: POPUP_W }}>
              <div className="ce-popup-head">
                <span>补全建议</span>
                <span>Tab / Enter 接受 · Esc 关闭</span>
              </div>
              <div className="ce-popup-list">
                {popup.items.map((item, index) => (
                  <button
                    key={`${item.kind}-${item.label}`}
                    type="button"
                    className={cx('ce-item', index === popup.index && 'active')}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => {
                      if (index !== popup.index) setPopup((p) => ({ ...p, index }));
                    }}
                    onClick={() => accept(item)}
                  >
                    <span className={`ce-kind ${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                    <span className="ce-label">{item.label}</span>
                    <span className="ce-detail">{item.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="ce-status">
        <span>
          第 {line} 行，第 {col} 列
        </span>
        <span>{readOnly ? '只读' : 'Tab 缩进 · 自动括号 · 代码补全'}</span>
      </div>
    </div>
  );
}
