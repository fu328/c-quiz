import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { parseQuestions, answerFromInput, type ParsedQuestion } from '../lib/parse';
import { ocrStatusText, recognizeImage } from '../lib/ocr';
import { plainStem, uid } from '../lib/utils';
import type { Route } from '../routes';
import type { Question } from '../types';

type OcrStatus = 'pending' | 'running' | 'done' | 'error';

interface OcrItem {
  id: string;
  file: File;
  url: string;
  status: OcrStatus;
  error?: string;
}

const EXAMPLE = `1. 下列哪一个不是 C 语言的关键字？
A. static
B. struct
C. string
D. sizeof
答案：C
解析：string 不是关键字，标准库中对应的是 <string.h>。
标签：基础语法

2. 以下关于数组的说法，正确的有？
A. 数组名可以赋值给同类型指针
B. 数组的大小在定义时必须确定（C99 变长数组除外）
C. 数组下标可以越界访问而不报错
D. 可以用 a = b 的方式整体赋值两个数组
答案：A、B、C
标签：数组

3. 判断：指针变量本身也占用内存空间。
答案：对
解析：指针变量存放地址，32 位平台通常占 4 字节。

4. 填空：C 语言中求字符串长度的库函数是 ____ 。
答案：strlen
标签：字符串`;

