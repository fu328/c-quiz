import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { RichText } from '../components/RichText';
import { Modal, ConfirmDialog } from '../components/Modal';
import { CodeEditor } from '../components/CodeEditor';
import { CodeBlock } from '../components/CodeBlock';
import { QTYPE_LABEL, type PracticeMode } from '../types';
import { answerText, hasCode, isCorrect, optionText, percent, plainStem, todayKey } from '../lib/utils';
import type { Route } from '../routes';
import { sampleQuestions } from '../data/sample';

const MODE_LABEL: Record<PracticeMode, string> = {
  sequence: '顺序练习',
  random: '随机练习',
  unseen: '未做题目',
  wrong: '错题重练',
  tag: '标签练习',
};

export function PracticeView({ navigate }: { navigate: (route: Route) => void }) {
  const { questions, session } = useApp();

  if (!questions.length) {
    return <EmptyBank navigate={navigate} />;
  }
  if (!session || !session.ids.length) {
    return <StartScreen navigate={navigate} />;
  }
  if (session.index >= session.ids.length) {
    return <FinishScreen navigate={navigate} />;
  }
  return <SessionView />;
}

/* ------------------------------ 空题库 ------------------------------ */

function EmptyBank({ navigate }: { navigate: (route: Route) => void }) {
  const { addQuestions, toast } = useApp();
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">刷题</h1>
          <div className="page-sub">题库还是空的，先录入几道题吧</div>
        </div>
      </div>
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="book" size={28} />
          </div>
          <h3>还没有题目</h3>
          <p>支持直接粘贴文字题目，或者把题目截图丢进来自动识别文字，几秒钟就能开始刷题。</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('import')}>
              <Icon name="upload" size={16} />
              去录入题目
            </button>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                const { added } = await addQuestions(sampleQuestions());
                toast(`已载入 ${added} 道示例题`);
              }}
            >
              <Icon name="sparkles" size={16} />
              载入示例题库
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ 开始页 ------------------------------ */

