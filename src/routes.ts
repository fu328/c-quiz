export type Route = 'practice' | 'bank' | 'wrong' | 'import' | 'stats' | 'settings';

export const ROUTES: Route[] = ['practice', 'bank', 'wrong', 'import', 'stats', 'settings'];

export function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (ROUTES as string[]).includes(raw) ? (raw as Route) : 'practice';
}

export function hashFor(route: Route): string {
  return `#/${route}`;
}
