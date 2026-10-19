import Dexie from 'dexie';

export const localDb = new Dexie('voice-notepad');
localDb.version(1).stores({ notes: 'clientId, updatedAt', queue: '++id, clientId, action' });
localDb.version(2).stores({ notes: '[userId+clientId], userId, clientId, updatedAt', queue: '++id, userId, clientId, action' });

export async function saveLocal(note, userId, queue = true) {
  const record = { ...note, userId, updatedAt: new Date().toISOString() };
  await localDb.notes.put(record);
  if (queue) {
    const oldJobs = await localDb.queue.where('userId').equals(userId).filter(job => job.clientId === note.clientId && job.action === 'upsert').primaryKeys();
    if (oldJobs.length) await localDb.queue.bulkDelete(oldJobs);
    await localDb.queue.add({ userId, clientId: note.clientId, action: 'upsert', payload: record });
  }
  return record;
}

export async function deleteLocal(clientId, userId, queue = true) {
  await localDb.notes.delete([userId, clientId]);
  if (queue) await localDb.queue.add({ userId, clientId, action: 'delete' });
}
