import { Icon, type IconName } from './Icon';
import { useApp } from '../store';
import type { Route } from '../routes';

interface NavItem {
  route: Route;
  label: string;
  icon: IconName;
  count?: number;
  alert?: boolean;
}

export function Sidebar({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const { questions, records, settings, patchSettings } = useApp();
  const wrongCount = Object.values(records).filter((r) => r.wrongBook).length;
  const unseen = questions.filter((q) => !records[q.id]?.attempts).length;

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: '学习',
      items: [
        { route: 'practice', label: '刷题', icon: 'play', count: unseen || undefined },
        { route: 'wrong', label: '错题本', icon: 'bookmark', count: wrongCount || undefined, alert: wrongCount > 0 },
      ],
    },
    {
      label: '题库',
      items: [
        { route: 'bank', label: '题目管理', icon: 'book', count: questions.length || undefined },
        { route: 'import', label: '录入题目', icon: 'upload' },
      ],
    },
    {
      label: '其他',
      items: [
        { route: 'stats', label: '学习统计', icon: 'chart' },
        { route: 'settings', label: '设置', icon: 'settings' },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div className="brand-text">
          <strong>C 刷题</strong>
          <span>错题驱动 · 本地存储</span>
        </div>
      </div>

      <nav className="nav">
        {groups.map((group) => (
          <div key={group.label} style={{ display: 'contents' }}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.route}
                className={`nav-item ${route === item.route ? 'active' : ''}`}
                onClick={() => navigate(item.route)}
                title={item.label}
              >
                <Icon name={item.icon} size={17} />
                <span className="nav-text">{item.label}</span>
                {item.count !== undefined && (
                  <span className={`nav-count ${item.alert ? 'alert' : ''}`}>{item.count > 999 ? '999+' : item.count}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="theme-switch" role="group" aria-label="主题">
          {(
            [
              { key: 'light', icon: 'sun', label: '浅色' },
              { key: 'dark', icon: 'moon', label: '深色' },
              { key: 'system', icon: 'monitor', label: '跟随系统' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              className={settings.theme === item.key ? 'active' : ''}
              onClick={() => void patchSettings({ theme: item.key })}
              title={item.label}
              aria-label={item.label}
            >
              <Icon name={item.icon} size={15} />
            </button>
          ))}
        </div>
        <div className="storage-note">
          <Icon name="layers" size={12} />
          数据只保存在本机浏览器
        </div>
      </div>
    </aside>
  );
}
