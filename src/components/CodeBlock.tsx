import { useMemo, useState } from 'react';
import { highlightC } from '../lib/highlight';
import { cx } from '../lib/utils';
import { Icon } from './Icon';

interface Props {
  code: string;
  lang?: string;
  title?: string;
  lineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({ code, lang = 'c', title, lineNumbers = true, className }: Props) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cx('code-block', className)}>
      <div className="code-bar">
        <span className="code-lang">{lang}</span>
        {title && <span className="code-title">{title}</span>}
        <button className="code-copy" onClick={() => void copy()} title="复制代码">
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="code-body">
        <div className="code-inner">
          {lineNumbers && (
            <div className="code-gutter" aria-hidden="true">
              {lines.map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
          )}
          <pre>
            <code>{highlightC(code.replace(/\n$/, ''))}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
