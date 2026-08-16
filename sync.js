/* Star Vision — central synchronization + persistent offline queue */
const SV_SYNC_KEY='starVisionDB';
const SV_PENDING_KEY='starVisionPendingDB';
const SV_SYNC_INTERVAL=5000;
let svSyncTimer=null,svSyncBusy=false,svMutationBusy=false;

function svReadLocalDB(){try{return JSON.parse(localStorage.getItem(SV_SYNC_KEY)||'null')}catch(e){return null}}
function svReadPending(){try{return JSON.parse(localStorage.getItem(SV_PENDING_KEY)||'null')}catch(e){return null}}
function svWritePending(snapshot){try{localStorage.setItem(SV_PENDING_KEY,JSON.stringify(snapshot))}catch(e){console.warn('Star Vision: não foi possível guardar fila offline',e)}}
function svClearPending(){localStorage.removeItem(SV_PENDING_KEY)}

async function svGetCentral(){const r=await fetch('/api/db?ts='+Date.now(),{method:'GET',cache:'no-store',headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}

function svApplyCentral(remote){
  if(!remote||typeof remote!=='object')return false;
  const local=svReadLocalDB(),rv=Number(remote._version||0),lv=Number(local?._version||0);
  if(rv<=0||rv<=lv)return false;
  localStorage.setItem(SV_SYNC_KEY,JSON.stringify(remote));
  window.db=remote;
  if(typeof normalizeDB==='function')normalizeDB();
  if(typeof render==='function')render();
  return true;
}

async function svPutPending(){
  const pending=svReadPending();
  if(!pending||typeof pending!=='object')return false;
  const current=await svGetCentral();
  const cv=Number(current?._version||0),pv=Number(pending?._version||0);
  let payload=pending;

  if(cv!==pv){
    if(typeof mergeDatabases==='function'){
      payload=mergeDatabases(pending,current);
      payload._version=cv;
      payload._updatedAt=current?._updatedAt||null;
    }else if(cv>pv){
      throw new Error('Conflito de versão e mergeDatabases indisponível');
    }
  }

  const r=await fetch('/api/db',{method:'PUT',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify(payload)});
  if(r.status===409){
    const x=await r.json().catch(()=>({}));
    if(x.current&&typeof mergeDatabases==='function'){
      const merged=mergeDatabases(pending,x.current);
      merged._version=Number(x.current._version||0);
      const retry=await fetch('/api/db',{method:'PUT',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify(merged)});
      if(!retry.ok)throw new Error('HTTP '+retry.status);
      const saved=await retry.json();
      db=saved;
      normalizeDB();
      localStorage.setItem(SV_SYNC_KEY,JSON.stringify(db));
      svClearPending();
      if(typeof render==='function')render();
      return true;
    }
    throw new Error(x.message||x.error||'Conflito de sincronização');
  }
  if(!r.ok)throw new Error('HTTP '+r.status);
  db=await r.json();
  normalizeDB();
  localStorage.setItem(SV_SYNC_KEY,JSON.stringify(db));
  svClearPending();
  if(typeof render==='function')render();
  return true;
}

async function svSyncNow(){
  if(svSyncBusy||svMutationBusy)return;
  svSyncBusy=true;
  try{
    if(svReadPending()){
      await svPutPending();
      return;
    }
    svApplyCentral(await svGetCentral());
  }catch(e){console.warn('Star Vision central sync:',e)}finally{svSyncBusy=false}
}

function svMarkPending(){
  if(!window.db||typeof db!=='object')return;
  svWritePending(JSON.parse(JSON.stringify(db)));
}

function svInstallSaveHook(){
  if(typeof window.saveDB!=='function'||window.saveDB.__svWrapped)return;
  const original=window.saveDB;
  function wrappedSaveDB(...args){
    svMarkPending();
    const result=original.apply(this,args);
    setTimeout(()=>svSyncNow(),250);
    return result;
  }
  wrappedSaveDB.__svWrapped=true;
  window.saveDB=wrappedSaveDB;
}

function svStartAutoSync(){
  if(svSyncTimer)clearInterval(svSyncTimer);
  svInstallSaveHook();
  svSyncNow();
  svSyncTimer=setInterval(()=>{svInstallSaveHook();svSyncNow()},SV_SYNC_INTERVAL);
  window.addEventListener('online',svSyncNow);
  window.addEventListener('focus',svSyncNow);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)svSyncNow()});
}

window.svSyncNow=svSyncNow;
window.svStartAutoSync=svStartAutoSync;
window.svMarkPending=svMarkPending;

