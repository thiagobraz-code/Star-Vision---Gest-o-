/* Star Vision - Inventário UI 3.0
   Navegação por grupos de itens e grupos de cases.
*/
(function(){
  const CASE_GROUPS=[
    ['CG-SOM','Som'],['CG-LUZ','Iluminação'],['CG-LED','Painel de LED'],
    ['CG-EST','Estrutura'],['CG-GER','Geradores'],['CG-ACC','Acessórios']
  ];

  function ensureCaseGroups(){
    db.caseGroups ||= [];
    CASE_GROUPS.forEach(([id,name])=>{
      if(!db.caseGroups.some(g=>g.id===id)) db.caseGroups.push({id,name,active:true});
    });
    const guess=(name)=>{
      const n=String(name||'').toLowerCase();
      if(/m32|midas|01v96|ada|mesa|console|xlr|microfone|audio|som|sub|cabo/.test(n)) return 'CG-SOM';
      if(/beam|grand ma|moving|par led|luz|ilum/.test(n)) return 'CG-LUZ';
      if(/painel|led|rj|powercon/.test(n)) return 'CG-LED';
      if(/estrutura|box|treliça|truss|praticável|pórtico/.test(n)) return 'CG-EST';
      if(/gerador/.test(n)) return 'CG-GER';
      return 'CG-ACC';
    };
    db.cases.forEach(c=>{ c.caseGroupId ||= guess(c.name); });
  }
  function cg(id){return db.caseGroups.find(g=>g.id===id);}
  function ig(id){return db.inventoryGroups.find(g=>g.id===id);}
  function itemsInGroup(id){return db.inventoryItems.filter(i=>i.active!==false&&i.groupId===id);}
  function casesInGroup(id){return db.cases.filter(c=>c.active!==false&&c.caseGroupId===id);}
  function saveUI(){localStorage.setItem('starVisionDB',JSON.stringify(db)); if(typeof saveDB==='function') saveDB();}

  function renderGroupCards(){
    const ep=document.getElementById('equipmentPanel');
    if(!ep)return;
    const groups=db.inventoryGroups.filter(g=>g.active!==false);
    ep.innerHTML=`<div class="section-head"><div><h3>Grupos de itens</h3><div class="muted">Clique em um grupo para visualizar somente os itens cadastrados nele.</div></div>${isAdmin()?`<button class="primary" onclick="svNewGroup()">+ Novo grupo</button>`:''}</div><div class="grid">${groups.map(g=>{const count=itemsInGroup(g.id).length;return `<div class="card" style="cursor:pointer" onclick="svOpenItemGroup('${g.id}')"><div class="between"><div><h3>${esc(g.name)}</h3><div class="muted">${count} item(ns)</div></div><span class="badge">Abrir ›</span></div></div>`}).join('')}</div>`;
  }
  window.svOpenItemGroup=function(id){
    const g=ig(id); if(!g)return;
    const ep=document.getElementById('equipmentPanel');
    const list=itemsInGroup(id);
    ep.innerHTML=`<div class="section-head"><div><button onclick="svInventoryTab('items')">← Grupos</button><h3 style="margin-top:10px">${esc(g.name)}</h3><div class="muted">Itens cadastrados neste grupo.</div></div>${isAdmin()?`<button class="primary" onclick="svNewInventoryItem()">+ Novo item</button>`:''}</div><input class="search" id="svInvSearch" placeholder="Pesquisar neste grupo..." oninput="svRenderGroupItems('${id}')"><div id="svGroupItems"></div>`;
    window.svRenderGroupItems(id);
  };
  window.svRenderGroupItems=function(id){
    const t=document.getElementById('svGroupItems'); if(!t)return;
    const q=(document.getElementById('svInvSearch')?.value||'').toLowerCase();
    const list=itemsInGroup(id).filter(i=>i.name.toLowerCase().includes(q));
    if(!list.length){t.innerHTML='<div class="empty">Nenhum item cadastrado neste grupo.</div>';return;}
    t.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Controle</th><th>Total</th><th>Em uso</th><th>Disponível</th>${isAdmin()?'<th></th>':''}</tr></thead><tbody>${list.map(i=>{const used=typeof allocatedQty==='function'?allocatedQty(i.id):0;const av=Math.max(0,Number(i.totalQty||0)-used);return `<tr><td><b>${esc(i.name)}</b></td><td>${i.control==='patrimonio'?'Patrimônio':'Quantidade'}</td><td>${i.totalQty} ${esc(i.unit)}</td><td>${used} ${esc(i.unit)}</td><td class="${av>0?'ok':'bad'}">${av} ${esc(i.unit)}</td>${isAdmin()?`<td><button class="small" onclick="svEditInventoryItem('${i.id}')">Editar</button> <button class="small danger" onclick="svDeleteInventoryItem('${i.id}')">Excluir</button></td>`:''}</tr>`}).join('')}</tbody></table></div>`;
  };

  function renderCaseGroups(){
    ensureCaseGroups();
    const cp=document.getElementById('casesPanel'); if(!cp)return;
    const groups=db.caseGroups.filter(g=>g.active!==false);
    cp.innerHTML=`<div class="section-head"><div><h3>Grupos de cases</h3><div class="muted">Clique em um grupo para visualizar somente os cases daquela categoria.</div></div>${isAdmin()?`<button class="primary" onclick="svNewCaseGroup()">+ Novo grupo</button>`:''}</div><div class="grid">${groups.map(g=>{const count=casesInGroup(g.id).length;return `<div class="card" style="cursor:pointer" onclick="svOpenCaseGroup('${g.id}')"><div class="between"><div><h3>${esc(g.name)}</h3><div class="muted">${count} case(s)</div></div><span class="badge">Abrir ›</span></div></div>`}).join('')}</div>`;
  }
  window.svOpenCaseGroup=function(id){
    ensureCaseGroups();const g=cg(id);if(!g)return;const cp=document.getElementById('casesPanel');
    cp.innerHTML=`<div class="section-head"><div><button onclick="svInventoryTab('cases')">← Grupos</button><h3 style="margin-top:10px">${esc(g.name)}</h3><div class="muted">Cases cadastrados neste grupo.</div></div>${isAdmin()?`<button class="primary" onclick="svNewCase()">+ Novo case</button>`:''}</div><input class="search" id="svCaseSearch" placeholder="Pesquisar neste grupo..." oninput="svRenderCaseGroup('${id}')"><div id="svCaseGroupList"></div>`;
    window.svRenderCaseGroup(id);
  };
  window.svRenderCaseGroup=function(id){
    const t=document.getElementById('svCaseGroupList');if(!t)return;const q=(document.getElementById('svCaseSearch')?.value||'').toLowerCase();const list=casesInGroup(id).filter(c=>c.name.toLowerCase().includes(q)||c.id.toLowerCase().includes(q));
    if(!list.length){t.innerHTML='<div class="empty">Nenhum case cadastrado neste grupo.</div>';return;}
    t.innerHTML=`<div class="grid">${list.map(c=>{const pending=pendingMaintenanceForCase(c.id),open=caseHasOpenMovement(c.id);return `<div class="card"><div class="between"><div><h3>${esc(c.name)}</h3><div class="muted">${esc(c.id)}</div></div><span class="status-pill ${c.status==='Disponível'?'status-ok':'status-out'}">${esc(c.status)}</span></div>${pending.length?'<div class="maintenance-alert">⚠️ Manutenção pendente</div>':''}<div style="margin:12px 0">${(c.items||[]).map(it=>{const inv=db.inventoryItems.find(i=>i.id===it.inventoryItemId);return `<span class="badge">${esc(inv?.name||safeItemName(it.name))} × ${it.qty||0} ${esc(it.unit||inv?.unit||'un')}</span>`}).join('')||'<span class="muted">Sem conteúdo cadastrado.</span>'}</div><div class="row">${isAdmin()?`<button onclick="svEditCase('${c.id}')">Editar conteúdo</button>`:''}${open?'<span class="badge warn">Em evento</span>':''}${isAdmin()?`<button class="danger" onclick="svDeleteCase('${c.id}')">Excluir</button>`:''}</div></div>`}).join('')}</div>`;
  };

  const oldNewCase=window.svNewCase;
  window.svNewCase=function(){
    ensureCaseGroups();
    if(!isAdmin())return alert('Apenas administradores podem cadastrar cases.');
    const old=oldNewCase;
    if(typeof old!=='function')return;
    old();
    setTimeout(()=>{
      const body=document.getElementById('modalBody'); if(!body)return;
      const anchor=body.querySelector('#svCaseName'); if(!anchor)return;
      const wrap=anchor.parentElement;
      const label=document.createElement('label');label.textContent='Grupo do case';
      const select=document.createElement('select');select.id='svCaseGroup';select.innerHTML=db.caseGroups.filter(g=>g.active!==false).map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
      wrap.insertBefore(label,anchor);wrap.insertBefore(select,anchor);
      const save=window.svCreateCase;
      window.svCreateCase=function(){
        const before=db.cases.length;save();
        if(db.cases.length>before){db.cases[db.cases.length-1].caseGroupId=document.getElementById('svCaseGroup')?.value||'CG-ACC';saveUI();render();}
        window.svCreateCase=save;
      };
    },0);
  };

  const oldRenderInventory=window.renderInventory;
  window.renderInventory=function(){
    ensureCaseGroups();
    const t=document.querySelector('#inventory .tabs');
    if(t)t.innerHTML=`<button class="tab" data-invtab="items" onclick="svInventoryTab('items')">Itens</button><button class="tab" data-invtab="cases" onclick="svInventoryTab('cases')">Cases</button><button class="tab" data-invtab="groups" onclick="svInventoryTab('groups')">Grupos</button>`;
    svInventoryTab('groups');
  };
  window.svInventoryTab=function(tab){
    const ep=document.getElementById('equipmentPanel'),cp=document.getElementById('casesPanel');if(!ep||!cp)return;
    ep.classList.add('hidden');cp.classList.add('hidden');
    document.querySelectorAll('#inventory .tab').forEach(b=>b.classList.toggle('active',b.dataset.invtab===tab));
    if(tab==='items'){ep.classList.remove('hidden');renderGroupCards();}
    if(tab==='cases'){cp.classList.remove('hidden');renderCaseGroups();}
    if(tab==='groups'){ep.classList.remove('hidden');renderGroupCards();}
  };
  ensureCaseGroups();
  if(typeof render==='function'&&currentUser)render();
})();
