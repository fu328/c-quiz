import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { CodeBlock } from '../components/CodeBlock';
import { QTYPE_LABEL, type Question } from '../types';
import { answerText, formatDateTime, optionText, plainStem } from '../lib/utils';
import type { Route } from '../routes';
import { RichText } from '../components/RichText';

export function WrongView({ navigate }: { navigate: (route: Route) => void }) {
  const { questions, records, startSession, startCustom, markMastered, removeQuestion, toast } = useApp();
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'recent' | 'count'>('recent');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  const wrongList = useMemo(() => {
    const list = questions.filter((q) => records[q.id]?.wrongBook);
    const filtered = keyword.trim()
      ? list.filter((q) => {
          const hay = `${q.stem} ${q.tags.join(' ')} ${q.explanation}`.toLowerCase();
          return hay.includes(keyword.trim().toLowerCase());
        })
      : list;
    return filtered.sort((a, b) => {
      if (sort === 'count') return (records[b.id]?.wrong ?? 0) - (records[a.id]?.wrong ?? 0);
      return (records[b.id]?.lastAt ?? 0) - (records[a.id]?.lastAt ?? 0);
    });
  }, [questions, records, keyword, sort]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            错题本
            {wrongList.length > 0 && <span className="badge bad">{wrongList.length}</span>}
          </h1>
          <div className="page-sub">
            答错的题会自动收进这里，答对后自动移出；也可以手动标记已掌握
          </div>
        </div>
        <div className="page-actions">
          {wrongList.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={() => navigate('practice')}>
                <Icon name="play" size={15} />
                去刷题
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  startSession('wrong');
                  navigate('practice');
                }}
              >
                <Icon name="refresh" size={15} />
                一键重练
              </button>
            </>
          )}
        </div>
      </div>

      {wrongList.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon" style={{ background: 'var(--ok-tint)', color: 'var(--ok)' }}>
              <Icon name="checkCircle" size={30} />
            </div>
            <h3>错题本是空的</h3>
            <p>
              {questions.length === 0
                ? '先去录入一些题目，答错的题会自动收集到这里。'
                : '没有错题，状态不错。继续刷题保持手感吧。'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('practice')}>
                <Icon name="play" size={15} />
                开始刷题
              </button>
              {questions.length === 0 && (
                <button className="btn btn-ghost" onClick={() => navigate('import')}>
                  <Icon name="upload" size={15} />
                  录入题目
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search-box">
              <span className="icon">
                <Icon name="search" size={15} />
              </span>
              <input
                className="input"
                placeholder="搜索错题…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'count')}>
              <option value="recent">最近答错</option>
              <option value="count">错得最多</option>
            </select>
          </div>

          <div className="wrong-list">
            {wrongList.map((question) => {
              const record = records[question.id];
              const isOpen = expanded.has(question.id);
              return (
                <div className="wrong-card" key={question.id}>
                  <div className="wrong-head">
                    <span className={`type-tag ${question.type}`}>{QTYPE_LABEL[question.type].slice(0, 1)}</span>
                    {question.tags
                      .filter((tag) => tag !== QTYPE_LABEL[question.type])
                      .map((tag) => (
                        <span key={tag} className="badge">
                          {tag}
                        </span>
                      ))}
                    <span className="badge bad">错 {record?.wrong ?? 0} 次</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>最近 {formatDateTime(record?.lastAt ?? 0)}</span>
                    <div className="spacer" />
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(question.id)}>
                      <Icon name={isOpen ? 'arrowUp' : 'arrowDown'} size={13} />
                      {isOpen ? '收起' : '看答案'}
                    </button>
                  </div>
                  <div className="wrong-stem">{plainStem(question.stem, 240)}</div>

                  {isOpen && (
                    <div className="wrong-answer">
                      {question.type === 'coding' ? (
                        <>
                          <div>编程题 · 参考代码见下方</div>
                          {question.referenceCode && (
                            <div style={{ marginTop: 8 }}>
                              <CodeBlock code={question.referenceCode} title="参考答案" lineNumbers />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            正确答案：<b>{answerText(question)}</b>
                            {question.options.length > 0 && (
                              <span style={{ color: 'var(--muted)' }}>（{optionText(question, question.answer)}）</span>
                            )}
                          </div>
                          {record?.lastAnswer?.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              上次作答：<span style={{ color: 'var(--bad)' }}>{record.lastAnswer.join(' / ')}</span>
                            </div>
                          )}
                        </>
                      )}
                      {question.code && (
                        <div style={{ marginTop: 10 }}>
                          <CodeBlock code={question.code} title="题目代码" />
                        </div>
                      )}
                      {question.explanation && (
                        <div style={{ marginTop: 8 }}>
                          <div className="explain-label">解析</div>
                          <div className="explain" style={{ borderTop: 'none', paddingTop: 0 }}>
                            <RichText text={question.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="wrong-foot">
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={() => {
                        startCustom([question.id]);
                        navigate('practice');
                      }}
                    >
                      <Icon name="play" size={13} />
                      重做此题
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        void markMastered(question.id);
                        toast('已标记掌握，移出错题本');
                      }}
                    >
                      <Icon name="check" size={13} />
                      已掌握
                    </button>
                    <div className="spacer" />
                    <button
                      className="icon-btn danger"
                      title="删除题目"
                      onClick={() => setPendingDelete(question)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这道题？"
        description="题目及其答题记录会被永久删除，无法恢复。"
        confirmText="删除"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void removeQuestion(pendingDelete.id).then(() => {
            toast('题目已删除');
            setPendingDelete(null);
          });
        }}
      />
    </>
  );
}
