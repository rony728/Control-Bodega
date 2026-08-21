/**
 * Decisión pura de Last Write Wins. Se mantiene independiente de Supabase
 * para que los escenarios de conflicto puedan verificarse sin red ni IndexedDB.
 */
export function compareUpdatedAt(local, remote) {
  const localTime = new Date(local?.updated_at || 0).getTime();
  const remoteTime = new Date(remote?.updated_at || 0).getTime();
  if (localTime > remoteTime) return 1;
  if (remoteTime > localTime) return -1;
  return 0;
}

export function resolveLastWriteWins(local, remote) {
  if (!remote) return 'local';
  const comparison = compareUpdatedAt(local, remote);
  return comparison > 0 ? 'local' : comparison < 0 ? 'remote' : 'same';
}
