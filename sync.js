/* Star Vision — automatic central sync
   The local database remains a fast offline cache, while /api/db is the shared source.
*/

const SV_SYNC_KEY = 'starVisionDB';
const SV_SYNC_INTERVAL = 12000;
let svSyncBusy = false;
let svSyncTimer = null;

function svNormalizeDB(value){
  if(!value || typeof value !== 'object') return null;
  return value;
}

function svReadLocalDB(){
  try { return svNormalizeDB(JSON.parse(localStorage.getItem(SV_SYNC_KEY) || 'null')); }
  catch(e){ return null; }
}

async function svPullCentral(){
  try{
    const response = await fetch('/api/db?ts=' + Date.now(), { cache:'no-store' });
    if(!response.ok) throw new Error('HTTP ' + response.status);
    const remote = svNormalizeDB(await response.json());
    if(!remote || Number(remote._version || 0) === 0) return false;
    const local = svReadLocalDB();
    const localVersion = Number(local && local._version || 0);
    if(!local || Number(remote._version || 0) > localVersion){
      localStorage.setItem(SV_SYNC_KEY, JSON.stringify(remote));
      window.db = remote;
      if(typeof renderAll === 'function') renderAll();
      return true;
    }
  }catch(e){ console.warn('Star Vision central pull:', e); }
  return false;
}

async function svPushCentral(){
  if(svSyncBusy) return false;
  const local = svReadLocalDB();
  if(!local) return false;
  svSyncBusy = true;
  try{
    const response = await fetch('/api/db', {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(local)
    });
    if(!response.ok) throw new Error('HTTP ' + response.status);
    const saved = await response.json();
    if(saved && saved._version){
      localStorage.setItem(SV_SYNC_KEY, JSON.stringify(saved));
      window.db = saved;
    }
    return true;
  }catch(e){ console.warn('Star Vision central push:', e); return false; }
  finally{ svSyncBusy = false; }
}

async function svSyncNow(){
  const changed = await svPullCentral();
  if(!changed) await svPushCentral();
}

function svStartAutoSync(){
  if(svSyncTimer) clearInterval(svSyncTimer);
  svSyncNow();
  svSyncTimer = setInterval(svSyncNow, SV_SYNC_INTERVAL);
  window.addEventListener('online', svSyncNow);
}

window.svSyncNow = svSyncNow;
window.svStartAutoSync = svStartAutoSync;
