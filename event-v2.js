/* Star Vision — Eventos 2.0
   Saída organizada por grupo, com CASES físicos e ITENS independentes.
*/
(function(){
  const GROUPS=[
    ['G-SOM','Som'],['G-LUZ','Iluminação'],['G-LED','Painel de LED'],
    ['G-EST','Estrutura'],['G-GER','Geradores'],['G-ACC','Acessórios']
  ];

  function ensure(){
    db.inventoryGroups ||= [];
    db.inventoryItems ||= [];
    GROUPS.forEach(([id,name])=>{if(!db.inventoryGroups.some(g=>g.id===id))db.inventoryGroups.push({id,name,active:true});});
    db.cases ||= []; db.movements ||= [];
    db.cases.forEach(c=>{
      c.items ||= [];
      if(!c.groupId){const first=c.items.find(x=>x.inventoryItemId);const inv=first&&db.inventoryItems.find(i=>i.id===first.inventoryItemId);c.groupId=inv?.groupId||guessGroup(c.name);}
    });
    db.movements.forEach(m=>{m.cases ||= [];m.items ||= [];});
  }

  function guessGroup(name){
    const n=String(name||'').toLowerCase();
    if(/m32|midas|01v|mesa|console|xlr|microfone|audio|som|sub|line array|cabo/.test(n))return'G-SOM';
    if(/beam|moving|par led|luz|ilum/.test(n))return'G-LUZ';
    if(/painel|led|rj|powercon/.test(n))return'G-LED';
    if(/estrutura|box|treliça|truss|praticável|pórtico/.test(n))return'G-EST';
    if(/gerador/.test(n))return'G-GER';
    return'G-ACC';
  }
  function group(id){return db.inventoryGroups.find(g=>g.id===id)||{id,name:'Outros'};}
  function inv(id){return db.inventoryItems.find(i=>i.id===id);}
  function itemIdForName(name){return db.inventoryItems.find(i=>String(i.name).toLowerCase()===String(name).toLowerCase())?.id;}

  function allocatedItemQty(itemId,ignoreId){
    let total=0;
    (db.movements||[]).filter(m=>m.status==='Aberto'&&m.id!==ignoreId).forEach(m=>{
      (m.items||[]).forEach(x=>{if(x.inventoryItemId===itemId)total+=Number(x.qty||0);});
      (m.cases||[]).forEach(ec=>(ec.items||[]).forEach(x=>{if(x.inventoryItemId===itemId)total+=Number(x.qty||0);}));
    });
    return total;
  }
  function allocatedCase(caseId,ignoreId){return db.movements.some(m=>m.status==='Aberto'&&m.id!==ignoreId&&(m.cases||[]).some(x=>x.caseId===caseId));}
  function caseAvailable(c,m){
    if(c.active===false)return'Case retirado do inventário.';
    if(['Indisponível','Em manutenção interna','Em manutenção externa'].includes(c.status))return'Case indisponível / em manutenção.';
    if(allocatedCase(c.id,m.id))return'Case já está em outro evento.';
    for(const x of c.items||[]){const i=inv(x.inventoryItemId);if(!i||i.control!=='quantidade')continue;const available=Number(i.totalQty||0)-allocatedItemQty(i.id,m.id);if(Number(x.qty||0)>available)return`${i.name}: disponível ${available} ${i.unit}, necessário ${x.qty} ${i.unit}.`;}
    return'';
  }
  function directAvailable(i,m,qty){
    const available=Number(i.totalQty||0)-allocatedItemQty(i.id,m.id);
    return available>=qty?{ok:true,available}:{ok:false,available};
  }

  function openMovement(id){
    ensure();
    const m=db.movements.find(x=>x.id===id);if(!m)return;
    const groups=db.inventoryGroups.filter(g=>g.active!==false);
    openModal(m.type+' — '+m.name,`<div class="between"><div><b>${esc(m.id)}</b><div class="muted">${formatDate(m.date)} • Responsável: ${esc(m.responsible||'—')}</div></div><span class="status-pill ${m.status==='Retornado'?'status-return':'status-out'}">${esc(m.status)}</span></div>
      ${m.status==='Aberto'?`<h3 style="margin-top:20px">Adicionar equipamentos por grupo</h3><div class="grid">${groups.map(g=>`<div class="card"><div class="between"><h3>${esc(g.name)}</h3><span class="badge">${groupCount(m,g.id)} selecionado(s)</span></div><div class="row"><button onclick="svEventAddCase('${m.id}','${g.id}')">+ Case</button><button onclick="svEventAddItem('${m.id}','${g.id}')">+ Item</button></div></div>`).join('')}</div>`:''}
      <h3 style="margin-top:20px">Equipamentos do evento</h3><div id="movementCases">${renderEventGroups(m)}</div>
      <div class="row" style="margin-top:18px">${m.status==='Aberto'&&(m.cases.length||m.items.length)?`<button class="primary" onclick="printMovement('${m.id}')">Imprimir saída</button><button class="success" onclick="returnMovement('${m.id}')">Registrar retorno</button>`:''}${m.status==='Retornado'?`<button class="primary" onclick="printMovement('${m.id}')">Imprimir conferência</button>`:''}</div>`);
  }

  function groupCount(m,gid){return (m.cases||[]).filter(x=>db.cases.find(c=>c.id===x.caseId)?.groupId===gid).length+(m.items||[]).filter(x=>x.groupId===gid).length;}
  function renderEventGroups(m){
    const used=[];
    (m.cases||[]).forEach(ec=>{const c=db.cases.find(x=>x.id===ec.caseId);if(c&&!used.includes(c.groupId))used.push(c.groupId);});
    (m.items||[]).forEach(x=>{if(x.groupId&&!used.includes(x.groupId))used.push(x.groupId);});
    if(!used.length)return'<div class="empty">Nenhum equipamento selecionado.</div>';
    return used.map(gid=>{const g=group(gid),cases=(m.cases||[]).filter(ec=>db.cases.find(c=>c.id===ec.caseId)?.groupId===gid),items=(m.items||[]).filter(x=>x.groupId===gid);return `<div class="card" style="margin:10px 0"><h3>${esc(g.name)}</h3>${cases.map(ec=>{const c=db.cases.find(x=>x.id===ec.caseId);return `<div class="event-case"><div class="event-case-head"><div><b>📦 ${esc(c?.name||ec.caseId)}</b><div class="muted">${esc(ec.caseId)} • CASE</div></div>${m.status==='Aberto'?`<button class="small danger" onclick="svRemoveCase('${m.id}','${ec.caseId}')">Remover</button>`:''}</div><div class="event-case-body">${(ec.items||[]).map(x=>`<div class="between"><span>${esc(safeItemName(x.name))}</span><b>${x.qty} ${esc(x.unit||'un')}</b></div>`).join('')||'<span class="muted">Case sem conteúdo cadastrado.</span>'}</div></div>`;}).join('')}${items.map((x,idx)=>`<div class="event-case"><div class="event-case-head"><div><b>📋 ${esc(x.name)}</b><div class="muted">ITEM • ${x.inventoryItemId}</div></div>${m.status==='Aberto'?`<button class="small danger" onclick="svRemoveItem('${m.id}',${idx})">Remover</button>`:''}</div><div class="event-case-body"><b>${x.qty} ${esc(x.unit||'un')}</b></div></div>`).join('')}</div>`;}).join('');
  }

  function svEventAddCase(mid,gid){
    const m=db.movements.find(x=>x.id===mid);const cases=db.cases.filter(c=>c.active!==false&&(c.groupId||guessGroup(c.name))===gid);if(!cases.length)return alert('Nenhum case cadastrado neste grupo.');
    openModal('Adicionar case — '+group(gid).name,`<div class="check-list">${cases.map(c=>{const selected=m.cases.some(x=>x.caseId===c.id),reason=caseAvailable(c,m);return `<label class="check-item"><input type="checkbox" ${selected?'checked':''} ${reason&&!selected?'disabled':''} onchange="svSelectCase('${mid}','${c.id}',this.checked)"><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.id)}</span>${reason&&!selected?`<br><span class="bad">⚠️ ${esc(reason)}</span>`:''}</span></label>`}).join('')}</div><button onclick="openMovement('${mid}')">Concluir</button>`);
  }
  function svSelectCase(mid,cid,checked){const m=db.movements.find(x=>x.id===mid),c=db.cases.find(x=>x.id===cid);if(!m||!c)return;if(checked){const reason=caseAvailable(c,m);if(reason)return alert(reason);m.cases.push({caseId:cid,items:(c.items||[]).map(x=>({...x,name:safeItemName(x.name),originalQty:Number(x.qty||0)})),checked:false,returned:false,divergences:[]});c.status='Reservado';}else{m.cases=m.cases.filter(x=>x.caseId!==cid);updateCaseStatus(cid);}saveDB();openModal('Adicionar case — '+group(c.groupId||guessGroup(c.name)).name,`<p class="muted">Case atualizado.</p><button onclick="openMovement('${mid}')">Voltar ao evento</button>`);}
  function svRemoveCase(mid,cid){const m=db.movements.find(x=>x.id===mid);if(!m)return;m.cases=m.cases.filter(x=>x.caseId!==cid);updateCaseStatus(cid);saveDB();openMovement(mid);}

  function svEventAddItem(mid,gid){
    const m=db.movements.find(x=>x.id===mid);const list=db.inventoryItems.filter(i=>i.active!==false&&i.groupId===gid);if(!list.length)return alert('Nenhum item cadastrado neste grupo.');
    openModal('Adicionar item — '+group(gid).name,`<label>Item</label><select id="svEventItem">${list.map(i=>{const av=Math.max(0,Number(i.totalQty||0)-allocatedItemQty(i.id,mid));return `<option value="${i.id}">${esc(i.name)} — disponível: ${av} ${esc(i.unit)}</option>`}).join('')}</select><label>Quantidade</label><input id="svEventQty" type="number" min="1" value="1"><button class="primary" onclick="svConfirmItem('${mid}','${gid}')">Adicionar ao evento</button>`);
  }
  function svConfirmItem(mid,gid){const m=db.movements.find(x=>x.id===mid),i=inv(document.getElementById('svEventItem').value),qty=Number(document.getElementById('svEventQty').value||0);if(!m||!i||qty<1)return;if(i.control==='patrimonio'&&qty!==1)return alert('Patrimônio deve ser adicionado em unidade.');const av=directAvailable(i,m,qty);if(!av.ok)return alert(`Quantidade indisponível. Disponível: ${av.available} ${i.unit}.`);m.items.push({inventoryItemId:i.id,name:i.name,groupId:gid,qty,unit:i.unit,returnStatus:'ok',returnQty:qty,qtyMissing:0,damageDescription:'',note:''});saveDB();openMovement(mid);}
  function svRemoveItem(mid,index){const m=db.movements.find(x=>x.id===mid);if(!m)return;m.items.splice(index,1);saveDB();openMovement(mid);}

  function returnMovement(id){
    ensure();const m=db.movements.find(x=>x.id===id);if(!m)return;
    const sections=[];
    (m.cases||[]).forEach(ec=>{const c=db.cases.find(x=>x.id===ec.caseId);sections.push(`<div class="event-case"><div class="event-case-head"><b>📦 ${esc(c?.name||ec.caseId)}</b></div><div class="event-case-body">${(ec.items||[]).map((x,i)=>returnCard(x,'case',ec.caseId,i)).join('')}</div></div>`);});
    (m.items||[]).forEach((x,i)=>sections.push(`<div class="event-case"><div class="event-case-head"><b>📋 ${esc(x.name)}</b></div><div class="event-case-body">${returnCard(x,'item','direct',i)}</div></div>`));
    openModal('Retorno — '+m.name,`<p class="muted">Confira cases e itens. Em falta informe a quantidade faltante; em dano descreva o problema.</p><div id="returnCases">${sections.join('')}</div><button class="primary" onclick="saveReturn('${m.id}')">Confirmar retorno</button>`);
  }
  function returnCard(x,kind,key,index){const s=x.returnStatus||'ok';return `<div class="card" style="margin-bottom:9px"><b>${esc(safeItemName(x.name))}</b><div class="muted">Saiu: ${x.qty} ${esc(x.unit||'un')}</div><label>Situação</label><select class="sv-ret-status" data-kind="${kind}" data-key="${key}" data-index="${index}" onchange="svReturnFields(this)"><option value="ok" ${s==='ok'?'selected':''}>OK</option><option value="falta" ${s==='falta'?'selected':''}>⚠️ Falta</option><option value="dano" ${s==='dano'?'selected':''}>⚠️ Dano</option></select><div class="sv-ret-extra">${returnExtra(x,kind,key,index)}</div></div>`;}
  function returnExtra(x,kind,key,index){const s=x.returnStatus||'ok';if(s==='falta'){return `<label>Quantidade faltante</label><input class="sv-ret-missing" data-kind="${kind}" data-key="${key}" data-index="${index}" type="number" min="0" max="${x.qty}" value="${x.qtyMissing||0}">`;}if(s==='dano'){return `<label>Quantidade retornada</label><input class="sv-ret-qty" data-kind="${kind}" data-key="${key}" data-index="${index}" type="number" min="0" max="${x.qty}" value="${x.returnQty??x.qty}"><label>Descrição do dano</label><textarea class="sv-ret-damage" data-kind="${kind}" data-key="${key}" data-index="${index}">${esc(x.damageDescription||'')}</textarea>`;}return `<label>Quantidade retornada</label><input class="sv-ret-qty" data-kind="${kind}" data-key="${key}" data-index="${index}" type="number" min="0" max="${x.qty}" value="${x.returnQty??x.qty}">`;}
  function svReturnFields(sel){const card=sel.closest('.card'),key=sel.dataset.key,kind=sel.dataset.kind,index=Number(sel.dataset.index);const x=findReturnItem(kind,key,index);if(!x)return;x.returnStatus=sel.value;card.querySelector('.sv-ret-extra').innerHTML=returnExtra(x,kind,key,index);}
  function findReturnItem(kind,key,index){const m=db.movements.find(m=>m.id===window.svReturnMovementId);if(!m)return null;return kind==='case'?m.cases.find(x=>x.caseId===key)?.items[index]:m.items[index];}
  function saveReturn(id){
    const m=db.movements.find(x=>x.id===id);if(!m)return;window.svReturnMovementId=id;
    (m.cases||[]).forEach(ec=>(ec.items||[]).forEach((x,i)=>applyReturnFields(x,'case',ec.caseId,i)));
    (m.items||[]).forEach((x,i)=>applyReturnFields(x,'item','direct',i));
    for(const x of [...m.cases.flatMap(e=>e.items||[]),...(m.items||[])]){if(x.returnStatus==='falta'&&Number(x.qtyMissing||0)<=0)return alert('Informe a quantidade faltante para: '+safeItemName(x.name));if(x.returnStatus==='dano'&&!String(x.damageDescription||'').trim())return alert('Descreva o dano encontrado em: '+safeItemName(x.name));}
    (m.cases||[]).forEach(ec=>(ec.items||[]).forEach(x=>{if(x.returnStatus==='falta'||x.returnStatus==='dano')createReturnMaintenance(m,ec,x);}));
    (m.items||[]).forEach(x=>{if(x.returnStatus==='falta'||x.returnStatus==='dano')createItemMaintenance(m,x);});
    m.cases.forEach(ec=>{ec.returned=true;updateCaseStatus(ec.caseId);});m.status='Retornado';m.returned=true;m.returnedAt=new Date().toISOString();saveDB();closeModal();render();
  }
  function applyReturnFields(x,kind,key,index){const sel=document.querySelector(`.sv-ret-status[data-kind="${kind}"][data-key="${key}"][data-index="${index}"]`);if(!sel)return;x.returnStatus=sel.value;const q=document.querySelector(`.sv-ret-qty[data-kind="${kind}"][data-key="${key}"][data-index="${index}"]`);const miss=document.querySelector(`.sv-ret-missing[data-kind="${kind}"][data-key="${key}"][data-index="${index}"]`);const dam=document.querySelector(`.sv-ret-damage[data-kind="${kind}"][data-key="${key}"][data-index="${index}"]`);if(x.returnStatus==='falta'){x.qtyMissing=Math.min(Number(x.qty||0),Math.max(0,Number(miss?.value||0)));x.returnQty=Number(x.qty||0)-x.qtyMissing;x.note=`Faltante: ${x.qtyMissing} ${x.unit||'un'}`;}else if(x.returnStatus==='dano'){x.returnQty=Math.min(Number(x.qty||0),Math.max(0,Number(q?.value||0)));x.qtyMissing=0;x.damageDescription=dam?.value.trim()||'';x.note=x.damageDescription;}else{x.returnQty=Math.min(Number(x.qty||0),Math.max(0,Number(q?.value??x.qty)));x.qtyMissing=0;x.damageDescription='';x.note='';}}
  function createItemMaintenance(m,item){const issue=item.returnStatus==='falta'?'Falta':'Dano';const exists=db.maintenance.some(x=>x.movementId===m.id&&!x.caseId&&x.itemName===safeItemName(item.name)&&x.issueType===issue&&x.status!=='Concluída');if(exists)return;db.maintenance.push({id:uid('MT'),name:safeItemName(item.name),case:'',caseId:'',type:'Interna',issueType:issue,desc:`${issue} identificada no retorno do evento "${m.name}". ${item.note||''}`.trim(),status:'Pendente',date:today(),movementId:m.id,movementName:m.name,itemName:safeItemName(item.name),qtyOut:Number(item.qty||0),qtyReturned:Number(item.returnQty||0),qtyMissing:Number(item.qtyMissing||0),note:item.note||'',damageDescription:item.damageDescription||'',alert:true});}

  function pendingForMovement(m){const p=(db.maintenance||[]).filter(x=>x.status!=='Concluída'&&(x.movementId===m.id||(x.movementName&&x.movementName===m.name)));const unresolved=[];(m.cases||[]).forEach(ec=>(ec.items||[]).forEach(x=>{if(x.returnStatus==='falta'||x.returnStatus==='dano'){const issue=x.returnStatus==='falta'?'Falta':'Dano',done=db.maintenance.some(mt=>mt.status==='Concluída'&&mt.movementId===m.id&&mt.issueType===issue&&mt.itemName===safeItemName(x.name));if(!done)unresolved.push(1);}}));(m.items||[]).forEach(x=>{if(x.returnStatus==='falta'||x.returnStatus==='dano'){const issue=x.returnStatus==='falta'?'Falta':'Dano',done=db.maintenance.some(mt=>mt.status==='Concluída'&&mt.movementId===m.id&&mt.issueType===issue&&mt.itemName===safeItemName(x.name));if(!done)unresolved.push(1);}});return p.length+unresolved.length;}
  function renderEvents(){const t=document.getElementById('eventList');if(!t)return;if(!db.movements.length){t.innerHTML='<div class="empty">Nenhum evento ou empréstimo cadastrado.</div>';return}t.innerHTML='<div class="grid">'+[...db.movements].reverse().map(m=>`<div class="card"><div class="between"><div><h3>${esc(m.name)}</h3><div class="muted">${esc(m.id)} • ${esc(m.type)}</div></div><span class="status-pill ${m.status==='Retornado'?'status-return':m.status==='Cancelado'?'status-cancel':'status-out'}">${esc(m.status)}</span></div>${m.status==='Retornado'?`<div style="margin-top:8px"><span class="badge ${pendingForMovement(m)?'bad':'ok'}" style="font-weight:bold">${pendingForMovement(m)?'EXISTEM PENDÊNCIAS':'SEM PENDÊNCIAS'}</span></div>`:''}<p class="muted">Responsável: ${esc(m.responsible||'—')}<br>Saída: ${formatDate(m.date)}<br>Retorno previsto: ${formatDate(m.returnDate)}<br>Cases: ${(m.cases||[]).length} • Itens: ${(m.items||[]).length}</p><div class="row"><button onclick="openMovement('${m.id}')">${m.status==='Retornado'?'Ver conferência':'Abrir / conferir'}</button>${m.status!=='Cancelado'?`<button class="danger" onclick="deleteMovement('${m.id}')">Excluir</button>`:''}</div></div>`).join('')+'</div>';}

  function printMovement(id){
    const m=db.movements.find(x=>x.id===id);if(!m)return;const rows=[];(m.cases||[]).forEach(ec=>{const c=db.cases.find(x=>x.id===ec.caseId);(ec.items||[]).forEach(x=>rows.push(`<tr><td>${esc(group(c?.groupId).name)}</td><td>CASE</td><td>${esc(c?.name||ec.caseId)}</td><td>${esc(safeItemName(x.name))}</td><td>${x.qty}</td><td>${esc(x.unit||'un')}</td><td>${m.status==='Retornado'?x.returnQty??x.qty:'—'}</td><td>${m.status==='Retornado'?(x.returnStatus==='falta'?`FALTA — ${x.qtyMissing||0}`:x.returnStatus==='dano'?'DANO':'OK'):'FORA'}</td></tr>`));});(m.items||[]).forEach(x=>rows.push(`<tr><td>${esc(group(x.groupId).name)}</td><td>ITEM</td><td>—</td><td>${esc(x.name)}</td><td>${x.qty}</td><td>${esc(x.unit||'un')}</td><td>${m.status==='Retornado'?x.returnQty??x.qty:'—'}</td><td>${m.status==='Retornado'?(x.returnStatus==='falta'?`FALTA — ${x.qtyMissing||0}`:x.returnStatus==='dano'?'DANO':'OK'):'FORA'}</td></tr>`));const w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><meta charset="utf-8"><title>${esc(m.name)}</title><style>body{font-family:Arial;padding:30px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #999;padding:7px;font-size:11px;text-align:left}th{background:#eee}</style></head><body><b style="font-size:24px;letter-spacing:3px">STAR VISION</b><div>GESTÃO DE EQUIPAMENTOS</div><h2>${esc(m.type)} — ${esc(m.name)}</h2><p><b>Responsável:</b> ${esc(m.responsible||'—')}<br><b>Saída:</b> ${formatDate(m.date)}<br><b>Retorno previsto:</b> ${formatDate(m.returnDate)}</p><table><thead><tr><th>Grupo</th><th>Tipo</th><th>Case</th><th>Item</th><th>Qtd.</th><th>Un.</th><th>Retorno</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`);w.document.close();}

  window.openMovement=openMovement;window.renderEvents=renderEvents;window.returnMovement=returnMovement;window.saveReturn=saveReturn;window.printMovement=printMovement;
  window.svEventAddCase=svEventAddCase;window.svSelectCase=svSelectCase;window.svRemoveCase=svRemoveCase;window.svEventAddItem=svEventAddItem;window.svConfirmItem=svConfirmItem;window.svRemoveItem=svRemoveItem;window.svReturnFields=svReturnFields;window.svReturnMovementId='';
  ensure();
  setTimeout(()=>{try{renderEvents()}catch(e){console.warn('Star Vision Eventos 2.0',e)}},0);
})();
