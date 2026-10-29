import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { QuestionEditor } from '../components/QuestionEditor';
import { ConfirmDialog } from '../components/Modal';
import { QTYPE_LABEL, type QType, type Question } from '../types';
import { answerText, hasCode, percent, plainStem } from '../lib/utils';
import type { Route } from '../routes';
import { sampleQuestions } from '../data/sample';

type StatusFilter = 'all' | 'unseen' | 'wrong' | 'done';
type SortKey = 'new' | 'old' | 'wrong';

export function BankView({ navigate }: { navigate: (route: Route) => void }) {
  const { questions, records, startCustom, removeQuestion, addQuestions, toast } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | QType>('all');
  const [codeOnly, setCodeOnly] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('new');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);
  const [limit, setLimit] = useState(60);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = questions.filter((q) => {
      if (typeFilter !== 'all' && q.type !== typeFilter) return false;
      if (codeOnly && !hasCode(q)) return false;
      const record = records[q.id];
      if (status === 'unseen' && record?.attempts) return false;
      if (status === 'done' && !record?.attempts) return false;
      if (status === 'wrong' && !record?.wrongBook) return false;
      if (!keyword) return true;
      const haystack = [
        q.stem,
        q.explanation,
        q.code ?? '',
        q.referenceCode ?? '',
        ...q.tags,
        ...q.options.map((o) => o.text),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
    if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'old') list.sort((a, b) => a.createdAt - b.createdAt);
    if (sort === 'wrong') list.sort((a, b) => (records[b.id]?.wrong ?? 0) - (records[a.id]?.wrong ?? 0));
    return list;
  }, [questions, records, search, typeFilter, codeOnly, status, sort]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (question: Question) => {
    setEditing(question);
    setEditorOpen(true);
  };

  const practiceOne = (question: Question) => {
    startCustom([question.id]);
    navigate('practice');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">题目管理</h1>
          <div className="page-sub">
            共 {questions.length} 题
            {questions.length > 0 && ` · 已练习 ${questions.filter((q) => records[q.id]?.attempts).length} 题`}
            {questions.some(hasCode) && ` · 代码题 ${questions.filter(hasCode).length} 题`}
          </div>
        </div>
        <div className="page-actions">
          {questions.length === 0 && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const { added } = await addQuestions(sampleQuestions());
                toast(`已载入 ${added} 道示例题`);
              }}
            >
              <Icon name="sparkles" size={16} />
              载入示例
            </button>
          )}
          <button className="btn btn-primary" onClick={openNew}>
            <Icon name="plus" size={16} />
            新增题目
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span className="icon">
            <Icon name="search" size={15} />
          </span>
          <input
            className="input"
            placeholder="搜索题干、选项、解析或标签…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | QType)}>
          <option value="all">全部题型</option>
          {(['single', 'multiple', 'judge', 'fill', 'coding'] as QType[]).map((t) => (
            <option key={t} value={t}>
              {QTYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button
          className={`chip clickable ${codeOnly ? 'active' : ''}`}
          style={{ height: 38, padding: '0 12px', fontSize: 12.5 }}
          onClick={() => setCodeOnly((v) => !v)}
          title="只显示带代码的阅读题和编程题"
        >
          <Icon name="code" size={13} />
          只看代码题
        </button>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">全部状态</option>
          <option value="unseen">未做过</option>
          <option value="done">做过的</option>
          <option value="wrong">在错题本</option>
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="new">最新录入</option>
          <option value="old">最早录入</option>
          <option value="wrong">错误最多</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <Icon name={questions.length ? 'search' : 'book'} size={26} />
            </div>
            <h3>{questions.length ? '没有匹配的题目' : '题库还是空的'}</h3>
            <p>{questions.length ? '换个关键词或筛选条件试试。' : '手动新增，或者把题目文字 / 截图批量导入。'}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={openNew}>
                <Icon name="plus" size={16} />
                新增题目
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('import')}>
                <Icon name="upload" size={16} />
                批量导入
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="qlist">
          {filtered.slice(0, limit).map((question) => {
            const record = records[question.id];
            return (
              <div className="qrow" key={question.id}>
                <span className={`type-tag ${question.type}`}>{QTYPE_LABEL[question.type].slice(0, 1)}</span>
                <div className="qrow-main" onClick={() => openEdit(question)}>
                  <div className="qrow-title">{plainStem(question.stem, 180)}</div>
                  <div className="qrow-meta">
                    {question.tags
                      .filter((tag) => tag !== QTYPE_LABEL[question.type])
                      .map((tag) => (
                        <span key={tag} className="badge">
                          {tag}
                        </span>
                      ))}
                    {hasCode(question) && (
                      <span className="badge brand">
                        <Icon name="code" size={10} />
                        代码
                      </span>
                    )}
                    <span>答案 {answerText(question)}</span>
                    <span>作答 {record?.attempts ?? 0} 次</span>
                    {record && record.attempts > 0 && <span>正确率 {percent(record.correct, record.attempts)}</span>}
                    {record?.wrongBook && <span className="badge bad">错题</span>}
                  </div>
                </div>
                <div className="qrow-side">
                  <button className="icon-btn" title="练习这道题" onClick={() => practiceOne(question)}>
                    <Icon name="play" size={15} />
                  </button>
                  <button className="icon-btn" title="编辑" onClick={() => openEdit(question)}>
                    <Icon name="edit" size={15} />
                  </button>
                  <button className="icon-btn danger" title="删除" onClick={() => setPendingDelete(question)}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="list-foot">
            <span>
              显示 {Math.min(limit, filtered.length)} / {filtered.length} 题
            </span>
            {filtered.length > limit && (
              <button className="btn btn-ghost btn-sm" onClick={() => setLimit((n) => n + 60)}>
                加载更多
              </button>
            )}
          </div>
        </div>
      )}

      <QuestionEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onDeleted={() => setEditorOpen(false)}
      />

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
