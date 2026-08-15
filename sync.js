/* Star Vision — automatic central database synchronization */
const SV_SYNC_KEY = 'starVisionDB';
const SV_SYNC_INTERVAL = 5000;
let svSyncTimer = null;
let svSyncBusy = false;

function svReadLocalDB() {
  try {
    return JSON.parse(localStorage.getItem(SV_SYNC_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

async function svGetCentral() {
  const r = await fetch('/api/db?ts=' + Date.now(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
}

function svApplyCentral(remote) {
  if (!remote || typeof remote !== 'object') return false;

  const local = svReadLocalDB();
  const remoteVersion = Number(remote._version || 0);
  const localVersion = Number(local?._version || 0);

  if (remoteVersion <= 0) return false;
  if (remoteVersion <= localVersion) return false;

  localStorage.setItem(SV_SYNC_KEY, JSON.stringify(remote));
  window.db = remote;

  if (typeof normalizeDB === 'function') normalizeDB();
  if (typeof render === 'function') render();

  return true;
}

async function svSyncNow() {
  if (svSyncBusy) return;
  svSyncBusy = true;

  try {
    const remote = await svGetCentral();
    svApplyCentral(remote);
  } catch (e) {
    console.warn('Star Vision central sync:', e);
  } finally {
    svSyncBusy = false;
  }
}

function svStartAutoSync() {
  if (svSyncTimer) clearInterval(svSyncTimer);

  svSyncNow();
  svSyncTimer = setInterval(svSyncNow, SV_SYNC_INTERVAL);

  window.addEventListener('online', svSyncNow);
  window.addEventListener('focus', svSyncNow);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) svSyncNow();
  });
}

window.svSyncNow = svSyncNow;
window.svStartAutoSync = svStartAutoSync;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', svStartAutoSync, { once: true });
} else {
  svStartAutoSync();
}
