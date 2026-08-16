/* Star Vision — Inventário: navegação limpa por grupos */
(function(){
  function groupForCase(c){
    if(c.caseGroupId) return c.caseGroupId;
    const n=String(c.name||'').toLowerCase();
    const text=(c.items||[]).map(it=>String(it.name||'')).join(' ').toLowerCase();
    const s=n+' '+text;
    let id='G-ACC';
    if(/m32|midas|01v96|mesa|console|xlr|microfone|audio|som|sub|line array|cabo/.test(s)) id='G-SOM';
    else if(/beam|grand ma|moving|par led|luz|ilum/.test(s)) id='G-LUZ';
    else if(/painel|led|rj|powercon/.test(s)) id='G-LED';
    else if(/estrutura|box|treliça|truss|praticável|pórtico/.test(s)) id='G-EST';
    else if(/gerador/.test(s)) id='G-GER';
    c.caseGroupId=id;
    return id;
  }

  function groups(){return (db.inventoryGroups||[]).filter(g=>g.active!==false);}
  function group(id){return groups().find(g=>g.id===id);}
  function showItemsGroup(id){
    const ep=document.getElementById('equipmentPanel'),cp=document.getElementById('casesPanel');
    if(!ep||!cp)return;
    cp.classList.add('hidden'); ep.classList.remove('hidden');
    const g=group(id); if(!g)return;
    ep.innerHTML=`<div class="section-head"><div><button onclick="svInventoryTab('items')">VOLTAR</button><h3 style="margin-top:12px">${esc(g.name)}</h3><div class="muted">Itens cadastrados neste grupo.</div></div><button class="primary" onclick="svNewInventoryItem()">+ Novo item</button></div><input class="search" id="svInvSearch" placeholder="Pesquisar item..." oninput="svRenderItemTableGroup('${attr(id)}')"><div id="svItemTable"></div>`;
    svRenderItemTableGroup(id);
  }
  window.svRenderItemTableGroup=function(id){
    const target=document.getElementById('svItemTable');if(!target)return;
    const q=(document.getElementById('svInvSearch')?.value||'').toLowerCase();
    const list=(db.inventoryItems||[]).filter(i=>i.active!==false&&i.groupId===id&&String(i.name||'').toLowerCase().includes(q));
    if(!list.length){target.innerHTML='<div class="empty">Nenhum item cadastrado neste grupo.</div>';return;}
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Controle</th><th>Total</th><th>Em uso</th><th>Disponível</th><th></th></tr></thead><tbody>${list.map(i=>{const used=typeof allocatedQty==='function'?allocatedQty(i.id):0,available=Math.max(0,Number(i.totalQty||0)-used);return `<tr><td><b>${esc(i.name)}</b></td><td>${i.control==='patrimonio'?'Patrimônio':'Quantidade'}</td><td>${i.totalQty} ${esc(i.unit)}</td><td>${used} ${esc(i.unit)}</td><td class="${available>0?'ok':'bad'}">${available} ${esc(i.unit)}</td><td><button class="small" onclick="svEditInventoryItem('${i.id}')">Editar</button> <button class="small danger" onclick="svDeleteInventoryItem('${i.id}')">Excluir</button></td></tr>`}).join('')}</tbody></table></div>`;
  };

  function renderItemHome(){
    const ep=document.getElementById('equipmentPanel');if(!ep)return;
    ep.innerHTML=`<div class="section-head"><div><h3>Itens do inventário</h3><div class="muted">Visão geral de todos os itens cadastrados.</div></div><button class="primary" onclick="svNewInventoryItem()">+ Novo item</button></div><input class="search" id="svInvSearch" placeholder="Pesquisar item..." oninput="svRenderItemGeneral()"><div id="svItemTable"></div>`;
    svRenderItemGeneral();
  }
  window.svRenderItemGeneral=function(){
    const t=document.getElementById('svItemTable');if(!t)return;const q=(document.getElementById('svInvSearch')?.value||'').toLowerCase();
    const list=(db.inventoryItems||[]).filter(i=>i.active!==false&&(String(i.name||'').toLowerCase().includes(q)||(group(i.groupId)?.name||'').toLowerCase().includes(q)));
    if(!list.length){t.innerHTML='<div class="empty">Nenhum item cadastrado.</div>';return;}
    t.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Grupo</th><th>Controle</th><th>Total</th><th>Em uso</th><th>Disponível</th><th></th></tr></thead><tbody>${list.map(i=>{const used=typeof allocatedQty==='function'?allocatedQty(i.id):0,available=Math.max(0,Number(i.totalQty||0)-used);return `<tr><td><b>${esc(i.name)}</b></td><td>${esc(group(i.groupId)?.name||'—')}</td><td>${i.control==='patrimonio'?'Patrimônio':'Quantidade'}</td><td>${i.totalQty} ${esc(i.unit)}</td><td>${used} ${esc(i.unit)}</td><td class="${available>0?'ok':'bad'}">${available} ${esc(i.unit)}</td><td><button class="small" onclick="svEditInventoryItem('${i.id}')">Editar</button> <button class="small danger" onclick="svDeleteInventoryItem('${i.id}')">Excluir</button></td></tr>`}).join('')}</tbody></table></div>`;
  };

  function renderCaseGroups(){
    const cp=document.getElementById('casesPanel');if(!cp)return;
    groups().forEach(g=>(db.cases||[]).forEach(c=>{if(c.active!==false)groupForCase(c)}));
    cp.innerHTML=`<div class="section-head"><div><h3>Cases</h3><div class="muted">Escolha um grupo para visualizar seus cases.</div></div><button class="primary" onclick="svNewCase()">+ Novo case</button></div><div class="grid">${groups().map(g=>{const count=(db.cases||[]).filter(c=>c.active!==false&&c.caseGroupId===g.id).length;return `<div class="card" style="cursor:pointer" onclick="svOpenCaseGroup('${attr(g.id)}')"><div class="between"><h3>${esc(g.name)}</h3><span class="badge">${count} case(s)</span></div><div class="muted">Clique para abrir</div></div>`}).join('')}</div>`;
  }
  window.svOpenCaseGroup=function(id){
    const cp=document.getElementById('casesPanel');if(!cp)return;const g=group(id);
    cp.innerHTML=`<div class="section-head"><div><button onclick="svInventoryTab('cases')">VOLTAR</button><h3 style="margin-top:12px">${esc(g?.name||'Cases')}</h3><div class="muted">Cases deste grupo.</div></div><button class="primary" onclick="svNewCase()">+ Novo case</button></div><input class="search" id="svCaseSearch" placeholder="Pesquisar case..." oninput="svRenderCaseGroup('${attr(id)}')"><div id="svCaseTable"></div>`;
    svRenderCaseGroup(id);
  };
  window.svRenderCaseGroup=function(id){
    const t=document.getElementById('svCaseTable');if(!t)return;const q=(document.getElementById('svCaseSearch')?.value||'').toLowerCase();
    const list=(db.cases||[]).filter(c=>c.active!==false&&c.caseGroupId===id&&(String(c.name||'').toLowerCase().includes(q)||String(c.id||'').toLowerCase().includes(q)));
    t.innerHTML=`<div class="grid">${list.map(c=>{const pending=typeof pendingMaintenanceForCase==='function'?pendingMaintenanceForCase(c.id):[],open=typeof caseHasOpenMovement==='function'?caseHasOpenMovement(c.id):false;return `<div class="card"><div class="between"><div><h3>${esc(c.name)}</h3><div class="muted">${esc(c.id)}</div></div><span class="status-pill ${c.status==='Disponível'?'status-ok':'status-out'}">${esc(c.status)}</span></div>${pending.length?'<div class="maintenance-alert">⚠️ Manutenção pendente</div>':''}<div style="margin:12px 0">${(c.items||[]).map(it=>{const inv=(db.inventoryItems||[]).find(i=>i.id===it.inventoryItemId);return `<span class="badge">${esc(inv?.name||safeItemName(it.name))} × ${it.qty||0} ${esc(it.unit||inv?.unit||'un')}</span>`}).join('')||'<span class="muted">Sem conteúdo cadastrado.</span>'}</div><div class="row"><button onclick="svEditCase('${c.id}')">Editar conteúdo</button>${open?'<span class="badge warn">Em evento</span>':''}<button class="danger" onclick="svDeleteCase('${c.id}')">Excluir</button></div></div>`}).join('')||'<div class="empty">Nenhum case neste grupo.</div>'}</div>`;
  };

  function renderGroupHome(){
    const cp=document.getElementById('casesPanel');if(!cp)return;
    cp.innerHTML=`<div class="section-head"><div><h3>Grupos de inventário</h3><div class="muted">Clique em um grupo para visualizar os itens cadastrados nele.</div></div><button class="primary" onclick="svNewGroup()">+ Novo grupo</button></div><div class="grid">${groups().map(g=>{const count=(db.inventoryItems||[]).filter(i=>i.groupId===g.id&&i.active!==false).length;return `<div class="card" style="cursor:pointer" onclick="svOpenItemGroup('${attr(g.id)}')"><div class="between"><h3>${esc(g.name)}</h3><span class="badge">${count} item(ns)</span></div><div class="muted">Clique para abrir</div><div class="row" style="margin-top:10px"><button onclick="event.stopPropagation();svEditGroup('${attr(g.id)}')">Editar nome</button></div></div>`}).join('')}</div>`;
  }
  window.svOpenItemGroup=showItemsGroup;

  window.svInventoryTab=function(tab){
    const ep=document.getElementById('equipmentPanel'),cp=document.getElementById('casesPanel');if(!ep||!cp)return;
    ep.classList.add('hidden');cp.classList.add('hidden');
    document.querySelectorAll('#inventory .tab').forEach(b=>b.classList.toggle('active',b.dataset.invtab===tab));
    if(tab==='items'){ep.classList.remove('hidden');renderItemHome();}
    else {cp.classList.remove('hidden'); if(tab==='cases')renderCaseGroups(); else renderGroupHome();}
  };
  window.svInventoryApplyGroups=function(){
    (db.cases||[]).forEach(c=>{if(c.active!==false)groupForCase(c)});
  };
  if(typeof window.render==='function'){
    const oldRender=window.render;window.render=function(){oldRender();svInventoryApplyGroups();};
  }
  svInventoryApplyGroups();
})();