function svPendingMaintenanceForMovement(movementId){if(!window.db||!Array.isArray(db.maintenance))return[];const movement=db.movements?.find(m=>m.id===movementId);if(!movement)return[];const pending=db.maintenance.filter(mt=>{if(mt.status==='Concluída')return false;if(mt.movementId===movementId)return true;if(mt.movementName&&mt.movementName===movement.name)return true;return movement.cases?.some(ec=>ec.caseId&&(mt.caseId===ec.caseId||mt.case===ec.caseId))});const unresolved=[];(movement.cases||[]).forEach(ec=>(ec.items||[]).forEach(item=>{if(item.returnStatus!=='falta'&&item.returnStatus!=='dano')return;const issueType=item.returnStatus==='falta'?'Falta':'Dano',itemName=String(item.name||'').trim(),related=db.maintenance.some(mt=>mt.status==='Concluída'&&(mt.movementId===movementId||mt.movementName===movement.name||mt.caseId===ec.caseId||mt.case===ec.caseId)&&mt.issueType===issueType&&String(mt.itemName||'').trim()===itemName);if(!related)unresolved.push({movementId,caseId:ec.caseId,itemName,issueType})}));return pending.concat(unresolved)}
function renderEvents(){const target=document.getElementById('eventList');if(!target)return;if(!db.movements.length){target.innerHTML='<div class="empty">Nenhum evento ou empréstimo cadastrado.</div>';return}target.innerHTML='<div class="grid">'+[...db.movements].reverse().map(m=>{const pending=m.status==='Retornado'?svPendingMaintenanceForMovement(m.id):[],badge=m.status==='Retornado'?(pending.length?'<span class="badge bad" style="font-weight:bold">EXISTEM PENDÊNCIAS</span>':'<span class="badge ok" style="font-weight:bold">SEM PENDÊNCIAS</span>'):'';return `<div class="card"><div class="between"><div><h3>${esc(m.name)}</h3><div class="muted">${esc(m.id)} • ${esc(m.type)}</div></div><span class="status-pill ${m.status==='Retornado'?'status-return':m.status==='Cancelado'?'status-cancel':'status-out'}">${esc(m.status)}</span></div>${badge?`<div style="margin-top:8px">${badge}</div>`:''}<p class="muted">Responsável: ${esc(m.responsible||'—')}<br>Saída: ${formatDate(m.date)}<br>Retorno previsto: ${formatDate(m.returnDate)}<br>Cases: ${m.cases.length}</p><div class="row"><button onclick="openMovement('${m.id}')">${m.status==='Retornado'?'Ver conferência':'Abrir / conferir'}</button>${m.status!=='Cancelado'?`<button class="danger" onclick="deleteMovement('${m.id}')">Excluir</button>`:''}</div></div>`}).join('')+'</div>'}
window.svPendingMaintenanceForMovement=svPendingMaintenanceForMovement;
async function deleteMovement(id){if(svMutationBusy)return;const movement=db.movements?.find(m=>m.id===id);if(!movement){alert('Movimentação não encontrada.');return}if(!confirm(`Excluir esta movimentação?\n\n${movement.type||'Movimentação'}: ${movement.name||id}\nCases vinculados: ${(movement.cases||[]).length}\n\nOs cases e quantidades comprometidas serão liberados novamente.`))return;svMutationBusy=true;try{const caseIds=(movement.cases||[]).map(ec=>ec.caseId).filter(Boolean);db.maintenance=(db.maintenance||[]).filter(mt=>mt.movementId!==id&&!(mt.movementName&&mt.movementName===movement.name));db.movements=(db.movements||[]).filter(m=>m.id!==id);caseIds.forEach(caseId=>{if(typeof updateCaseStatus==='function')updateCaseStatus(caseId)});if(typeof normalizeDB==='function')normalizeDB();localStorage.setItem(SV_SYNC_KEY,JSON.stringify(db));const r=await fetch('/api/db',{method:'PUT',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify(db)});if(r.status===409){const x=await r.json().catch(()=>({}));if(x.current){db=x.current;normalizeDB();localStorage.setItem(SV_SYNC_KEY,JSON.stringify(db))}throw new Error(x.message||'Conflito de sincronização.')}if(!r.ok)throw new Error('HTTP '+r.status);db=await r.json();normalizeDB();localStorage.setItem(SV_SYNC_KEY,JSON.stringify(db));closeModal();render()}catch(err){console.error('Star Vision: erro ao excluir movimentação',err);alert('Não foi possível excluir a movimentação no banco central.\n\n'+err.message);await svSyncNow()}finally{svMutationBusy=false;svSyncNow()}}
window.deleteMovement=deleteMovement;
(function loadInventoryModules(){const s=document.createElement('script');s.src='/inventory-v2.js?v=3';s.onload=()=>{const u=document.createElement('script');u.src='/inventory-ui.js?v=1';u.onload=()=>console.log('Star Vision Inventário UI carregado');u.onerror=e=>console.warn('Não foi possível carregar Inventário UI',e);document.head.appendChild(u)};s.onerror=e=>console.warn('Não foi possível carregar Inventário 2.0',e);document.head.appendChild(s)})();
(function loadUsers(){const s=document.createElement('script');s.src='/users.js?v=1';s.onload=()=>console.log('Star Vision Usuários carregado');s.onerror=e=>console.warn('Não foi possível carregar Usuários',e);document.head.appendChild(s)})();
(function loadBranding(){const s=document.createElement('script');s.src='/branding.js?v=1';s.onload=()=>console.log('Star Vision Branding carregado');s.onerror=e=>console.warn('Não foi possível carregar Branding',e);document.head.appendChild(s)})();

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',svStartAutoSync,{once:true});else svStartAutoSync();
