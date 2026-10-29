import type { AnswerRecord, DayStat, PracticeSession, Question, Settings } from './types';

const DB_NAME = 'c-quiz-db';
const DB_VERSION = 1;

export const STORE_QUESTIONS = 'questions';
export const STORE_RECORDS = 'records';
export const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB，请使用 Chrome / Edge 打开'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: 'questionId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('数据库打开失败'));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function getAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export async function putOne<T>(store: string, value: T): Promise<void> {
  await tx(store, 'readwrite', (s) => s.put(value as unknown as object) as IDBRequest<IDBValidKey>);
}

export async function putMany<T>(store: string, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    values.forEach((v) => objectStore.put(v as unknown as object));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteOne(store: string, key: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
}

export async function deleteMany(store: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    keys.forEach((k) => objectStore.delete(k));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearStores(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS, STORE_RECORDS, STORE_META], 'readwrite');
    transaction.objectStore(STORE_QUESTIONS).clear();
    transaction.objectStore(STORE_RECORDS).clear();
    transaction.objectStore(STORE_META).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/* ------------------------------ meta 键值 ------------------------------ */

interface MetaRow<T> {
  key: string;
  value: T;
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await tx<MetaRow<T> | undefined>(STORE_META, 'readonly', (s) => s.get(key) as IDBRequest<MetaRow<T> | undefined>);
  return row === undefined ? fallback : row.value;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await putOne<MetaRow<T>>(STORE_META, { key, value });
}

/* --------------------------- 带类型的数据加载 --------------------------- */

export interface PersistedState {
  questions: Question[];
  records: AnswerRecord[];
  settings: Settings;
  stats: DayStat[];
  session: PracticeSession | null;
}

export async function loadAll(): Promise<PersistedState> {
  const [questions, records, settings, stats, session] = await Promise.all([
    getAll<Question>(STORE_QUESTIONS),
    getAll<AnswerRecord>(STORE_RECORDS),
    getMeta<Settings | null>('settings', null),
    getMeta<DayStat[]>('stats', []),
    getMeta<PracticeSession | null>('session', null),
  ]);
  return {
    questions,
    records,
    settings: settings ?? ({} as Settings),
    stats,
    session,
  };
}
