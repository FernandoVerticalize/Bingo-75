import { get, set, del } from 'idb-keyval';
import { useStore } from './store';

const STORE_KEY = 'bingo-auto-save';

export async function saveAppSnapshot() {
  const state = Object.assign({}, useStore.getState());
  // Remove functions from state
  const snapshot: any = {};
  for (const k in state) {
    if (typeof (state as any)[k] !== 'function') {
      snapshot[k] = (state as any)[k];
    }
  }

  const payload = {
    version: "1.0",
    saved_at: new Date().toISOString(),
    ...snapshot
  };
  await set(STORE_KEY, payload);
}

export async function hasSavedData() {
  const data = await get(STORE_KEY);
  return !!data;
}

export async function loadAppSnapshot() {
  const snapshot = await get(STORE_KEY);
  if (snapshot) {
    useStore.setState({
      masterCards: snapshot.masterCards || [],
      rounds: snapshot.rounds || [],
      activeRoundId: snapshot.activeRoundId || null
    });
  }
}

export async function clearAppSnapshot() {
  await del(STORE_KEY);
}

export async function getSnapshotMeta() {
  const snapshot = await get(STORE_KEY);
  if (!snapshot) return null;
  return {
    saved_at: snapshot.saved_at,
    cardsCount: snapshot.masterCards?.length || 0,
    drawnCount: snapshot.rounds?.reduce((acc: number, r: any) => acc + (r.drawnNumbers?.length || 0), 0) || 0,
  };
}
