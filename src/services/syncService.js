import { getAllIncludingDeleted, getMeta, markSyncError, saveRemoteRecord, setMeta } from '../database/indexedDb';
import { supabase, supabaseConfigured } from './supabase';
import { resolveLastWriteWins } from './syncConflict';

const TABLES = ['gestiones', 'modelos', 'estados', 'fallas', 'dispositivos'];
let running = null;

function toRemote(store, record) {
  if (store === 'dispositivos') return { ...record, gestion_id: record.gestionId, fecha_registro: record.fechaRegistro, descripcion_falla: record.descripcionFalla };
  if (store === 'gestiones') return { ...record, fecha_creacion: record.fechaCreacion };
  return { ...record };
}

function fromRemote(store, record) {
  if (store === 'dispositivos') return { ...record, gestionId: record.gestion_id, fechaRegistro: record.fecha_registro, descripcionFalla: record.descripcion_falla };
  if (store === 'gestiones') return { ...record, fechaCreacion: record.fecha_creacion };
  return record;
}

function cleanPayload(store, record) {
  const payload = toRemote(store, record);
  delete payload.sync_status;
  delete payload.gestionId;
  delete payload.fechaRegistro;
  delete payload.descripcionFalla;
  delete payload.fechaCreacion;
  delete payload.server_updated_at;
  return payload;
}

async function getRemoteById(store, id) {
  const { data, error } = await supabase.from(store).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`${store}/${id}: ${error.message}`);
  return data;
}

/**
 * Sube únicamente si la versión local realmente gana. En caso contrario,
 * conserva la versión remota recibida y nunca sobrescribe una modificación
 * remota más reciente con un cambio offline antiguo.
 */
export async function upsertOne(store, record) {
  const remote = await getRemoteById(store, record.id);
  const winner = resolveLastWriteWins(record, remote);

  if (winner === 'remote' || winner === 'same') {
    await saveRemoteRecord(store, fromRemote(store, remote));
    return { outcome: winner === 'remote' ? 'remote-won' : 'same', record: remote };
  }

  const { data, error } = await supabase.from(store).upsert(cleanPayload(store, record), { onConflict: 'id' }).select().single();
  if (error) { await markSyncError(store, record.id); throw new Error(`${store}/${record.id}: ${error.message}`); }
  const stored = fromRemote(store, data);
  await saveRemoteRecord(store, stored);
  return { outcome: remote ? 'local-won' : 'created', record: data };
}

export async function syncPendingChanges() {
  if (!supabaseConfigured || !supabase) return { skipped: true, pending: 0, errors: [] };
  if (running) return running;
  running = (async () => {
    const errors = []; let pending = 0;
    for (const store of TABLES) {
      const records = (await getAllIncludingDeleted(store)).filter(record => record.sync_status === 'pending' || record.sync_status === 'error');
      pending += records.length;
      for (const record of records) try { await upsertOne(store, record); } catch (error) { errors.push(error.message); }
    }
    return { skipped: false, pending, errors };
  })().finally(() => { running = null; });
  return running;
}

export async function pullRemoteChanges() {
  if (!supabaseConfigured || !supabase) return { skipped: true, count: 0, errors: [] };
  const cursorType = (await getMeta('lastSuccessfulSyncKind'))?.value;
  // Cursors creados por versiones anteriores usaban el reloj del cliente.
  // Se ignoran una vez para hacer una recuperación completa segura.
  const last = cursorType === 'server_updated_at' ? ((await getMeta('lastSuccessfulSync'))?.value || '1970-01-01T00:00:00.000Z') : '1970-01-01T00:00:00.000Z';
  let count = 0; let maxServerUpdatedAt = last; const errors = [];
  for (const store of TABLES) {
    // Leer cada tabla local una sola vez. Esto también incluye eliminaciones lógicas.
    const localMap = new Map((await getAllIncludingDeleted(store)).map(record => [record.id, record]));
    const { data, error } = await supabase.from(store).select('*').gt('server_updated_at', last).order('server_updated_at', { ascending: true });
    if (error) { errors.push(`${store}: ${error.message}`); continue; }
    for (const remoteRow of data || []) {
      if (remoteRow.server_updated_at && new Date(remoteRow.server_updated_at) > new Date(maxServerUpdatedAt)) maxServerUpdatedAt = remoteRow.server_updated_at;
      const remote = fromRemote(store, remoteRow); const local = localMap.get(remote.id); const winner = resolveLastWriteWins(local, remote);
      if (!local || winner === 'remote' || winner === 'same') { await saveRemoteRecord(store, remote); localMap.set(remote.id, remote); count += 1; }
      // Si local gana, permanece pending/error para que PUSH lo compare de nuevo.
    }
  }
  // El cursor avanza solo con el máximo server_updated_at realmente recibido.
  // Si no hubo filas, conserva el cursor anterior. Nunca usa el reloj del cliente.
  if (!errors.length) {
    await setMeta('lastSuccessfulSyncKind', 'server_updated_at');
    if (new Date(maxServerUpdatedAt) > new Date(last)) await setMeta('lastSuccessfulSync', maxServerUpdatedAt);
  }
  return { skipped: false, count, errors, lastSuccessfulSync: maxServerUpdatedAt };
}

export async function fullSync() {
  if (!supabaseConfigured || !supabase) return { skipped: true, errors: [] };
  const push = await syncPendingChanges(); const pull = await pullRemoteChanges();
  return { ...pull, errors: [...(push.errors || []), ...(pull.errors || [])] };
}

export async function applyRealtimeChange(payload) {
  if (!payload || !TABLES.includes(payload.table)) return { applied: false, reason: 'unknown-table' };
  const remoteRow = payload.eventType === 'DELETE' ? payload.old : payload.new;
  if (!remoteRow) return { applied: false, reason: 'empty-payload' };
  const remote = fromRemote(payload.table, remoteRow);
  const local = (await getAllIncludingDeleted(payload.table)).find(record => record.id === remote.id);
  const winner = resolveLastWriteWins(local, remote);
  if (!local || winner === 'remote' || winner === 'same') {
    await saveRemoteRecord(payload.table, remote);
    return { applied: true, winner };
  }
  return { applied: false, winner };
}

export function subscribeToRealtime(onChange) {
  if (!supabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel('control-bodega-sync').on('postgres_changes', { event: '*', schema: 'public' }, payload => { applyRealtimeChange(payload).finally(() => onChange(payload)); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export { TABLES };
