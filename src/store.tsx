import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AnswerRecord,
  BackupPayload,
  DayStat,
  PracticeMode,
  PracticeSession,
  Question,
  Settings,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  clearStores,
  deleteMany,
  deleteOne,
  putMany,
  putOne,
  setMeta,
  loadAll,
} from './db';
import { buildQueue, normalAnswerKey, buildRecord } from './lib/storeHelpers';
import { todayKey, uid } from './lib/utils';

interface AppState {
  ready: boolean;
  error: string | null;
  questions: Question[];
  records: Record<string, AnswerRecord>;
  settings: Settings;
  stats: DayStat[];
  session: PracticeSession | null;
}

interface AppContextValue extends AppState {
  questionMap: Map<string, Question>;
  recordOf: (id: string) => AnswerRecord;
  addQuestions: (items: Question[]) => Promise<{ added: number; skipped: number }>;
  saveQuestion: (question: Question) => Promise<void>;
  removeQuestion: (id: string) => Promise<void>;
  removeQuestions: (ids: string[]) => Promise<void>;
  submitAnswer: (questionId: string, answer: string[], correct: boolean) => Promise<void>;
  toggleWrongBook: (questionId: string, force?: boolean) => Promise<void>;
  markMastered: (questionId: string) => Promise<void>;
  toggleStar: (questionId: string) => Promise<void>;
  setSession: (session: PracticeSession | null) => void;
  startSession: (mode: PracticeMode, tag?: string) => PracticeSession;
  startCustom: (ids: string[]) => void;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  restoreBackup: (payload: BackupPayload) => Promise<void>;
  clearEverything: () => Promise<void>;
  toast: (message: string, kind?: 'ok' | 'error' | 'info') => void;
  toasts: Array<{ id: string; message: string; kind: 'ok' | 'error' | 'info' }>;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const emptyState: AppState = {
  ready: false,
  error: null,
  questions: [],
  records: {},
  settings: DEFAULT_SETTINGS,
  stats: [],
  session: null,
};

function sortQuestions(items: Question[]): Question[] {
  return [...items].sort((a, b) => a.createdAt - b.createdAt);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const stateRef = useRef(state);
  const [toasts, setToasts] = useState<AppContextValue['toasts']>([]);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const toast = useCallback((message: string, kind: 'ok' | 'error' | 'info' = 'ok') => {
    const id = uid('toast');
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((loaded) => {
        if (cancelled) return;
        const records: Record<string, AnswerRecord> = {};
        loaded.records.forEach((r) => {
          records[r.questionId] = { ...buildRecord(r.questionId), ...r };
        });
        const settings: Settings = { ...DEFAULT_SETTINGS, ...(loaded.settings as Partial<Settings>) };
        document.documentElement.dataset.theme =
          settings.theme === 'dark'
            ? 'dark'
            : settings.theme === 'light'
              ? 'light'
              : window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
        commit({
          ready: true,
          error: null,
          questions: sortQuestions(loaded.questions),
          records,
          settings,
          stats: loaded.stats ?? [],
          session: loaded.session ?? null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        commit({ ...emptyState, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [commit]);

  const recordOf = useCallback(
    (id: string) => stateRef.current.records[id] ?? buildRecord(id),
    [],
  );

  const addQuestions = useCallback(
    async (items: Question[]) => {
      const current = stateRef.current.questions;
      const existing = new Set(current.map((q) => normalAnswerKey(q.stem)));
      const fresh: Question[] = [];
      let skipped = 0;
      const base = Date.now();
      items.forEach((item, index) => {
        const key = normalAnswerKey(item.stem);
        if (existing.has(key)) {
          skipped += 1;
          return;
        }
        existing.add(key);
        fresh.push({ ...item, createdAt: base + index, updatedAt: base + index });
      });
      if (fresh.length) {
        await putMany('questions', fresh);
        commit({ ...stateRef.current, questions: sortQuestions([...current, ...fresh]) });
      }
      return { added: fresh.length, skipped };
    },
    [commit],
  );

  const saveQuestion = useCallback(
    async (question: Question) => {
      const current = stateRef.current.questions;
      const exists = current.some((q) => q.id === question.id);
      const next = exists
        ? current.map((q) => (q.id === question.id ? { ...question, updatedAt: Date.now() } : q))
        : [...current, { ...question, createdAt: question.createdAt || Date.now(), updatedAt: Date.now() }];
      await putOne('questions', question);
      commit({ ...stateRef.current, questions: sortQuestions(next) });
    },
    [commit],
  );

  const removeQuestion = useCallback(
    async (id: string) => {
      await Promise.all([deleteOne('questions', id), deleteOne('records', id)]);
      const records = { ...stateRef.current.records };
      delete records[id];
      const session = stateRef.current.session;
      const nextSession = session
        ? {
            ...session,
            ids: session.ids.filter((x) => x !== id),
            index: Math.max(0, Math.min(session.index, session.ids.length - 2)),
          }
        : null;
      if (nextSession) await setMeta('session', nextSession);
      commit({
        ...stateRef.current,
        questions: stateRef.current.questions.filter((q) => q.id !== id),
        records,
        session: nextSession,
      });
    },
    [commit],
  );

  const removeQuestions = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      await Promise.all([deleteMany('questions', ids), deleteMany('records', ids)]);
      const removeSet = new Set(ids);
      const records = { ...stateRef.current.records };
      ids.forEach((id) => delete records[id]);
      const session = stateRef.current.session;
      const nextSession = session
        ? {
            ...session,
            ids: session.ids.filter((x) => !removeSet.has(x)),
            index: Math.max(0, Math.min(session.index, session.ids.length - ids.length - 1)),
          }
        : null;
      if (nextSession) await setMeta('session', nextSession);
      commit({
        ...stateRef.current,
        questions: stateRef.current.questions.filter((q) => !removeSet.has(q.id)),
        records,
        session: nextSession,
      });
    },
    [commit],
  );

  const submitAnswer = useCallback(
    async (questionId: string, answer: string[], correct: boolean) => {
      const current = stateRef.current;
      const prev = current.records[questionId] ?? buildRecord(questionId);
      const record: AnswerRecord = {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        wrong: prev.wrong + (correct ? 0 : 1),
        lastAnswer: answer,
        lastAt: Date.now(),
        wrongBook: correct ? prev.wrongBook && prev.manualWrong : true,
        manualWrong: correct ? prev.manualWrong : false,
      };
      const today = todayKey();
      const stats = [...current.stats];
      const idx = stats.findIndex((s) => s.date === today);
      if (idx >= 0) {
        stats[idx] = {
          ...stats[idx],
          total: stats[idx].total + 1,
          correct: stats[idx].correct + (correct ? 1 : 0),
        };
      } else {
        stats.push({ date: today, total: 1, correct: correct ? 1 : 0 });
      }
      const session = current.session;
      const nextSession = session
        ? {
            ...session,
            answers: { ...session.answers, [questionId]: answer },
            results: { ...(session.results ?? {}), [questionId]: correct },
          }
        : null;
      await Promise.all([putOne('records', record), setMeta('stats', stats), setMeta('session', nextSession)]);
      commit({
        ...current,
        records: { ...current.records, [questionId]: record },
        stats,
        session: nextSession,
      });
    },
    [commit],
  );

  const toggleWrongBook = useCallback(
    async (questionId: string, force?: boolean) => {
      const prev = stateRef.current.records[questionId] ?? buildRecord(questionId);
      const next: AnswerRecord = {
        ...prev,
        wrongBook: force ?? !prev.wrongBook,
        manualWrong: force ?? !prev.wrongBook,
      };
      await putOne('records', next);
      commit({ ...stateRef.current, records: { ...stateRef.current.records, [questionId]: next } });
    },
    [commit],
  );

  const markMastered = useCallback(
    async (questionId: string) => {
      const prev = stateRef.current.records[questionId] ?? buildRecord(questionId);
      const next: AnswerRecord = { ...prev, wrongBook: false, manualWrong: false };
      await putOne('records', next);
      commit({ ...stateRef.current, records: { ...stateRef.current.records, [questionId]: next } });
    },
    [commit],
  );

  const toggleStar = useCallback(
    async (questionId: string) => {
      const prev = stateRef.current.records[questionId] ?? buildRecord(questionId);
      const next: AnswerRecord = { ...prev, starred: !prev.starred };
      await putOne('records', next);
      commit({ ...stateRef.current, records: { ...stateRef.current.records, [questionId]: next } });
    },
    [commit],
  );

  const setSession = useCallback(
    (session: PracticeSession | null) => {
      void setMeta('session', session);
      commit({ ...stateRef.current, session });
    },
    [commit],
  );

  const startSession = useCallback(
    (mode: PracticeMode, tag?: string) => {
      const current = stateRef.current;
      const pool = buildQueue(current.questions, current.records, mode, tag);
      const session: PracticeSession = {
        mode,
        tag,
        ids: pool.map((q) => q.id),
        index: 0,
        answers: {},
        results: {},
        startedAt: Date.now(),
      };
      void setMeta('session', session);
      commit({ ...current, session });
      return session;
    },
    [commit],
  );

  const startCustom = useCallback(
    (ids: string[]) => {
      const session: PracticeSession = {
        mode: 'sequence',
        ids,
        index: 0,
        answers: {},
        results: {},
        startedAt: Date.now(),
      };
      void setMeta('session', session);
      commit({ ...stateRef.current, session });
    },
    [commit],
  );

  const patchSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const settings = { ...stateRef.current.settings, ...patch };
      await setMeta('settings', settings);
      if (patch.theme) {
        document.documentElement.dataset.theme =
          settings.theme === 'dark'
            ? 'dark'
            : settings.theme === 'light'
              ? 'light'
              : window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
        localStorage.setItem('cquiz.theme', JSON.stringify(settings.theme));
      }
      commit({ ...stateRef.current, settings });
    },
    [commit],
  );

  const restoreBackup = useCallback(
    async (payload: BackupPayload) => {
      if (!payload || !Array.isArray(payload.questions)) throw new Error('备份文件格式不正确');
      await clearStores();
      const records: Record<string, AnswerRecord> = {};
      payload.records?.forEach((r) => {
        records[r.questionId] = r;
      });
      const settings = { ...DEFAULT_SETTINGS, ...(payload.settings ?? {}) };
      const stats = payload.stats ?? [];
      await Promise.all([
        putMany('questions', payload.questions),
        putMany('records', payload.records ?? []),
        setMeta('settings', settings),
        setMeta('stats', stats),
        setMeta('session', null),
      ]);
      commit({
        ready: true,
        error: null,
        questions: sortQuestions(payload.questions),
        records,
        settings,
        stats,
        session: null,
      });
    },
    [commit],
  );

  const clearEverything = useCallback(async () => {
    await clearStores();
    commit({
      ...emptyState,
      ready: true,
      settings: stateRef.current.settings,
    });
  }, [commit]);

  const questionMap = useMemo(() => new Map(state.questions.map((q) => [q.id, q])), [state.questions]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      questionMap,
      recordOf,
      addQuestions,
      saveQuestion,
      removeQuestion,
      removeQuestions,
      submitAnswer,
      toggleWrongBook,
      markMastered,
      toggleStar,
      setSession,
      startSession,
      startCustom,
      patchSettings,
      restoreBackup,
      clearEverything,
      toast,
      toasts,
      dismissToast,
    }),
    [
      state,
      questionMap,
      recordOf,
      addQuestions,
      saveQuestion,
      removeQuestion,
      removeQuestions,
      submitAnswer,
      toggleWrongBook,
      markMastered,
      toggleStar,
      setSession,
      startSession,
      startCustom,
      patchSettings,
      restoreBackup,
      clearEverything,
      toast,
      toasts,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用');
  return ctx;
}
