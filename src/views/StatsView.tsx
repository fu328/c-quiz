import { useMemo } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { percent, plainStem, todayKey } from '../lib/utils';
import type { Route } from '../routes';

export function StatsView({ navigate }: { navigate: (route: Route) => void }) {
  const { questions, records, stats, startCustom, startSession } = useApp();

  const summary = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    let practiced = 0;
    let mastered = 0;
    let wrong = 0;
    questions.forEach((q) => {
      const r = records[q.id];
      if (!r?.attempts) return;
      practiced += 1;
      attempts += r.attempts;
      correct += r.correct;
      if (r.wrongBook) wrong += 1;
      else mastered += 1;
    });
    return { attempts, correct, practiced, mastered, wrong, total: questions.length };
  }, [questions, records]);

  const tagStats = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    questions.forEach((q) => {
      const r = records[q.id];
      q.tags.forEach((tag) => {
        const entry = map.get(tag) ?? { total: 0, correct: 0 };
        entry.total += r?.attempts ?? 0;
        entry.correct += r?.correct ?? 0;
        map.set(tag, entry);
      });
    });
    return [...map.entries()]
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);
  }, [questions, records]);

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { key: todayKey(d), label: `${d.getMonth() + 1}/${d.getDate()}` };
    });
    const max = Math.max(1, ...days.map((d) => stats.find((s) => s.date === d.key)?.total ?? 0));
    return days.map((d) => {
      const entry = stats.find((s) => s.date === d.key);
      return { ...d, total: entry?.total ?? 0, correct: entry?.correct ?? 0, max };
    });
  }, [stats]);

  const hardest = useMemo(
    () =>
      questions
        .map((q) => ({ q, r: records[q.id] }))
        .filter((x) => (x.r?.wrong ?? 0) > 0)
        .sort((a, b) => (b.r?.wrong ?? 0) - (a.r?.wrong ?? 0))
        .slice(0, 5),
    [questions, records],
  );

  const today = stats.find((s) => s.date === todayKey());
  const accuracy = percent(summary.correct, summary.attempts);
  const todayAccuracy = today ? percent(today.correct, today.total) : '—';

  if (!questions.length) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">学习统计</h1>
            <div className="page-sub">练习数据会保存在本机</div>
          </div>
        </div>
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="chart" size={26} />
            </div>
            <h3>还没有可统计的数据</h3>
            <p>录入题目并开始刷题后，这里会显示正确率、薄弱标签和每日练习量。</p>
            <button className="btn btn-primary" onClick={() => navigate('import')}>
              <Icon name="upload" size={15} />
              录入题目
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">学习统计</h1>
          <div className="page-sub">
            今日 {today?.total ?? 0} 题 · 今日正确率 {todayAccuracy} · 累计作答 {summary.attempts} 次
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => navigate('practice')}>
            <Icon name="play" size={15} />
            去刷题
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="icon-box">
            <Icon name="book" size={16} />
          </div>
          <strong>{summary.total}</strong>
          <span>题库总数</span>
        </div>
        <div className="stat-card ok">
          <div className="icon-box">
            <Icon name="target" size={16} />
          </div>
          <strong>{summary.practiced}</strong>
          <span>已练习题目</span>
        </div>
        <div className="stat-card warn">
          <div className="icon-box">
            <Icon name="chart" size={16} />
          </div>
          <strong>{accuracy}</strong>
          <span>总正确率（{summary.correct}/{summary.attempts}）</span>
        </div>
        <div className="stat-card bad">
          <div className="icon-box">
            <Icon name="bookmark" size={16} />
          </div>
          <strong>{summary.wrong}</strong>
          <span>错题本待复习</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>最近 7 天练习量</h3>
          <span>共 {week.reduce((sum, d) => sum + d.total, 0)} 题</span>
        </div>
        <div className="week">
          {week.map((day) => (
            <div className="week-col" key={day.key}>
              <div
                className={`week-bar ${day.total === 0 ? 'zero' : ''}`}
                style={{ height: `${Math.max(3, (day.total / day.max) * 100)}%` }}
                title={`${day.label}：${day.total} 题`}
              >
                {day.total > 0 && <span className="tip">{day.total}</span>}
              </div>
              <span className="week-day">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>标签掌握情况</h3>
          <span>{tagStats.length ? '按正确率排序' : '暂无数据'}</span>
        </div>
        {tagStats.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>还没有作答记录，刷几题后再来看。</p>
        ) : (
          tagStats
            .sort((a, b) => a[1].correct / Math.max(1, a[1].total) - b[1].correct / Math.max(1, b[1].total))
            .map(([tag, v]) => {
              const rate = v.correct / Math.max(1, v.total);
              return (
                <div className="acc-row" key={tag}>
                  <span className="acc-name" title={tag}>
                    {tag}
                  </span>
                  <div className="acc-track">
                    <div
                      className={`acc-fill ${rate < 0.4 ? 'bad' : rate < 0.7 ? 'low' : ''}`}
                      style={{ width: `${Math.round(rate * 100)}%` }}
                    />
                  </div>
                  <span className="acc-value">
                    {v.correct}/{v.total} · {Math.round(rate * 100)}%
                  </span>
                </div>
              );
            })
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>最需要复习</h3>
          <span>{hardest.length} 题</span>
        </div>
        {hardest.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>暂时没有错题，保持住。</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hardest.map(({ q, r }) => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span className="badge bad">错 {r?.wrong ?? 0}</span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: 'var(--text-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {plainStem(q.stem, 80)}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      startCustom([q.id]);
                      navigate('practice');
                    }}
                  >
                    重做
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn-soft btn-sm"
                onClick={() => {
                  startSession('wrong');
                  navigate('practice');
                }}
              >
                <Icon name="refresh" size={14} />
                重练全部错题
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
