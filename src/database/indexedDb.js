import { createUuid, isUuid } from '../utils/uuid';

export const DB_NAME = 'control-bodega-db';
export const DB_VERSION = 2;
export const STORES = ['dispositivos', 'gestiones', 'modelos', 'estados', 'fallas'];
export const META_STORE = 'meta';
const INITIAL = { modelos: ['Sunmi', 'Kozen'], estados: ['Bueno', 'Malo'], fallas: ['No enciende', 'Mala impresora', 'Otros'] };
const VALID_SYNC_STATUS = new Set(['synced', 'pending', 'error']);

function now() { return new Date().toISOString(); }
function request(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }

function normalizeLegacyRecord(store, record, gestionIds) {
  const id = isUuid(record.id) ? record.id : createUuid();
  const createdAt = record.created_at || record.fechaRegistro || record.fechaCreacion || now();
  const normalized = { ...record, id, created_at: createdAt, updated_at: record.updated_at || createdAt, deleted_at: record.deleted_at || null, sync_status: VALID_SYNC_STATUS.has(record.sync_status) ? record.sync_status : 'pending' };
  if (store === 'gestiones') gestionIds.set(String(record.id), id);
  return normalized;
}

function migrateExistingData(db, transaction) {
  const gestionIds = new Map();
  const gestiones = transaction.objectStore('gestiones').getAll();
  gestiones.onsuccess = () => {
    gestiones.result.forEach(original => { const item = normalizeLegacyRecord('gestiones', original, gestionIds); transaction.objectStore('gestiones').put(item); if (item.id !== original.id) transaction.objectStore('gestiones').delete(original.id); });
    const dispositivos = transaction.objectStore('dispositivos').getAll();
    dispositivos.onsuccess = () => {
      dispositivos.result.forEach(original => { const item = { ...normalizeLegacyRecord('dispositivos', original, gestionIds), gestionId: gestionIds.get(String(original.gestionId)) || original.gestionId }; transaction.objectStore('dispositivos').put(item); if (item.id !== original.id) transaction.objectStore('dispositivos').delete(original.id); });
    };
  };
  ['modelos', 'estados', 'fallas'].forEach(store => {
    const req = transaction.objectStore(store).getAll();
    req.onsuccess = () => req.result.forEach(original => { const item = normalizeLegacyRecord(store, original, gestionIds); transaction.objectStore(store).put(item); if (item.id !== original.id) transaction.objectStore(store).delete(original.id); });
  });
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = event => {
      const db = req.result;
      STORES.forEach(store => { if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id', autoIncrement: true }); });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      if (event.oldVersion < 2) migrateExistingData(db, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store, { includeDeleted = false } = {}) {
  const db = await openDb();
  const records = await request(db.transaction(store, 'readonly').objectStore(store).getAll());
  return includeDeleted ? records : records.filter(record => !record.deleted_at);
}

export async function getAllIncludingDeleted(store) { return getAll(store, { includeDeleted: true }); }
export async function getMeta(key) { const db = await openDb(); return request(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(key)); }
export async function setMeta(key, value) { const db = await openDb(); return request(db.transaction(META_STORE, 'readwrite').objectStore(META_STORE).put({ key, value })); }

export async function seedInitialData() {
  for (const [store, values] of Object.entries(INITIAL)) {
    const existing = await getAll(store);
    for (const nombre of values) if (!existing.some(item => item.nombre.trim().toLocaleLowerCase() === nombre.toLocaleLowerCase())) await saveRecord(store, { nombre });
  }
}

export async function saveRecord(store, record, { syncStatus = 'pending' } = {}) {
  const timestamp = now();
  const value = { ...record, id: record.id || createUuid(), created_at: record.created_at || timestamp, updated_at: timestamp, deleted_at: record.deleted_at || null, sync_status: syncStatus };
  const db = await openDb();
  return request(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function saveRemoteRecord(store, record) {
  const value = { ...record, id: record.id || createUuid(), deleted_at: record.deleted_at || null, sync_status: 'synced' };
  const db = await openDb();
  return request(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function softDeleteRecord(store, id) {
  const db = await openDb();
  const objectStore = db.transaction(store, 'readwrite').objectStore(store);
  const record = await request(objectStore.get(id));
  if (!record) return null;
  record.deleted_at = now(); record.updated_at = record.deleted_at; record.sync_status = 'pending';
  return request(objectStore.put(record));
}

export async function replaceAllLocal(data) {
  const db = await openDb();
  const tx = db.transaction([...STORES, META_STORE], 'readwrite');
  STORES.forEach(store => { const objectStore = tx.objectStore(store); objectStore.clear(); (data[store] || []).forEach(item => objectStore.put({ ...item, id: item.id || createUuid(), sync_status: 'pending', deleted_at: item.deleted_at || null, created_at: item.created_at || now(), updated_at: now() })); });
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}

export async function countPending() {
  let total = 0;
  for (const store of STORES) total += (await getAllIncludingDeleted(store)).filter(item => item.sync_status === 'pending' || item.sync_status === 'error').length;
  return total;
}

export async function markSyncError(store, id) {
  const db = await openDb(); const objectStore = db.transaction(store, 'readwrite').objectStore(store); const record = await request(objectStore.get(id));
  if (record) { record.sync_status = 'error'; await request(objectStore.put(record)); }
}