function StartScreen({ navigate }: { navigate: (route: Route) => void }) {
  const { questions, records, session, startSession, stats, addQuestions, toast } = useApp();
  const wrongCount = questions.filter((q) => records[q.id]?.wrongBook).length;
  const unseen = questions.filter((q) => !records[q.id]?.attempts).length;
  const done = questions.filter((q) => records[q.id]?.attempts).length;
  const totalAttempts = questions.reduce((sum, q) => sum + (records[q.id]?.attempts ?? 0), 0);
  const totalCorrect = questions.reduce((sum, q) => sum + (records[q.id]?.correct ?? 0), 0);

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((q) => q.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [questions]);

  const today = stats.find((s) => s.date === todayKey());

  const start = (mode: PracticeMode, tag?: string) => {
    const next = startSession(mode, tag);
    if (!next.ids.length) {
      toast(mode === 'wrong' ? '错题本是空的，先刷几题吧' : '没有符合条件的题目', 'info');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            刷题
            {session && session.ids.length > 0 && (
              <span className="badge brand" style={{ fontSize: 11 }}>
                上次进行到 {Math.min(session.index + 1, session.ids.length)}/{session.ids.length}
              </span>
            )}
          </h1>
          <div className="page-sub">
            题库共 {questions.length} 题 · 已练习 {done} 题 · 总正确率 {percent(totalCorrect, totalAttempts)}
            {today ? ` · 今日 ${today.total} 题` : ''}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => navigate('import')}>
            <Icon name="plus" size={16} />
            录入题目
          </button>
        </div>
      </div>

      <div className="start-hero">
        <h2>今天刷几道？</h2>
        <p>选择一种模式开始。答题过程会自动保存，随时可以关掉页面，下次接着刷。</p>
      </div>

      <div className="start-grid">
        <button className="start-card" onClick={() => start('sequence')}>
          <div className="icon-box">
            <Icon name="play" size={19} />
          </div>
          <div>
            <strong>顺序练习</strong>
            <span>按录入顺序刷完整题库，适合系统复习</span>
            <span className="count">{questions.length} 题</span>
          </div>
        </button>
        <button className="start-card ok" onClick={() => start('random')}>
          <div className="icon-box">
            <Icon name="refresh" size={19} />
          </div>
          <div>
            <strong>随机练习</strong>
            <span>打乱顺序，检验真实掌握程度</span>
            <span className="count">{questions.length} 题</span>
          </div>
        </button>
        <button className="start-card warn" onClick={() => start('wrong')}>
          <div className="icon-box">
            <Icon name="bookmark" size={19} />
          </div>
          <div>
            <strong>错题重练</strong>
            <span>只刷错题本中的题目，答对自动移出</span>
            <span className="count">{wrongCount} 题</span>
          </div>
        </button>
        <button className="start-card warn-2" onClick={() => start('unseen')}>
          <div className="icon-box">
            <Icon name="target" size={19} />
          </div>
          <div>
            <strong>未做题目</strong>
            <span>只刷还没做过的题，快速过一遍新题</span>
            <span className="count">{unseen} 题</span>
          </div>
        </button>
      </div>

      {tags.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h3>按标签练习</h3>
            <span>{tags.length} 个标签</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tags.map(([tag, count]) => (
              <button key={tag} className="chip clickable" onClick={() => start('tag', tag)}>
                <Icon name="tag" size={11} />
                {tag} · {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {questions.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="empty">
            <h3>题库为空</h3>
            <p>先录入一些题目，或直接载入示例题库体验一下。</p>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const { added } = await addQuestions(sampleQuestions());
                toast(`已载入 ${added} 道示例题`);
              }}
            >
              <Icon name="sparkles" size={16} />
              载入示例题库
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------ 刷题主界面 ------------------------------ */

function SessionView() {
  const {
    session,
    setSession,
    startSession,
    questionMap,
    settings,
    submitAnswer,
    toggleWrongBook,
    recordOf,
    toast,
  } = useApp();
  const [draft, setDraft] = useState<string[]>([]);
  const [fill, setFill] = useState('');
  const [codingDraft, setCodingDraft] = useState('');
  const [codingRevealed, setCodingRevealed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const ids = session?.ids ?? [];
  const index = session?.index ?? 0;
  const currentId = ids[index];
  const question = currentId ? questionMap.get(currentId) : undefined;
  const savedAnswer = currentId && session ? session.answers[currentId] : undefined;
  const revealed = savedAnswer !== undefined;
  const record = currentId ? recordOf(currentId) : null;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    setDraft(savedAnswer ?? []);
    setFill(savedAnswer && question?.type === 'fill' ? savedAnswer.join('') : '');
    setCodingRevealed(false);
    if (question?.type === 'coding') {
      const stored =
        savedAnswer?.[0] ??
        localStorage.getItem(`cquiz.draft.${question.id}`) ??
        question.code ??
        '';
      setCodingDraft(stored);
    } else {
      setCodingDraft('');
    }
    clearTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 切题时重置输入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // 编程题的草稿随时保存，避免切换页面后丢失
  useEffect(() => {
    if (!question || question.type !== 'coding') return;
    const key = `cquiz.draft.${question.id}`;
    if (revealed) {
      localStorage.removeItem(key);
      return;
    }
    const timer = window.setTimeout(() => {
      if (codingDraft.trim()) localStorage.setItem(key, codingDraft);
      else localStorage.removeItem(key);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [codingDraft, question, revealed]);

  // 题库变动导致当前题失效时，过滤掉失效题目
  useEffect(() => {
    if (!session) return;
    if (session.index < session.ids.length && !questionMap.get(session.ids[session.index])) {
      const valid = session.ids.filter((id) => questionMap.has(id));
      if (!valid.length) {
        startSession('sequence');
        return;
      }
      setSession({
        ...session,
        ids: valid,
        index: Math.min(session.index, valid.length - 1),
      });
    }
  }, [session, questionMap, setSession, startSession]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const current = sessionRef.current;
      if (!current) return;
      clearTimer();
      const next = Math.min(Math.max(current.index + dir, 0), current.ids.length);
      setSession({ ...current, index: next });
    },
    [setSession, clearTimer],
  );

  const submit = useCallback(
    (keys: string[]) => {
      if (!question || revealed || !keys.length) return;
      const correct = isCorrect(question, keys);
      void submitAnswer(question.id, keys, correct);
      if (correct && settings.autoNext && index < ids.length - 1) {
        clearTimer();
        timerRef.current = window.setTimeout(() => go(1), 850);
      }
      if (!correct) clearTimer();
    },
    [question, revealed, submitAnswer, settings.autoNext, index, ids.length, clearTimer, go],
  );

  const pickOption = (key: string) => {
    if (!question || revealed) return;
    if (question.type === 'multiple' || !settings.instantJudge) {
      setDraft((prev) => {
        if (question.type !== 'multiple') return [key];
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort();
      });
      return;
    }
    setDraft([key]);
    submit([key]);
  };

  const submitCoding = (correct: boolean) => {
    if (!question || revealed) return;
    localStorage.removeItem(`cquiz.draft.${question.id}`);
    clearTimer();
    void submitAnswer(question.id, [codingDraft], correct);
  };

  const sessionStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    ids.forEach((id) => {
      const ans = session?.answers[id];
      if (!ans) return;
      const q = questionMap.get(id);
      const passed = session?.results?.[id] ?? (q ? isCorrect(q, ans) : false);
      if (passed) correct += 1;
      else wrong += 1;
    });
    return { correct, wrong, answered: correct + wrong };
  }, [ids, session, questionMap]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (sheetOpen || confirmRestart) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (question && question.options.length && !revealed) {
        let idx = -1;
        if (/^[1-9]$/.test(key)) idx = Number(key) - 1;
        else if (/^[a-j]$/.test(key)) idx = key.charCodeAt(0) - 97;
        if (idx >= 0 && idx < question.options.length) {
          e.preventDefault();
          pickOption(question.options[idx].key);
          return;
        }
      }
      if (question?.type === 'judge' && !revealed && (key === '1' || key === '2')) {
        e.preventDefault();
        pickOption(key === '1' ? '对' : '错');
        return;
      }
      if (key === 'enter') {
        if (revealed) {
          e.preventDefault();
          go(1);
        } else if (
          question &&
          question.type !== 'fill' &&
          draft.length &&
          (question.type === 'multiple' || !settings.instantJudge)
        ) {
          e.preventDefault();
          submit(draft);
        } else if (question?.type === 'fill' && fill.trim()) {
          e.preventDefault();
          submit([fill.trim()]);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!session) return null;
  if (!question) return null;

  const ok = revealed
    ? session.results?.[question.id] ?? isCorrect(question, savedAnswer ?? [])
    : false;
  const isMultiple = question.type === 'multiple';
  const isJudge = question.type === 'judge';
  const isFill = question.type === 'fill';
  const isCoding = question.type === 'coding';
  const progress = Math.round((Math.min(index, ids.length) / ids.length) * 100);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">刷题</h1>
          <div className="page-sub">
            {MODE_LABEL[session.mode]}
            {session.mode === 'tag' && session.tag ? ` · ${session.tag}` : ''} · 共 {ids.length} 题
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRestart(true)}>
            <Icon name="refresh" size={14} />
            重新开始
          </button>
        </div>
      </div>

      <div className="practice-bar">
        <div className="progress-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">
            {index + 1} / {ids.length}
          </span>
        </div>
        <div className="session-stats">
          <span className="stat-pill ok">✓ {sessionStats.correct}</span>
          <span className="stat-pill bad">✗ {sessionStats.wrong}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setSheetOpen(true)}>
          <Icon name="list" size={14} />
          答题卡
        </button>
      </div>

      <div className="qcard">
        <div className="qcard-head">
          <span className="qindex">
            第 <b>{index + 1}</b> 题
          </span>
          <span className="badge outline">{QTYPE_LABEL[question.type]}</span>
          {hasCode(question) && (
            <span className="badge brand">
              <Icon name="code" size={10} />
              代码题
            </span>
          )}
          {question.tags
            .filter((tag) => tag !== QTYPE_LABEL[question.type])
            .map((tag) => (
              <span key={tag} className="badge">
                <Icon name="tag" size={10} />
                {tag}
              </span>
            ))}
          <span className="spacer" />
          {record?.wrongBook && <span className="badge bad">错题本</span>}
          {record && record.attempts > 0 && (
            <span className="badge outline" title="本题历史正确率">
              {record.correct}/{record.attempts}
            </span>
          )}
        </div>

        <div className="stem">
          <RichText text={question.stem} />
        </div>

        {question.code && !isCoding && <CodeBlock code={question.code} />}

        {isCoding && (
          <div className="coding-box">
            {revealed ? (
              <>
                <div className={`feedback ${ok ? 'ok' : 'bad'}`} style={{ marginTop: 0, marginBottom: 14 }}>
                  <div className="feedback-head">
                    <Icon name={ok ? 'checkCircle' : 'xCircle'} size={18} />
                    {ok ? '自评：写对了' : '自评：没写对'}
                    {ok && record && record.wrongBook && <span className="badge ok">已掌握？可移出错题本</span>}
                  </div>
                  <div className="feedback-answer">编程题按自评结果记录，可对照下方参考答案复盘。</div>
                  {question.explanation && (
                    <>
                      <div className="explain-label">解析</div>
                      <div className="explain">
                        <RichText text={question.explanation} />
                      </div>
                    </>
                  )}
                </div>
                <CodeBlock code={savedAnswer?.[0] ?? ''} title="你的代码" />
                {question.referenceCode && (
                  <div style={{ marginTop: 12 }}>
                    <CodeBlock code={question.referenceCode} title="参考答案" />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="field" style={{ marginTop: 18 }}>
                  <label>
                    编写代码
                    <span className="hint">支持补全、Tab 缩进、自动括号，Ctrl+空格 / Alt+/ 触发建议</span>
                  </label>
                  <CodeEditor
                    value={codingDraft}
                    onChange={setCodingDraft}
                    height={320}
                    completion={settings.codeCompletion}
                  />
                </div>
                {!codingRevealed ? (
                  <div className="coding-toolbar">
                    <button className="btn btn-soft" onClick={() => setCodingRevealed(true)}>
                      <Icon name="eye" size={15} />
                      查看参考答案并自评
                    </button>
                    <span className="badge outline">编程题不会自动判分，需对照参考代码自评</span>
                  </div>
                ) : (
                  <>
                    {question.referenceCode && <CodeBlock code={question.referenceCode} title="参考答案" />}
                    <div className="coding-assess">
                      <strong>对照参考代码，你写对了吗？</strong>
                      <p>选择后会记录本次作答；写错的题会自动进入错题本。</p>
                      <div className="row">
                        <button className="btn btn-primary" onClick={() => submitCoding(true)}>
                          <Icon name="check" size={15} />
                          我写对了
                        </button>
                        <button className="btn btn-danger" onClick={() => submitCoding(false)}>
                          <Icon name="x" size={15} />
                          没写对
                        </button>
                        <button className="btn btn-ghost" onClick={() => setCodingRevealed(false)}>
                          继续修改
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {!isFill && !isJudge && !isCoding && (
          <div className="options">
            {question.options.map((option) => {
              const picked = draft.includes(option.key);
              const isRight = question.answer.includes(option.key);
              let cls = 'option';
              if (revealed) {
                cls += ' locked';
                if (isRight) cls += ' is-correct';
                else if (picked) cls += ' is-wrong';
                else cls += ' is-dim';
              } else if (picked) {
                cls += ' is-picked';
              }
              return (
                <button key={option.key} className={cls} onClick={() => pickOption(option.key)} disabled={revealed}>
                  <span className="key">{option.key}</span>
                  <span className="opt-body">
                    <RichText text={option.text} />
                  </span>
                  {revealed && isRight && <Icon className="opt-mark" name="checkCircle" size={17} />}
                  {revealed && !isRight && picked && <Icon className="opt-mark" name="xCircle" size={17} />}
                </button>
              );
            })}
          </div>
        )}

        {isJudge && (
          <div className="options">
            {['对', '错'].map((key) => {
              const picked = draft.includes(key);
              const isRight = question.answer[0] === key;
              let cls = 'option';
              if (revealed) {
                cls += ' locked';
                if (isRight) cls += ' is-correct';
                else if (picked) cls += ' is-wrong';
                else cls += ' is-dim';
              } else if (picked) {
                cls += ' is-picked';
              }
              return (
                <button key={key} className={cls} onClick={() => pickOption(key)} disabled={revealed}>
                  <span className="key">{key === '对' ? '√' : '×'}</span>
                  <span className="opt-body">{key === '对' ? '正确' : '错误'}</span>
                  {revealed && isRight && <Icon className="opt-mark" name="checkCircle" size={17} />}
                  {revealed && !isRight && picked && <Icon className="opt-mark" name="xCircle" size={17} />}
                </button>
              );
            })}
          </div>
        )}

        {isFill && (
          <form
            className="fill-answer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!revealed && fill.trim()) submit([fill.trim()]);
            }}
          >
            <input
              className="input"
              placeholder="在此输入答案，按 Enter 提交"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              disabled={revealed}
              autoComplete="off"
              spellCheck={false}
            />
            {!revealed && (
              <button className="btn btn-primary" type="submit" disabled={!fill.trim()}>
                提交
              </button>
            )}
          </form>
        )}

        {!revealed && !isFill && (isMultiple || !settings.instantJudge) && (
          <div className="submit-bar">
            <Icon name="info" size={14} />
            <span>
              {isMultiple ? '多选题，可选择多个选项' : '选择后点击提交'}，已选{' '}
              <b>{draft.length ? draft.join('、') : '0'}</b> 项
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => submit(draft)} disabled={!draft.length}>
              提交答案
            </button>
          </div>
        )}

        {revealed && !isCoding && (
          <div className={`feedback ${ok ? 'ok' : 'bad'}`}>
            <div className="feedback-head">
              <Icon name={ok ? 'checkCircle' : 'xCircle'} size={18} />
              {ok ? '回答正确' : '回答错误'}
              {ok && record && record.wrongBook && <span className="badge ok">已掌握？可移出错题本</span>}
            </div>
            <div className="feedback-answer">
              正确答案：<b>{answerText(question)}</b>
              {!isFill && question.options.length > 0 && (
                <span style={{ color: 'var(--muted)' }}> （{optionText(question, question.answer)}）</span>
              )}
            </div>
            {isFill && (
              <div className="feedback-answer">
                你的答案：<b>{savedAnswer?.join(' ') || '—'}</b>
              </div>
            )}
            {isMultiple && (
              <div className="feedback-answer">
                你的选择：<b>{savedAnswer?.join('') || '—'}</b>
              </div>
            )}
            {question.explanation && (
              <>
                <div className="explain-label">解析</div>
                <div className="explain">
                  <RichText text={question.explanation} />
                </div>
              </>
            )}
          </div>
        )}

        <div className="qfoot">
          <div className="qfoot-left">
            <button className="btn btn-ghost" onClick={() => go(-1)} disabled={index === 0}>
              <Icon name="left" size={15} />
              上一题
            </button>
            <button
              className={`btn btn-sm ${record?.wrongBook ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => {
                void toggleWrongBook(question.id);
                toast(record?.wrongBook ? '已移出错题本' : '已加入错题本', 'info');
              }}
              title="标记 / 取消标记错题"
            >
              <Icon name="bookmark" size={14} />
              {record?.wrongBook ? '已在错题本' : '标记错题'}
            </button>
          </div>
          <div className="qfoot-right">
            {!revealed && (
              <button className="btn btn-ghost" onClick={() => go(1)}>
                跳过
              </button>
            )}
            <button className="btn btn-primary" onClick={() => go(1)}>
              {revealed ? (index === ids.length - 1 ? '完成练习' : '下一题') : '下一题'}
              <Icon name="right" size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="qhint">
        {isCoding ? (
          <span>写代码时支持 Ctrl+空格 / Alt+/ 补全、Tab 缩进；完成后点击「查看参考答案并自评」</span>
        ) : (
          <span>
            {isJudge ? (
              <>
                <kbd>1</kbd> 正确 <kbd>2</kbd> 错误
              </>
            ) : (
              <>
                <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> 或 <kbd>1</kbd>-<kbd>4</kbd> 选择
              </>
            )}
          </span>
        )}
        {!isCoding && (
          <>
            <span>
              <kbd>Enter</kbd> 提交 / 下一题
            </span>
            <span>
              <kbd>←</kbd> <kbd>→</kbd> 切题
            </span>
            {settings.autoNext && <span>答对后自动进入下一题</span>}
          </>
        )}
      </div>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title={`答题卡 · ${sessionStats.answered}/${ids.length} 已作答`}>
        <div className="sheet-legend">
          <span>
            <i className="dot ok" /> 答对 {sessionStats.correct}
          </span>
          <span>
            <i className="dot bad" /> 答错 {sessionStats.wrong}
          </span>
          <span>
            <i className="dot current" /> 当前
          </span>
          <span>
            <i className="dot" /> 未作答 {ids.length - sessionStats.answered}
          </span>
        </div>
        <div className="sheet-grid">
          {ids.map((id, i) => {
            const ans = session?.answers[id];
            const q = questionMap.get(id);
            const passed = session?.results?.[id] ?? (q && ans ? isCorrect(q, ans) : false);
            const cls = ans ? (passed ? 'ok' : 'bad') : '';
            return (
              <button
                key={id}
                className={`sheet-cell ${cls} ${i === index ? 'current' : ''}`}
                onClick={() => {
                  clearTimer();
                  setSession({ ...session, index: i });
                  setSheetOpen(false);
                }}
                title={q ? plainStem(q.stem, 60) : ''}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRestart}
        title="重新开始练习？"
        description="当前这套题目的作答进度会被清空（历史答题记录仍会保留）。"
        confirmText="重新开始"
        danger
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          startSession(session.mode, session.tag);
        }}
      />
    </>
  );
}

/* ------------------------------ 完成页 ------------------------------ */

function FinishScreen({ navigate }: { navigate: (route: Route) => void }) {
  const { session, questionMap, startSession } = useApp();
  const ids = session?.ids ?? [];
  const answers = session?.answers ?? {};
  let correct = 0;
  ids.forEach((id) => {
    const ans = answers[id];
    const q = questionMap.get(id);
    const passed = session?.results?.[id] ?? (q && ans ? isCorrect(q, ans) : false);
    if (ans && passed) correct += 1;
  });
  const answered = ids.filter((id) => answers[id]).length;
  const accuracy = percent(correct, answered);

  return (
    <div className="card">
      <div className="finish">
        <div className="finish-badge">
          <Icon name="check" size={34} />
        </div>
        <h2>练习完成</h2>
        <p>
          {session?.mode === 'wrong' ? '错题重练' : MODE_LABEL[session?.mode ?? 'sequence']} · 共 {ids.length} 题
        </p>
        <div className="finish-stats">
          <div>
            <strong>{answered}</strong>
            <span>已作答</span>
          </div>
          <div>
            <strong style={{ color: 'var(--ok)' }}>{correct}</strong>
            <span>答对</span>
          </div>
          <div>
            <strong style={{ color: 'var(--bad)' }}>{answered - correct}</strong>
            <span>答错</span>
          </div>
          <div>
            <strong>{accuracy}</strong>
            <span>正确率</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => startSession(session?.mode ?? 'sequence', session?.tag)}>
            <Icon name="refresh" size={15} />
            再来一轮
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('wrong')}>
            <Icon name="bookmark" size={15} />
            复习错题
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('stats')}>
            <Icon name="chart" size={15} />
            查看统计
          </button>
        </div>
      </div>
    </div>
  );
}