export function ImportView({ navigate }: { navigate: (route: Route) => void }) {
  const { settings, addQuestions, toast } = useApp();
  const [tab, setTab] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedQuestion[]>([]);
  const [tags, setTags] = useState('');
  const [items, setItems] = useState<OcrItem[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [progress, setProgress] = useState({ index: 0, total: 0, status: '', value: 0 });
  const [drag, setDrag] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const urlsRef = useRef<string[]>([]);

  const pendingCount = items.filter((i) => i.status !== 'done').length;

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (!images.length) {
        toast('请选择图片文件', 'error');
        return;
      }
      const created = images.map((file) => ({
        id: uid('img'),
        file,
        url: URL.createObjectURL(file),
        status: 'pending' as OcrStatus,
      }));
      urlsRef.current.push(...created.map((c) => c.url));
      setItems((prev) => [...prev, ...created]);
    },
    [toast],
  );

  useEffect(() => {
    if (tab !== 'image') return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tab, addFiles]);

  const runParse = (source?: string) => {
    const raw = source ?? text;
    const list = parseQuestions(raw);
    if (!list.length) {
      toast('没有识别到题目，检查一下格式或补充答案行', 'error');
      setPreview([]);
      return;
    }
    setPreview(list);
    toast(`识别到 ${list.length} 道题，请确认后导入`, 'info');
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const recognizeAll = async () => {
    if (ocrBusy) return;
    const queue = items.filter((i) => i.status !== 'done');
    if (!queue.length) {
      toast('没有待识别的图片', 'info');
      return;
    }
    setOcrBusy(true);
    let combined = text;
    const total = queue.length;
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      setProgress({ index: i + 1, total, status: '准备中…', value: 0 });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'running' } : x)));
      try {
        const result = await recognizeImage(item.file, settings.ocrLang, (s) => {
          setProgress({ index: i + 1, total, status: ocrStatusText(s.status), value: s.progress ?? 0 });
        });
        if (!result.trim()) throw new Error('没有识别到文字');
        combined = combined ? `${combined}\n\n${result}` : result;
        setText(combined);
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'done' } : x)));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'error', error: message } : x)));
        toast(`第 ${i + 1} 张识别失败：${message}`, 'error');
      }
    }
    setOcrBusy(false);
    setProgress((p) => ({ ...p, status: '识别完成', value: 1 }));
    runParse(combined);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        urlsRef.current = urlsRef.current.filter((u) => u !== target.url);
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearImages = () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    urlsRef.current = [];
    setItems([]);
  };

  const missingAnswers = preview.filter((p) => !p.answer.length).length;

  const doImport = async () => {
    if (!preview.length || importing) return;
    if (missingAnswers > 0) {
      toast(`还有 ${missingAnswers} 道题没有答案，补全后再导入`, 'error');
      return;
    }
    setImporting(true);
    const globalTags = tags
      .split(/[,，、;；\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const now = Date.now();
    const list: Question[] = preview.map((p, index) => ({
      id: uid('q'),
      type: p.type,
      stem: p.stem,
      options: p.options,
      answer: p.answer,
      explanation: p.explanation,
      tags: p.tags.length ? p.tags : globalTags,
      createdAt: now + index,
      updatedAt: now + index,
    }));
    try {
      const { added, skipped } = await addQuestions(list);
      toast(`成功导入 ${added} 题${skipped ? `，跳过 ${skipped} 道重复题` : ''}`);
      setPreview([]);
      setText('');
      clearImages();
      navigate('bank');
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setImporting(false);
    }
  };

  const updateAnswer = (index: number, value: string) => {
    setPreview((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        return { ...p, answer: answerFromInput(p.type, value) };
      }),
    );
  };

  const answerFieldValue = (p: ParsedQuestion) => {
    if (p.type === 'fill') return p.answer.join('|');
    return p.answer.join('');
  };

  const tagCount = useMemo(() => {
    const set = new Set<string>();
    preview.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return set.size;
  }, [preview]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">录入题目</h1>
          <div className="page-sub">粘贴文字或上传截图，自动拆分成题目，确认后加入题库</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('bank')}>
            <Icon name="book" size={15} />
            查看题库
          </button>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 14 }}>
        <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
          <Icon name="text" size={14} />
          文字录入
        </button>
        <button className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>
          <Icon name="image" size={14} />
          图片识别
        </button>
      </div>

      {tab === 'text' ? (
        <div className="import-pane">
          <div className="import-pane-head">
            <Icon name="text" size={16} />
            <strong>粘贴题目文本</strong>
            <span className="badge outline">支持批量</span>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => setText(EXAMPLE)}>
              <Icon name="sparkles" size={14} />
              填入示例格式
            </button>
          </div>
          <div className="import-pane-body">
            <textarea
              className="textarea import-textarea"
              placeholder={'把题目和答案粘贴到这里，例如：\n\n1. 下列说法正确的是？\nA. 选项一\nB. 选项二\n答案：A\n解析：……'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <FormatHelp />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => runParse()} disabled={!text.trim()}>
                <Icon name="sparkles" size={15} />
                解析并预览
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setText('');
                  setPreview([]);
                }}
                disabled={!text && !preview.length}
              >
                清空
              </button>
              <span style={{ flex: 1 }} />
              <span className="badge outline" style={{ alignSelf: 'center' }}>
                {text.length} 字符
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="import-pane">
          <div className="import-pane-head">
            <Icon name="image" size={16} />
            <strong>截图 / 照片识别</strong>
            <span className="badge outline">{settings.ocrLang === 'eng' ? '英文' : '中英混合'}</span>
            <div className="spacer" />
            {items.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearImages} disabled={ocrBusy}>
                <Icon name="trash" size={14} />
                清空
              </button>
            )}
          </div>
          <div className="import-pane-body">
            <div
              className={`dropzone ${drag ? 'drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <div className="dz-icon">
                <Icon name="upload" size={26} />
              </div>
              <strong>拖拽图片到这里，或点击选择文件</strong>
              <span>支持 PNG / JPG / WebP，可一次选择多张</span>
              <div className="shortcut">也可以直接 Ctrl + V 粘贴截图</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (e.target.files) addFiles(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />
            </div>

            {items.length > 0 && (
              <div className="thumbs">
                {items.map((item) => (
                  <div className="thumb" key={item.id}>
                    <img src={item.url} alt="待识别图片" />
                    <button onClick={() => removeItem(item.id)} title="移除" disabled={ocrBusy}>
                      <Icon name="x" size={12} />
                    </button>
                    <span className="thumb-status">
                      {item.status === 'pending'
                        ? '待识别'
                        : item.status === 'running'
                          ? '识别中…'
                          : item.status === 'done'
                            ? '已识别'
                            : '失败'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {ocrBusy && (
              <div className="ocr-progress">
                <div className="label">
                  <span>
                    {progress.status}（第 {progress.index}/{progress.total} 张）
                  </span>
                  <span>{Math.round((progress.value ?? 0) * 100)}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.round((progress.value ?? 0) * 100)}%` }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => void recognizeAll()} disabled={ocrBusy || !items.length}>
                {ocrBusy ? <Icon name="refresh" size={15} className="spin" /> : <Icon name="sparkles" size={15} />}
                {ocrBusy ? '识别中…' : `开始识别${pendingCount ? `（${pendingCount} 张）` : ''}`}
              </button>
              {items.length > 0 && !ocrBusy && (
                <span className="badge outline">首次识别需要加载语言包，可能要等几秒</span>
              )}
            </div>

            <details className="format-help" style={{ marginTop: 14 }}>
              <summary>
                <Icon name="info" size={14} />
                识别小贴士
              </summary>
              <ul>
                <li>截图尽量清晰、横向，避免大面积阴影和倾斜。</li>
                <li>识别结果会追加到下方文本框，可先手动改错字再解析。</li>
                <li>题干里的代码建议截图后人工校正，OCR 对代码符号容易出错。</li>
                <li>答案也可以截图识别，或导入后统一在题库里补。</li>
              </ul>
            </details>

            <div className="field" style={{ marginTop: 16 }}>
              <label>
                识别结果 <span className="hint">可以手动修正后再解析</span>
              </label>
              <textarea
                className="textarea import-textarea"
                style={{ minHeight: 160 }}
                value={text}
                placeholder="识别出的文字会出现在这里…"
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => runParse()} disabled={!text.trim()}>
                <Icon name="sparkles" size={15} />
                解析并预览
              </button>
            </div>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div ref={previewRef} style={{ marginTop: 20 }}>
          <div className="panel-head" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 15 }}>
              解析结果 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {preview.length} 题</span>
              {missingAnswers > 0 && (
                <span className="badge bad" style={{ marginLeft: 8 }}>
                  {missingAnswers} 题待补答案
                </span>
              )}
              {tagCount > 0 && <span className="badge" style={{ marginLeft: 6 }}>{tagCount} 个标签</span>}
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview([])}>
              取消
            </button>
          </div>

          <div className="preview-toolbar">
            <input
              className="input"
              style={{ maxWidth: 260, height: 36 }}
              placeholder="统一标签（可选），如：指针"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <div className="spacer" />
            <button className="btn btn-primary" onClick={() => void doImport()} disabled={importing || missingAnswers > 0}>
              <Icon name="download" size={15} />
              导入 {preview.length} 题
            </button>
          </div>

          <div className="preview-list">
            {preview.map((p, index) => {
              const type = p.type;
              return (
                <div className="preview-item" key={`${index}-${plainStem(p.stem, 20)}`}>
                  <div className="preview-head">
                    <span className="qindex">#{index + 1}</span>
                    <span className="badge brand">
                      {type === 'single' ? '单选' : type === 'multiple' ? '多选' : type === 'judge' ? '判断' : '填空'}
                    </span>
                    {p.tags.map((t) => (
                      <span key={t} className="badge">
                        {t}
                      </span>
                    ))}
                    {p.stem.includes('```') && (
                      <span className="badge brand">
                        <Icon name="code" size={10} />
                        含代码
                      </span>
                    )}
                    {p.warnings.map((w) => (
                      <span key={w} className="badge warn">
                        {w}
                      </span>
                    ))}
                    <div className="spacer" style={{ flex: 1 }} />
                    <button
                      className="icon-btn danger"
                      onClick={() => setPreview((prev) => prev.filter((_, i) => i !== index))}
                      title="移除"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <div className="preview-stem">{p.stem}</div>
                  {p.options.length > 0 && (
                    <div className="preview-opts">
                      {p.options.map((o) => (
                        <span key={o.key}>
                          {o.key}. {o.text.replace(/\n/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="preview-answer">
                    <span>答案</span>
                    <input
                      className="input"
                      value={answerFieldValue(p)}
                      placeholder={type === 'fill' || type === 'judge' ? '填写答案' : '如 B 或 A、C'}
                      onChange={(e) => updateAnswer(index, e.target.value)}
                    />
                    {p.explanation && <span style={{ color: 'var(--muted)' }}>已有解析</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function FormatHelp() {
  return (
    <details className="format-help">
      <summary>
        <Icon name="info" size={14} />
        识别规则 / 支持哪些格式
      </summary>
      <pre>{`1. 题干可以写多行，支持代码块
A. 选项一
B. 选项二
C. 选项三
D. 选项四
答案：B
解析：这里写解析（可选）
标签：指针, 数组（可选）`}</pre>
      <ul>
        <li>题号支持 <code>1.</code> <code>1、</code> <code>(1)</code> <code>第1题</code>，没有题号时会按空行自动分段。</li>
        <li>选项支持 <code>A.</code> <code>A、</code> <code>A)</code>，一行写了多个选项也能拆开。</li>
        <li>答案行支持 <code>答案：A</code>、<code>正确答案：A、C</code>；判断题写 <code>对</code> / <code>错</code>。</li>
        <li>没有选项且答案不是对/错时，会当作填空题；填空答案可用 <code>|</code> 分隔多个可接受写法。</li>
      </ul>
    </details>
  );
}
