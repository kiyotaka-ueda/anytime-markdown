// store/graphStorage.ts
import { GraphDocument, createDocument } from '../types';

const DB_NAME = 'anytime-graph';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const INDEX_KEY = 'anytime-graph-index';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocument(doc: GraphDocument): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...doc, updatedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDocument(id: string): Promise<GraphDocument | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listDocuments(): Promise<{ id: string; name: string; updatedAt: number }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const docs = (req.result as GraphDocument[]).map(d => ({
        id: d.id, name: d.name, updatedAt: d.updatedAt,
      }));
      docs.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(docs);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export function getLastDocumentId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(INDEX_KEY);
}

export function setLastDocumentId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INDEX_KEY, id);
}
