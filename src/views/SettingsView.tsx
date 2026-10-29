import { useRef, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { DEFAULT_SETTINGS, type BackupPayload, type ThemeMode } from '../types';
import { downloadFile, todayKey } from '../lib/utils';
import type { Route } from '../routes';
import { sampleQuestions } from '../data/sample';

export function SettingsView({ navigate }: { navigate: (route: Route) => void }) {
  const { settings, patchSettings, questions, records, stats, restoreBackup, clearEverything, addQuestions, toast } =
    useApp();
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportBackup = () => {
    const payload: BackupPayload = {
      app: 'c-quiz',
      version: 1,
      exportedAt: Date.now(),
      questions,
      records: Object.values(records),
      stats,
      settings,
    };
    downloadFile(`c-quiz-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2));
    toast('备份文件已导出');
  };

  const onPickBackup = async (file: File) => {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as BackupPayload;
      if (parsed.app !== 'c-quiz' || !Array.isArray(parsed.questions)) {
        throw new Error('不是本程序的备份文件');
      }
      setPendingBackup(parsed);
    } catch (err) {
      toast(err instanceof Error ? err.message : '备份文件读取失败', 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">设置</h1>
          <div className="page-sub">所有数据仅保存在本机浏览器中，不会上传到网络</div>
        </div>
      </div>

      <div className="settings-group">
        <h3>外观</h3>
        <div className="setting-row" style={{ alignItems: 'flex-start' }}>
          <div className="setting-info">
            <strong>主题</strong>
            <span>深色模式下长时间刷题更省眼</span>
          </div>
          <div className="theme-cards" style={{ width: 260 }}>
            {(
              [
                { key: 'light', icon: 'sun', label: '浅色' },
                { key: 'dark', icon: 'moon', label: '深色' },
                { key: 'system', icon: 'monitor', label: '跟随系统' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                className={`theme-card ${settings.theme === item.key ? 'active' : ''}`}
                onClick={() => void patchSettings({ theme: item.key as ThemeMode })}
              >
                <Icon name={item.icon} size={17} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>练习</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>点击选项立即判题</strong>
            <span>单选题和判断题点一下就出结果，刷题更连续</span>
          </div>
          <button
            className={`switch ${settings.instantJudge ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.instantJudge}
            onClick={() => void patchSettings({ instantJudge: !settings.instantJudge })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>答对自动下一题</strong>
            <span>答对后约 0.85 秒自动跳转，答错会停留看解析</span>
          </div>
          <button
            className={`switch ${settings.autoNext ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.autoNext}
            onClick={() => void patchSettings({ autoNext: !settings.autoNext })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>代码补全</strong>
            <span>写代码时提示 C 关键字、标准库函数和常用片段，Ctrl+空格 / Alt+/ 手动触发</span>
          </div>
          <button
            className={`switch ${settings.codeCompletion ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.codeCompletion}
            onClick={() => void patchSettings({ codeCompletion: !settings.codeCompletion })}
          />
        </div>
      </div>

      <div className="settings-group">
        <h3>图片识别</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>识别语言</strong>
            <span>中文题目选「中英混合」；纯英文题可以选「仅英文」，速度更快</span>
          </div>
          <select
            className="select"
            style={{ width: 150 }}
            value={settings.ocrLang}
            onChange={(e) => void patchSettings({ ocrLang: e.target.value as 'chi_sim+eng' | 'eng' })}
          >
            <option value="chi_sim+eng">中英混合</option>
            <option value="eng">仅英文</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>离线识别</strong>
            <span>识别引擎与语言包已内置在本程序中，断网也能用，首次识别需要几秒加载</span>
          </div>
          <span className="badge ok">
            <Icon name="check" size={11} />
            已内置
          </span>
        </div>
      </div>

      <div className="settings-group">
        <h3>数据管理</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>导出备份</strong>
            <span>把题库、错题本和统计导出为 JSON 文件，换电脑时可以用</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportBackup} disabled={!questions.length}>
            <Icon name="download" size={14} />
            导出
          </button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>导入备份</strong>
            <span>导入会覆盖当前所有题目和记录，请先导出备份</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={14} />
            选择文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickBackup(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>载入示例题库</strong>
            <span>添加 14 道 C 语言示例题（含程序阅读、编程题），方便快速体验（重复的会自动跳过）</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              const { added, skipped } = await addQuestions(sampleQuestions());
              toast(`已添加 ${added} 题${skipped ? `，跳过 ${skipped} 题重复` : ''}`);
            }}
          >
            <Icon name="sparkles" size={14} />
            载入
          </button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>恢复默认设置</strong>
            <span>只重置偏好设置，不影响题目和答题记录</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmResetSettings(true)}>
            恢复
          </button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong style={{ color: 'var(--bad)' }}>清空全部数据</strong>
            <span>删除所有题目、答题记录和统计，无法恢复</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>
            <Icon name="trash" size={14} />
            清空
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3>快捷键</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>刷题时可用</strong>
            <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
              <span>
                <kbd>A</kbd>-<kbd>D</kbd> / <kbd>1</kbd>-<kbd>4</kbd> 选项
              </span>
              <span>
                <kbd>Enter</kbd> 提交 / 下一题
              </span>
              <span>
                <kbd>←</kbd> <kbd>→</kbd> 切题
              </span>
            </span>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>录入题目时</strong>
            <span>
              图片页可直接 <kbd>Ctrl</kbd> + <kbd>V</kbd> 粘贴截图
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', padding: '8px 0 0' }}>
        C 语言刷题助手 · v1.1 · 数据存储于浏览器 IndexedDB
      </div>

      <ConfirmDialog
        open={Boolean(pendingBackup)}
        title="导入备份并覆盖当前数据？"
        description={
          pendingBackup
            ? `备份中包含 ${pendingBackup.questions.length} 道题、${pendingBackup.records?.length ?? 0} 条答题记录，导入后会替换当前全部数据。`
            : ''
        }
        confirmText="覆盖导入"
        danger
        onCancel={() => setPendingBackup(null)}
        onConfirm={() => {
          if (!pendingBackup) return;
          void restoreBackup(pendingBackup)
            .then(() => {
              setPendingBackup(null);
              toast('备份已导入');
              navigate('bank');
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : '导入失败', 'error'));
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="确定清空全部数据？"
        description="所有题目、错题记录和学习统计都会被删除，且无法恢复。建议先导出备份。"
        confirmText="确认清空"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearEverything().then(() => {
            setConfirmClear(false);
            toast('数据已清空');
            navigate('practice');
          });
        }}
      />

      <ConfirmDialog
        open={confirmResetSettings}
        title="恢复默认设置？"
        description="主题、判题方式等偏好会恢复默认，题目和记录不受影响。"
        confirmText="恢复默认"
        onCancel={() => setConfirmResetSettings(false)}
        onConfirm={() => {
          void patchSettings(DEFAULT_SETTINGS).then(() => {
            setConfirmResetSettings(false);
            toast('已恢复默认设置');
          });
        }}
      />
    </>
  );
}
