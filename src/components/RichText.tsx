import { Fragment, useMemo, type ReactNode } from 'react';
import { cx } from '../lib/utils';
import { CodeBlock } from './CodeBlock';

interface CodePart {
  code: boolean;
  text: string;
  lang: string;
}

function splitCode(text: string): CodePart[] {
  const parts: CodePart[] = [];
  const regex = /```([a-zA-Z0-9+#-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push({ code: false, text: text.slice(last, match.index), lang: '' });
    parts.push({ code: true, text: match[2].replace(/\n$/, ''), lang: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last), lang: '' });
  return parts;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((chunk, i) => {
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      return <code key={i} className="inline-code">{chunk.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{chunk}</Fragment>;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => splitCode(text), [text]);
  if (!parts.some((p) => p.code)) {
    return <div className={cx('rich', className)}>{renderInline(text)}</div>;
  }
  return (
    <div className={cx('rich', className)}>
      {parts.map((part, i) =>
        part.code ? (
          <CodeBlock key={i} code={part.text} lang={part.lang || 'c'} />
        ) : (
          <div className="rich-text" key={i}>
            {renderInline(part.text)}
          </div>
        ),
      )}
    </div>
  );
}
