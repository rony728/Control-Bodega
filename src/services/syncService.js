import { deleteLocalRecord, getAllIncludingDeleted, getMeta, markSyncError, remapGestionId, saveRemoteRecord, setMeta } from '../database/indexedDb';
import { apiRequest, getSession } from './apiClient';
import { resolveLastWriteWins } from './syncConflict';

export const TABLES = ['gestiones', 'modelos', 'estados', 'fallas', 'dispositivos'];
let running = null;

export function toRemote(store, record) {
  const remote = { ...record };
  if (store === 'dispositivos') { remote.gestion_id = record.gestionId; remote.fecha_registro = record.fechaRegistro; remote.descripcion_falla = record.descripcionFalla; delete remote.gestionId; delete remote.fechaRegistro; delete remote.descripcionFalla; }
  if (store === 'gestiones') { remote.fecha_creacion = record.fechaCreacion; delete remote.fechaCreacion; }
  delete remote.sync_status; delete remote.server_updated_at;
  return remote;
}
export function fromRemote(store, record) {
  const local = { ...record };
  if (store === 'dispositivos') { local.gestionId = record.gestion_id; local.fechaRegistro = record.fecha_registro; local.descripcionFalla = record.descripcion_falla; delete local.gestion_id; delete local.fecha_registro; delete local.descripcion_falla; }
  if (store === 'gestiones') { local.fechaCreacion = record.fecha_creacion; delete local.fecha_creacion; }
  return local;
}
async function saveWinner(store, oldRecord, remoteRecord) {
  const winner = fromRemote(store, remoteRecord);
  if (oldRecord && oldRecord.id !== winner.id && store === 'gestiones') await remapGestionId(oldRecord.id, winner.id);
  await saveRemoteRecord(store, winner);
  if (oldRecord && oldRecord.id !== winner.id) await deleteLocalRecord(store, oldRecord.id);
  return winner;
}
export async function upsertOne(store, local) {
  const response = await apiRequest(`/api/${store}/sync`, { method: 'POST', body: JSON.stringify({ record: toRemote(store, local) }) });
  if (!response.record) throw new Error(`${store}: la API no devolvió el registro ganador.`);
  return { action: response.action, reconciled: response.reconciled, record: await saveWinner(store, local, response.record) };
}
async function pushPendingChanges() {
  if (!getSession()) return { skipped: true, pending: 0, errors: [] };
  const errors = []; let pending = 0;
  for (const store of TABLES) {
    const records = (await getAllIncludingDeleted(store)).filter(record => record.sync_status === 'pending' || record.sync_status === 'error'); pending += records.length;
    for (const record of records) try { await upsertOne(store, record); } catch (error) { await markSyncError(store, record.id); errors.push(`${store}/${record.id}: ${error.message}`); }
  }
  return { skipped: false, pending, errors };
}
export async function syncPendingChanges() {
  if (running) return running;
  running = pushPendingChanges().finally(() => { running = null; });
  return running;
}
export async function pullRemoteChanges() {
  if (!getSession()) return { skipped: true, count: 0, errors: [] };
  const errors = []; let count = 0;
  for (const store of TABLES) {
    const metaKey = `lastSuccessfulSync:${store}`; const since = (await getMeta(metaKey))?.value;
    try {
      const response = await apiRequest(`/api/${store}${since ? `?since=${encodeURIComponent(since)}` : ''}`);
      const localMap = new Map((await getAllIncludingDeleted(store)).map(record => [record.id, record]));
      for (const row of response.records || []) { const remote = fromRemote(store, row); const local = localMap.get(remote.id); const winner = resolveLastWriteWins(local, remote); if (!local || winner === 'remote' || winner === 'same') { await saveRemoteRecord(store, remote); localMap.set(remote.id, remote); count += 1; } }
      await setMeta(metaKey, response.cursor);
    } catch (error) { errors.push(`${store}: ${error.message}`); }
  }
  return { skipped: false, count, errors };
}
export async function fullSync() {
  if (!getSession()) return { skipped: true, errors: [] };
  if (running) return running;
  running = (async () => { const push = await pushPendingChanges(); const pull = await pullRemoteChanges(); return { ...pull, errors: [...(push.errors || []), ...(pull.errors || [])] }; })().finally(() => { running = null; });
  return running;
}
export function subscribeToRealtime() { return () => {}; }
