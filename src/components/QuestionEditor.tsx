import { useEffect, useState } from 'react';
import { Modal, ConfirmDialog } from './Modal';
import { Icon } from './Icon';
import { CodeEditor } from './CodeEditor';
import { useApp } from '../store';
import { generateOptions } from '../lib/question';
import { answerFromInput } from '../lib/parse';
import { QUESTION_TEMPLATES, type QuestionTemplate } from '../lib/templates';
import { QTYPE_LABEL, type Option, type QType, type Question } from '../types';
import { uid } from '../lib/utils';

interface Props {
  open: boolean;
  initial: Question | null;
  onClose: () => void;
  onDeleted?: () => void;
}

const TYPES: QType[] = ['single', 'multiple', 'judge', 'fill', 'coding'];

const isCodeType = (type: QType) => type === 'coding';

export function QuestionEditor({ open, initial, onClose, onDeleted }: Props) {
  const { saveQuestion, removeQuestion, toast, settings } = useApp();
  const [type, setType] = useState<QType>('single');
  const [stem, setStem] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [answerKeys, setAnswerKeys] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [tags, setTags] = useState('');
  const [code, setCode] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = initial;
    const nextType = q?.type ?? 'single';
    setType(nextType);
    setStem(q?.stem ?? '');
    setExplanation(q?.explanation ?? '');
    setTags((q?.tags ?? []).join(', '));
    setCode(q?.code ?? '');
    setReferenceCode(q?.referenceCode ?? '');
    setShowCode(Boolean(q?.code || q?.referenceCode) || isCodeType(nextType));
    setAnswerText(q && nextType === 'fill' ? q.answer.join('|') : '');
    if (nextType === 'single' || nextType === 'multiple') {
      setOptions(q?.options.length ? q.options : generateOptions(4));
      setAnswerKeys(q?.answer ?? []);
    } else if (nextType === 'judge') {
      setOptions([]);
      setAnswerKeys(q && nextType === 'judge' ? q.answer.slice(0, 1) : ['对']);
    } else if (nextType === 'fill') {
      setOptions([]);
      setAnswerKeys([]);
    } else {
      setOptions([]);
      setAnswerKeys([]);
    }
    setError('');
    setConfirmDelete(false);
  }, [open, initial]);

  const changeType = (next: QType) => {
    setError('');
    setType(next);
    if (next === 'single' || next === 'multiple') {
      setOptions((prev) => (prev.length >= 2 ? prev : generateOptions(4)));
      setAnswerKeys((prev) => {
        const keys = prev.filter((k) => /^[A-J]$/.test(k));
        return next === 'single' ? keys.slice(0, 1) : keys;
      });
    } else if (next === 'judge') {
      setOptions([]);
      setAnswerKeys((prev) => (prev[0] === '对' || prev[0] === '错' ? [prev[0]] : ['对']));
    } else {
      setOptions([]);
      setAnswerKeys([]);
    }
    if (isCodeType(next)) setShowCode(true);
  };

  const applyTemplate = (template: QuestionTemplate) => {
    const draft = template.build();
    setType(draft.type);
    setStem(draft.stem);
    setOptions(draft.options);
    setAnswerKeys(draft.type === 'fill' ? [] : draft.answer);
    setAnswerText(draft.type === 'fill' ? draft.answer.join('|') : '');
    setExplanation(draft.explanation);
    setTags(draft.tags.join(', '));
    setCode(draft.code);
    setReferenceCode(draft.referenceCode);
    setShowCode(Boolean(draft.code || draft.referenceCode) || isCodeType(draft.type));
    setError('');
    toast(`已套用「${template.name}」模板`, 'info');
  };

  const updateOption = (index: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  };

  const addOption = () => {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, { key: String.fromCharCode(65 + prev.length), text: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const oldKeys = options.map((o) => o.key);
    const nextKeys = oldKeys.filter((_, i) => i !== index);
    setOptions(options.filter((_, i) => i !== index).map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) })));
    setAnswerKeys((prev) =>
      prev
        .map((key) => {
          const pos = oldKeys.indexOf(key);
          if (pos < 0) return key;
          if (pos === index) return '';
          return nextKeys[pos > index ? pos - 1 : pos];
        })
        .filter(Boolean),
    );
  };

  const toggleAnswer = (key: string) => {
    if (type === 'single') {
      setAnswerKeys([key]);
      return;
    }
    setAnswerKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort()));
  };

  const save = async () => {
    const trimmed = stem.trim();
    if (!trimmed) {
      setError('题干不能为空');
      return;
    }
    const cleanOptions = options
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);
    let answer: string[] = [];
    if (type === 'coding') {
      if (!referenceCode.trim()) {
        setError('请填写参考答案代码（练习时用来对照自评）');
        return;
      }
    } else if (type === 'single' || type === 'multiple') {
      if (cleanOptions.length < 2) {
        setError('选择题至少需要 2 个有内容的选项');
        return;
      }
      answer = answerKeys.filter((k) => cleanOptions.some((o) => o.key === k));
      if (!answer.length) {
        setError('请选择正确答案');
        return;
      }
      if (type === 'single' && answer.length > 1) {
        setError('单选题只能有一个正确答案');
        return;
      }
    } else if (type === 'judge') {
      if (answerKeys[0] !== '对' && answerKeys[0] !== '错') {
        setError('请选择判断题答案');
        return;
      }
      answer = [answerKeys[0]];
    } else {
      answer = answerFromInput('fill', answerText);
      if (!answer.length) {
        setError('请填写填空答案');
        return;
      }
    }

    const now = Date.now();
    const question: Question = {
      id: initial?.id ?? uid('q'),
      type,
      stem: trimmed,
      options: type === 'single' || type === 'multiple' ? cleanOptions : [],
      answer,
      explanation: explanation.trim(),
      tags: Array.from(new Set(tags.split(/[,，、;；\s]+/).map((t) => t.trim()).filter(Boolean))),
      code: code.trim() ? code.replace(/\s+$/, '') : undefined,
      referenceCode: type === 'coding' ? referenceCode.replace(/\s+$/, '') : undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveQuestion(question);
      toast(initial ? '修改已保存' : '题目已添加');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="wide"
        title={initial ? '编辑题目' : '新增题目'}
        footer={
          <>
            {initial && (
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={14} />
                删除
              </button>
            )}
            <div className="spacer" />
            <button className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void save()}>
              <Icon name="check" size={15} />
              保存
            </button>
          </>
        }
      >
        {!initial && !stem.trim() && (
          <div className="tpl-strip">
            <div className="tpl-strip-head">
              <Icon name="sparkles" size={13} />
              从模板开始
              <span>· 套用后可直接修改，含程序阅读题与编程题</span>
            </div>
            <div className="tpl-chips">
              {QUESTION_TEMPLATES.map((template) => (
                <button key={template.id} className="tpl-chip" onClick={() => applyTemplate(template)}>
                  <strong>
                    <Icon name={template.icon} size={13} />
                    {template.name}
                  </strong>
                  <span>{template.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>题型</label>
          <div className="segmented" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            {TYPES.map((t) => (
              <button key={t} className={type === t ? 'active' : ''} onClick={() => changeType(t)}>
                {QTYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            {type === 'coding' ? '题目描述' : '题干'}
            {type !== 'coding' && <span className="hint">支持 ```c 代码块与 `行内代码`</span>}
            {type === 'coding' && <span className="hint">说明要实现的功能、输入输出要求</span>}
          </label>
          <textarea
            className="textarea"
            rows={4}
            value={stem}
            placeholder={type === 'coding' ? '描述要实现的功能…' : '输入题目内容…'}
            onChange={(e) => setStem(e.target.value)}
          />
        </div>

        {type === 'coding' ? (
          <>
            <div className="field">
              <label>
                起始代码 <span className="hint">练习时作为代码编辑器的初始内容，可留空</span>
              </label>
              <CodeEditor value={code} onChange={setCode} height={210} completion={settings.codeCompletion} placeholder="// 起始代码（可选）" />
            </div>
            <div className="field">
              <label>
                参考答案 <span className="hint">练习时点击查看，供对照自评</span>
              </label>
              <CodeEditor
                value={referenceCode}
                onChange={setReferenceCode}
                height={250}
                completion={settings.codeCompletion}
                placeholder="// 参考实现…"
              />
            </div>
          </>
        ) : (
          <>
            {showCode ? (
              <div className="field">
                <label>
                  题目代码 <span className="hint">会显示在题干下方，适合程序阅读 / 程序填空</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto', height: 26 }}
                    onClick={() => {
                      setShowCode(false);
                      setCode('');
                    }}
                  >
                    <Icon name="trash" size={12} />
                    移除代码
                  </button>
                </label>
                <CodeEditor value={code} onChange={setCode} height={240} completion={settings.codeCompletion} />
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowCode(true)}>
                <Icon name="code" size={14} />
                添加题目代码（程序阅读题）
              </button>
            )}
          </>
        )}

        {(type === 'single' || type === 'multiple') && (
          <div className="field">
            <label>
              选项 <span className="hint">至少 2 个</span>
            </label>
            <div className="opt-editor">
              {options.map((option, index) => (
                <div className="opt-editor-row" key={option.key}>
                  <span className="key">{option.key}</span>
                  <input
                    className="input"
                    value={option.text}
                    placeholder={`选项 ${option.key}`}
                    onChange={(e) => updateOption(index, e.target.value)}
                  />
                  <button
                    className="icon-btn danger"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 2}
                    title="删除选项"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={addOption}
                disabled={options.length >= 8}
              >
                <Icon name="plus" size={14} />
                添加选项
              </button>
            </div>
          </div>
        )}

        {type !== 'coding' && (
          <div className="field">
            <label>正确答案</label>
            {type === 'single' || type === 'multiple' ? (
              <div className="answer-grid">
                {options.map((option) => (
                  <button
                    key={option.key}
                    className={`answer-key ${answerKeys.includes(option.key) ? 'active' : ''}`}
                    onClick={() => toggleAnswer(option.key)}
                    title={option.text || `选项 ${option.key}`}
                  >
                    {option.key}
                  </button>
                ))}
              </div>
            ) : type === 'judge' ? (
              <div className="answer-grid">
                {['对', '错'].map((key) => (
                  <button
                    key={key}
                    className={`answer-key ${answerKeys[0] === key ? 'active' : ''}`}
                    style={{ width: 72 }}
                    onClick={() => setAnswerKeys([key])}
                  >
                    {key === '对' ? '正确' : '错误'}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="input"
                value={answerText}
                placeholder="多个可接受答案用 | 分隔，例如 malloc|calloc"
                onChange={(e) => setAnswerText(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="field">
          <label>解析（可选）</label>
          <textarea
            className="textarea"
            rows={3}
            value={explanation}
            placeholder="写一点解析，答错时可以看到"
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>

        <div className="field">
          <label>标签（可选）</label>
          <input
            className="input"
            value={tags}
            placeholder="用逗号分隔，例如：指针, 数组"
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        {error && (
          <div className="badge bad" style={{ alignSelf: 'flex-start', height: 'auto', padding: '7px 12px' }}>
            {error}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这道题？"
        description="题目及其答题记录会被永久删除，无法恢复。"
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!initial) return;
          void removeQuestion(initial.id).then(() => {
            toast('题目已删除');
            setConfirmDelete(false);
            onClose();
            onDeleted?.();
          });
        }}
      />
    </>
  );
}
