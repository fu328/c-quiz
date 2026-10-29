import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './store';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Modal';
import { Icon } from './components/Icon';
import { parseHash, type Route } from './routes';
import { PracticeView } from './views/PracticeView';
import { BankView } from './views/BankView';
import { WrongView } from './views/WrongView';
import { ImportView } from './views/ImportView';
import { StatsView } from './views/StatsView';
import { SettingsView } from './views/SettingsView';

function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash());
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/practice';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = (next: Route) => {
    if (window.location.hash === `#/${next}`) setRoute(next);
    else window.location.hash = `#/${next}`;
  };
  return [route, navigate];
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark">C</div>
      <div className="splash-text">
        <strong>C 刷题</strong>
        <span>正在加载本地题库…</span>
      </div>
    </div>
  );
}

function FatalError({ message }: { message: string }) {
  return (
    <div className="fatal">
      <div className="fatal-box">
        <div className="fatal-icon">
          <Icon name="alert" size={26} />
        </div>
        <h2>无法访问本地数据库</h2>
        <p>{message}</p>
        <p className="fatal-hint">
          请使用 Chrome / Edge 打开，并确认没有禁用 Cookie 与站点数据。若通过 <code>file://</code> 直接打开页面，请改用随附的启动脚本。
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { ready, error } = useApp();
  const [route, navigate] = useRoute();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  if (error) return <FatalError message={error} />;
  if (!ready) return <Splash />;

  return (
    <div className="app">
      <Sidebar route={route} navigate={navigate} />
      <main className="main">
        {route === 'practice' && <PracticeView navigate={navigate} />}
        {route === 'bank' && <BankView navigate={navigate} />}
        {route === 'wrong' && <WrongView navigate={navigate} />}
        {route === 'import' && <ImportView navigate={navigate} />}
        {route === 'stats' && <StatsView navigate={navigate} />}
        {route === 'settings' && <SettingsView navigate={navigate} />}
      </main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
