/* Star Vision - Inventário 2.0
   Grupos + itens + cases + disponibilidade por evento.
*/

(function(){
  const GROUPS = [
    ['G-SOM','Som'], ['G-LUZ','Iluminação'], ['G-LED','Painel de LED'],
    ['G-EST','Estrutura'], ['G-GER','Geradores'], ['G-ACC','Acessórios']
  ];

  function ensureModel(){
    db.inventoryGroups ||= [];
    db.inventoryItems ||= [];
    GROUPS.forEach(([id,name])=>{ if(!db.inventoryGroups.some(g=>g.id===id)) db.inventoryGroups.push({id,name,active:true}); });

    const guessGroup=(name)=>{
      const n=String(name||'').toLowerCase();
      if(/m32|midas|01v96|ada|mesa|console|xlr|microfone|audio|som|sub|line array|cabo/.test(n)) return 'G-SOM';
      if(/beam|grand ma|moving|par led|luz|ilum/.test(n)) return 'G-LUZ';
      if(/painel|led|rj|powercon/.test(n)) return 'G-LED';
      if(/estrutura|box|treliça|truss|praticável|pórtico/.test(n)) return 'G-EST';
      if(/gerador/.test(n)) return 'G-GER';
      return 'G-ACC';
    };
    const findQty=(name)=>db.inventoryItems.find(i=>i.control==='quantidade' && i.name.toLowerCase()===String(name).toLowerCase());
    const findPat=(name)=>db.inventoryItems.find(i=>i.control==='patrimonio' && i.name.toLowerCase()===String(name).toLowerCase());

    (db.equipment||[]).forEach(e=>{
      let item=findPat(e.name);
      if(!item){ item={id:uid('INV'),name:e.name,groupId:guessGroup(e.name),control:'patrimonio',unit:'un',totalQty:0,active:true}; db.inventoryItems.push(item); }
      e.inventoryItemId=item.id;
    });
    const patCounts={};
    (db.equipment||[]).forEach(e=>{ patCounts[e.inventoryItemId]=(patCounts[e.inventoryItemId]||0)+1; });
    db.inventoryItems.filter(i=>i.control==='patrimonio').forEach(i=>{ i.totalQty=patCounts[i.id]||Number(i.totalQty||0); });

    (db.cases||[]).forEach(c=>{
      c.items ||= [];
      c.active=c.active!==false;
      c.items.forEach(item=>{
        if(item.inventoryItemId && db.inventoryItems.some(i=>i.id===item.inventoryItemId)) return;
        const name=safeItemName(item.name); if(!name) return;
        let inv=findQty(name);
        if(!inv){ inv={id:uid('INV'),name,groupId:guessGroup(name),control:'quantidade',unit:item.unit||'un',totalQty:0,active:true}; db.inventoryItems.push(inv); }
        item.inventoryItemId=inv.id; item.qty=Number(item.qty||0); item.unit=item.unit||inv.unit||'un';
      });
    });
    db.inventoryItems.forEach(i=>{ i.groupId ||= guessGroup(i.name); i.control ||= 'quantidade'; i.unit ||= 'un'; i.totalQty=Number(i.totalQty||0); i.active=i.active!==false; });
  }

  function invGroup(id){ return db.inventoryGroups.find(g=>g.id===id); }
  function invItem(id){ return db.inventoryItems.find(i=>i.id===id); }

  function saveInventory(){
    localStorage.setItem('starVisionDB',JSON.stringify(db));
    return fetch('/api/db',{method:'PUT',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(db)}).then(async r=>{
      if(r.status===409){
        const x=await r.json();
        if(x.current){
          const remote=x.current;
          const merge=(a,b,key)=>{ const map=new Map(); (a||[]).forEach(v=>map.set(v[key],v)); (b||[]).forEach(v=>map.set(v[key],v)); return [...map.values()]; };
          db={...remote,
            cases:merge(remote.cases,db.cases,'id'), equipment:merge(remote.equipment,db.equipment,'pat'),
            maintenance:merge(remote.maintenance,db.maintenance,'id'), movements:merge(remote.movements,db.movements,'id'),
            stock:merge(remote.stock,db.stock,'name'), users:merge(remote.users,db.users,'user'),
            inventoryGroups:merge(remote.inventoryGroups,db.inventoryGroups,'id'), inventoryItems:merge(remote.inventoryItems,db.inventoryItems,'id')};
          normalizeDB(); ensureModel(); return saveInventory();
        }
      }
      if(!r.ok) throw new Error('HTTP '+r.status);
      db=await r.json(); normalizeDB(); ensureModel(); localStorage.setItem('starVisionDB',JSON.stringify(db)); return db;
    }).catch(e=>console.warn('Inventário: falha ao sincronizar',e));
  }

  function tabs(tab){
    const ep=document.getElementById('equipmentPanel'), cp=document.getElementById('casesPanel'); if(!ep||!cp)return;
    ep.classList.add('hidden'); cp.classList.add('hidden');
    if(tab==='items')ep.classList.remove('hidden'); else cp.classList.remove('hidden');
    document.querySelectorAll('#inventory .tab').forEach(b=>b.classList.toggle('active',b.dataset.invtab===tab));
    if(tab==='items')renderItems(); if(tab==='cases')renderCasesV2(); if(tab==='groups')renderGroups();
  }

  function renderInventoryV2(){
    ensureModel();
    const t=document.querySelector('#inventory .tabs');
    if(t)t.innerHTML=`<button class="tab" data-invtab="items" onclick="svInventoryTab('items')">Itens</button><button class="tab" data-invtab="cases" onclick="svInventoryTab('cases')">Cases</button><button class="tab" data-invtab="groups" onclick="svInventoryTab('groups')">Grupos</button>`;
    tabs('items');
  }

  function renderItems(){
    const ep=document.getElementById('equipmentPanel'); if(!ep)return;
    ep.innerHTML=`<div class="section-head"><div><h3>Itens do inventário</h3><div class="muted">Cadastre cada item em seu grupo e defina se o controle é por quantidade ou patrimônio.</div></div><button class="primary" onclick="svNewInventoryItem()">+ Novo item</button></div><input class="search" id="svInvSearch" placeholder="Pesquisar item..." oninput="svRenderItemTable()"><div id="svItemTable"></div>`;
    svRenderItemTable();
  }

  function svRenderItemTable(){
    const target=document.getElementById('svItemTable'); if(!target)return;
    const q=(document.getElementById('svInvSearch')?.value||'').toLowerCase();
    const list=db.inventoryItems.filter(i=>i.active!==false&&(i.name.toLowerCase().includes(q)||(invGroup(i.groupId)?.name||'').toLowerCase().includes(q)));
    if(!list.length){target.innerHTML='<div class="empty">Nenhum item cadastrado.</div>';return;}
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Grupo</th><th>Controle</th><th>Total</th><th>Em uso</th><th>Disponível</th><th></th></tr></thead><tbody>${list.map(i=>{const used=allocatedQty(i.id),available=Math.max(0,Number(i.totalQty||0)-used);return `<tr><td><b>${esc(i.name)}</b></td><td>${esc(invGroup(i.groupId)?.name||'—')}</td><td>${i.control==='patrimonio'?'Patrimônio':'Quantidade'}</td><td>${i.totalQty} ${esc(i.unit)}</td><td>${used} ${esc(i.unit)}</td><td class="${available>0?'ok':'bad'}">${available} ${esc(i.unit)}</td><td><button class="small" onclick="svEditInventoryItem('${i.id}')">Editar</button> <button class="small danger" onclick="svDeleteInventoryItem('${i.id}')">Excluir</button></td></tr>`}).join('')}</tbody></table></div>`;
  }

  function allocatedQty(itemId,ignoreMovementId){
    let total=0;
    (db.movements||[]).filter(m=>m.status==='Aberto'&&m.id!==ignoreMovementId).forEach(m=>(m.cases||[]).forEach(ec=>(ec.items||[]).forEach(it=>{if(it.inventoryItemId===itemId)total+=Number(it.qty||0);}))); return total;
  }
  function allocatedEquipmentIds(ignoreMovementId){
    const ids=new Set();
    (db.movements||[]).filter(m=>m.status==='Aberto'&&m.id!==ignoreMovementId).forEach(m=>(m.cases||[]).forEach(ec=>{(db.equipment||[]).filter(e=>e.caseId===ec.caseId).forEach(e=>ids.add(e.pat));(ec.equipmentIds||[]).forEach(x=>ids.add(x));})); return ids;
  }
  function caseAvailability(caseId,movementId){
    const c=db.cases.find(x=>x.id===caseId); if(!c)return{ok:false,reason:'Case não encontrado.'};
    if(c.active===false)return{ok:false,reason:'Case retirado do inventário.'};
    if(['Indisponível','Em manutenção interna','Em manutenção externa'].includes(c.status))return{ok:false,reason:'Case indisponível / em manutenção.'};
    if(db.movements.some(m=>m.status==='Aberto'&&m.id!==movementId&&m.cases?.some(ec=>ec.caseId===caseId)))return{ok:false,reason:'Case já está em outro evento aberto.'};
    const eqUsed=allocatedEquipmentIds(movementId), conflict=(db.equipment||[]).filter(e=>e.caseId===caseId).find(e=>eqUsed.has(e.pat));
    if(conflict)return{ok:false,reason:`Patrimônio ${conflict.pat} já está em outro evento.`};
    for(const it of c.items||[]){const inv=invItem(it.inventoryItemId);if(!inv||inv.control!=='quantidade')continue;const requested=Number(it.qty||0),available=Number(inv.totalQty||0)-allocatedQty(inv.id,movementId);if(requested>available)return{ok:false,reason:`${inv.name}: disponível ${available} ${inv.unit}, necessário ${requested} ${inv.unit}.`};}
    return{ok:true};
  }

  function renderCasesV2(){const cp=document.getElementById('casesPanel');if(!cp)return;cp.innerHTML=`<div class="section-head"><div><h3>Cases</h3><div class="muted">Cada case é um conjunto físico. Ao entrar em um evento, ele fica indisponível para os demais.</div></div><button class="primary" onclick="svNewCase()">+ Novo case</button></div><input class="search" id="svCaseSearch" placeholder="Pesquisar case..." oninput="svRenderCaseTable()"><div id="svCaseTable"></div>`;svRenderCaseTable();}
  function svRenderCaseTable(){const t=document.getElementById('svCaseTable');if(!t)return;const q=(document.getElementById('svCaseSearch')?.value||'').toLowerCase();const list=db.cases.filter(c=>c.active!==false&&(c.name.toLowerCase().includes(q)||c.id.toLowerCase().includes(q)));t.innerHTML=`<div class="grid">${list.map(c=>{const pending=pendingMaintenanceForCase(c.id),open=caseHasOpenMovement(c.id);return `<div class="card"><div class="between"><div><h3>${esc(c.name)}</h3><div class="muted">${esc(c.id)}</div></div><span class="status-pill ${c.status==='Disponível'?'status-ok':'status-out'}">${esc(c.status)}</span></div>${pending.length?'<div class="maintenance-alert">⚠️ Manutenção pendente</div>':''}<div style="margin:12px 0">${(c.items||[]).map(it=>{const inv=invItem(it.inventoryItemId);return `<span class="badge">${esc(inv?.name||safeItemName(it.name))} × ${it.qty||0} ${esc(it.unit||inv?.unit||'un')}</span>`}).join('')||'<span class="muted">Sem conteúdo cadastrado.</span>'}</div><div class="row"><button onclick="svEditCase('${c.id}')">Editar conteúdo</button>${open?'<span class="badge warn">Em evento</span>':''}<button class="danger" onclick="svDeleteCase('${c.id}')">Excluir</button></div></div>`}).join('')}</div>`;}
  function renderGroups(){const cp=document.getElementById('casesPanel');if(!cp)return;cp.innerHTML=`<div class="section-head"><div><h3>Grupos de inventário</h3><div class="muted">Organização editável dos itens.</div></div><button class="primary" onclick="svNewGroup()">+ Novo grupo</button></div><div class="grid">${db.inventoryGroups.filter(g=>g.active!==false).map(g=>{const count=db.inventoryItems.filter(i=>i.groupId===g.id&&i.active!==false).length;return `<div class="card"><div class="between"><h3>${esc(g.name)}</h3><span class="badge">${count} item(ns)</span></div><button onclick="svEditGroup('${g.id}')">Editar nome</button></div>`}).join('')}</div>`;}

  function svNewGroup(){openModal('Novo grupo',`<label>Nome do grupo</label><input id="svGroupName" placeholder="Ex.: Cabos"><button class="primary" onclick="svCreateGroup()">Criar grupo</button>`);}
  function svCreateGroup(){const name=document.getElementById('svGroupName').value.trim();if(!name)return alert('Informe o nome.');db.inventoryGroups.push({id:uid('GRP'),name,active:true});saveInventory();closeModal();render();}
  function svEditGroup(id){const g=invGroup(id);if(!g)return;openModal('Editar grupo',`<label>Nome</label><input id="svGroupName" value="${attr(g.name)}"><button class="primary" onclick="svSaveGroup('${id}')">Salvar</button>`);}
  function svSaveGroup(id){const g=invGroup(id),n=document.getElementById('svGroupName').value.trim();if(!g||!n)return;g.name=n;saveInventory();closeModal();render();}

  function svNewInventoryItem(){openModal('Novo item do inventário',`<label>Nome do item</label><input id="svInvName" placeholder="Ex.: Cabo XLR 5 metros"><label>Grupo</label><select id="svInvGroup">${db.inventoryGroups.filter(g=>g.active!==false).map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><label>Tipo de controle</label><select id="svInvControl"><option value="quantidade">Quantidade</option><option value="patrimonio">Patrimônio</option></select><label>Unidade</label><input id="svInvUnit" value="un"><label>Quantidade total</label><input id="svInvQty" type="number" min="0" value="0"><button class="primary" onclick="svCreateInventoryItem()">Cadastrar item</button>`);}
  function svCreateInventoryItem(){const name=document.getElementById('svInvName').value.trim();if(!name)return alert('Informe o item.');db.inventoryItems.push({id:uid('INV'),name,groupId:document.getElementById('svInvGroup').value,control:document.getElementById('svInvControl').value,unit:document.getElementById('svInvUnit').value.trim()||'un',totalQty:Number(document.getElementById('svInvQty').value||0),active:true});saveInventory();closeModal();render();}
  function svEditInventoryItem(id){const i=invItem(id);if(!i)return;const used=allocatedQty(id);openModal('Editar item',`<label>Nome</label><input id="svInvName" value="${attr(i.name)}"><label>Grupo</label><select id="svInvGroup">${db.inventoryGroups.filter(g=>g.active!==false).map(g=>`<option value="${g.id}" ${g.id===i.groupId?'selected':''}>${esc(g.name)}</option>`).join('')}</select><label>Controle</label><select id="svInvControl"><option value="quantidade" ${i.control==='quantidade'?'selected':''}>Quantidade</option><option value="patrimonio" ${i.control==='patrimonio'?'selected':''}>Patrimônio</option></select><label>Unidade</label><input id="svInvUnit" value="${attr(i.unit)}"><label>Total ${used?'(já existem '+used+' em eventos abertos)':''}</label><input id="svInvQty" type="number" min="${used}" value="${i.totalQty}"><button class="primary" onclick="svSaveInventoryItem('${id}')">Salvar</button>`);}
  function svSaveInventoryItem(id){const i=invItem(id);if(!i)return;const qty=Number(document.getElementById('svInvQty').value||0),used=allocatedQty(id);if(qty<used)return alert(`Não pode ficar abaixo de ${used}. Essa quantidade já está comprometida em eventos.`);i.name=document.getElementById('svInvName').value.trim();i.groupId=document.getElementById('svInvGroup').value;i.control=document.getElementById('svInvControl').value;i.unit=document.getElementById('svInvUnit').value.trim()||'un';i.totalQty=qty;saveInventory();closeModal();render();}

  function svDeleteInventoryItem(id){
    const i=invItem(id); if(!i)return;
    const used=allocatedQty(id);
    if(used>0)return alert(`Não é possível excluir "${i.name}" porque ${used} ${i.unit} já está comprometido em evento(s) aberto(s). Retorne os equipamentos antes de retirar o item do inventário.`);
    const caseRefs=(db.cases||[]).filter(c=>c.active!==false&&(c.items||[]).some(it=>it.inventoryItemId===id)).length;
    const extra=caseRefs?`\n\nO item está presente em ${caseRefs} case(s). Ele será retirado do inventário, mas o histórico/conteúdo dos cases será preservado.`:'';
    if(!confirm(`Retirar "${i.name}" do inventário?${extra}\n\nO item não será apagado fisicamente do banco; ficará inativo para preservar o histórico.`))return;
    i.active=false;
    saveInventory();closeModal();render();
  }

  function svCaseItemRow(item){const id='svrow-'+Date.now()+'-'+Math.random();return `<div class="content-row" id="${id}"><select class="sv-case-item"><option value="">Selecione o item</option>${db.inventoryItems.filter(i=>i.active!==false).map(i=>`<option value="${i.id}" ${i.id===item?.inventoryItemId?'selected':''}>${esc(invGroup(i.groupId)?.name||'')} — ${esc(i.name)}</option>`).join('')}</select><input class="sv-case-qty" type="number" min="0" value="${item?.qty||0}"><input class="sv-case-unit" value="${attr(item?.unit||'un')}"><button class="danger small" onclick="document.getElementById('${id}').remove()">×</button></div>`;}
  function svNewCase(){openModal('Novo case',`<label>Nome do case</label><input id="svCaseName" placeholder="Ex.: Case 02 - XLR Som"><h3 style="margin-top:18px">Conteúdo do case</h3><div id="svCaseRows"></div><button onclick="svAddCaseRow()">+ Adicionar item</button><div style="margin-top:18px"><button class="primary" onclick="svCreateCase()">Criar case</button></div>`);svAddCaseRow();}
  function svAddCaseRow(item=null){document.getElementById('svCaseRows')?.insertAdjacentHTML('beforeend',svCaseItemRow(item));}
  function collectCaseRows(){return [...document.querySelectorAll('#svCaseRows .content-row')].map(r=>({inventoryItemId:r.querySelector('.sv-case-item').value,qty:Number(r.querySelector('.sv-case-qty').value||0),unit:r.querySelector('.sv-case-unit').value.trim()||'un'})).filter(x=>x.inventoryItemId&&x.qty>0).map(x=>({...x,name:invItem(x.inventoryItemId)?.name||''}));}
  function svCreateCase(){const name=document.getElementById('svCaseName').value.trim();if(!name)return alert('Informe o nome do case.');const rows=collectCaseRows(),next=Math.max(0,...db.cases.map(c=>Number(String(c.id).replace('SV-C',''))||0))+1;db.cases.push({id:'SV-C'+String(next).padStart(3,'0'),name,description:true,items:rows,status:'Disponível',maintenanceIds:[],active:true});saveInventory();closeModal();render();}
  function svEditCase(id){const c=db.cases.find(x=>x.id===id);if(!c)return;openModal('Editar case — '+c.name,`<label>Nome</label><input id="svCaseName" value="${attr(c.name)}"><h3 style="margin-top:18px">Conteúdo</h3><div id="svCaseRows"></div><button onclick="svAddCaseRow()">+ Adicionar item</button><div class="row" style="margin-top:18px"><button class="primary" onclick="svSaveCase('${id}')">Salvar</button></div>`);(c.items||[]).forEach(it=>svAddCaseRow(it));}
  function svSaveCase(id){const c=db.cases.find(x=>x.id===id);if(!c)return;if(caseHasOpenMovement(id))return alert('Este case está em um evento aberto. Retorne o case antes de alterar seu conteúdo.');c.name=document.getElementById('svCaseName').value.trim();c.items=collectCaseRows();saveInventory();closeModal();render();}

  function svDeleteCase(id){
    const c=db.cases.find(x=>x.id===id); if(!c)return;
    if(caseHasOpenMovement(id))return alert(`Não é possível excluir "${c.name}" porque ele está em um evento aberto. Retorne o case antes de retirá-lo do inventário.`);
    const hasEquipment=(db.equipment||[]).some(e=>e.caseId===id);
    const hasHistory=(db.movements||[]).some(m=>(m.cases||[]).some(ec=>ec.caseId===id));
    if(!confirm(`Retirar o case "${c.name}" (${c.id}) do inventário?\n\n${hasEquipment?'Este case possui patrimônios vinculados. ':''}${hasHistory?'O histórico de eventos será preservado. ':''}\nO case ficará inativo para preservar o histórico e não poderá ser usado em novos eventos.`))return;
    c.active=false;
    c.status='Indisponível';
    saveInventory();closeModal();render();
  }

  window.toggleEventCase=function(movementId,caseId,checked){
    const m=db.movements.find(x=>x.id===movementId),c=db.cases.find(x=>x.id===caseId);if(!m||!c)return;
    if(checked){
      if(m.cases.some(x=>x.caseId===caseId))return;
      const av=caseAvailability(caseId,movementId);if(!av.ok){alert('Não é possível adicionar este case.\n\n'+av.reason);openMovement(movementId);return;}
      const eventItems=(c.items||[]).map(i=>({inventoryItemId:i.inventoryItemId,name:safeItemName(i.name||invItem(i.inventoryItemId)?.name),qty:Number(i.qty||0),unit:i.unit||invItem(i.inventoryItemId)?.unit||'un',originalQty:Number(i.qty||0)}));
      const equipmentIds=(db.equipment||[]).filter(e=>e.caseId===caseId).map(e=>e.pat);
      m.cases.push({caseId,items:eventItems,checked:false,returned:false,divergences:[],equipmentIds});c.status='Reservado';saveInventory();openCaseEventDescription(movementId,caseId);
    }else{m.cases=m.cases.filter(x=>x.caseId!==caseId);updateCaseStatus(caseId);saveInventory();openMovement(movementId);}
  };

  const oldOpenMovement=window.openMovement;
  window.openMovement=function(id){
    oldOpenMovement(id);const m=db.movements.find(x=>x.id===id);if(!m||m.status!=='Aberto')return;
    document.querySelectorAll('#modalBody .check-item').forEach(label=>{const cb=label.querySelector('input[type=checkbox]');if(!cb)return;const onclick=cb.getAttribute('onchange')||'',match=onclick.match(/'([^']+)'\s*,\s*'([^']+)'/);if(!match)return;const caseId=match[2],av=caseAvailability(caseId,id);if(!cb.checked&&!av.ok){cb.disabled=true;label.style.opacity='.45';label.title=av.reason;label.insertAdjacentHTML('beforeend',`<span class="muted" style="margin-left:8px">— ${esc(av.reason)}</span>`);}});
  };

  window.svInventoryTab=tabs;
  window.svNewGroup=svNewGroup;window.svCreateGroup=svCreateGroup;window.svEditGroup=svEditGroup;window.svSaveGroup=svSaveGroup;
  window.svNewInventoryItem=svNewInventoryItem;window.svCreateInventoryItem=svCreateInventoryItem;window.svEditInventoryItem=svEditInventoryItem;window.svSaveInventoryItem=svSaveInventoryItem;window.svDeleteInventoryItem=svDeleteInventoryItem;
  window.svNewCase=svNewCase;window.svAddCaseRow=svAddCaseRow;window.svCreateCase=svCreateCase;window.svEditCase=svEditCase;window.svSaveCase=svSaveCase;window.svDeleteCase=svDeleteCase;
  window.svRenderItemTable=svRenderItemTable;window.svRenderCaseTable=svRenderCaseTable;
  window.renderInventory=renderInventoryV2;
  ensureModel();saveInventory();if(typeof render==='function'&&currentUser)render();
})();
