/* Star Vision — automatic central sync */
const SV_SYNC_KEY = 'starVisionDB';
const SV_SYNC_INIT_KEY = 'starVisionCentralInitialized';
const SV_SYNC_INTERVAL = 12000;
let svSyncBusy = false;
let svSyncTimer = null;

function svReadLocalDB(){
  try { return JSON.parse(localStorage.getItem(SV_SYNC_KEY) || 'null'); }
  catch(e){ return null; }
}
function svCountData(db){
  if(!db || typeof db !== 'object') return 0;
  return ['cases','patrimons','events','maintenances','stock','users'].reduce((n,k)=>n+(Array.isArray(db[k])?db[k].length:0),0);
}

async function svGetCentral(){
  const r = await fetch('/api/db?ts=' + Date.now(), {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.json();
}

async function svPullCentral(remote){
  const local = svReadLocalDB();
  const remoteVersion = Number(remote && remote._version || 0);
  const localVersion = Number(local && local._version || 0);
  if(remoteVersion === 0) return false;
  if(!local || localVersion === 0 || remoteVersion > localVersion){
    localStorage.setItem(SV_SYNC_KEY, JSON.stringify(remote));
    window.db = remote;
    localStorage.setItem(SV_SYNC_INIT_KEY, '1');
    if(typeof renderAll === 'function') renderAll();
    return true;
  }
  return false;
}

async function svPushCentral(local){
  if(svSyncBusy) return false;
  svSyncBusy = true;
  try{
    const r = await fetch('/api/db', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(local)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const saved = await r.json();
    localStorage.setItem(SV_SYNC_KEY, JSON.stringify(saved));
    window.db = saved;
    localStorage.setItem(SV_SYNC_INIT_KEY, '1');
    return true;
  }catch(e){ console.warn('Star Vision central push:',e); return false; }
  finally{ svSyncBusy=false; }
}

async function svSyncNow(){
  try{
    const local = svReadLocalDB();
    const remote = await svGetCentral();
    const initialized = localStorage.getItem(SV_SYNC_INIT_KEY) === '1';

    // First connection: PC data wins only when the central database is empty.
    if(!initialized && Number(remote && remote._version || 0) === 0 && svCountData(local) > 0){
      await svPushCentral(local);
      return;
    }
    if(await svPullCentral(remote)) return;

    if(initialized && local) await svPushCentral(local);
  }catch(e){ console.warn('Star Vision central sync:',e); }
}

function svStartAutoSync(){
  if(svSyncTimer) clearInterval(svSyncTimer);
  svSyncNow();
  svSyncTimer = setInterval(svSyncNow, SV_SYNC_INTERVAL);
  window.addEventListener('online', svSyncNow);
}

window.svSyncNow = svSyncNow;
window.svStartAutoSync = svStartAutoSync;
