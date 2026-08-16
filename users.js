/* Star Vision — Usuários e perfis simples: Administrador / Colaborador */
(function(){
  const ADMIN='Administrador';
  const COLLAB='Colaborador';

  function normalizeUsers(){
    if(!window.db) return;
    db.users ||= [];
    if(!db.users.length){
      db.users.push({user:'admin',pass:'1234',name:'Administrador',role:ADMIN,active:true});
    }
    db.users.forEach(u=>{
      u.active=u.active!==false;
      if(u.role==='Admin' || u.role==='Administrador' || u.role==='admin') u.role=ADMIN;
      else u.role=COLLAB;
    });
  }

  function ensureView(){
    if(document.getElementById('users')) return;
    const main=document.querySelector('main');
    if(!main) return;
    main.insertAdjacentHTML('beforeend',`
      <section id="users" class="view">
        <div class="section-head">
          <div><h1>Usuários</h1><div class="muted">Acessos ao Star Vision.</div></div>
          <button class="primary" onclick="svNewUser()">+ Novo usuário</button>
        </div>
        <div id="usersList"></div>
      </section>`);
  }

  function renderUsers(){
    normalizeUsers(); ensureView();
    const target=document.getElementById('usersList'); if(!target)return;
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>${db.users.map(u=>`
      <tr>
        <td>${esc(u.name||u.user)}</td>
        <td>${esc(u.user)}</td>
        <td class="${u.role===ADMIN?'ok':'blue'}">${u.role===ADMIN?'Admin':'Colaborador'}</td>
        <td class="${u.active!==false?'ok':'bad'}">${u.active!==false?'Ativo':'Inativo'}</td>
        <td><div class="row">
          <button class="small" onclick="svEditUser('${attr(u.user)}')">Editar</button>
          ${u.user!==currentUser?.user?`<button class="small danger" onclick="svDeleteUser('${attr(u.user)}')">${u.active!==false?'Desativar':'Excluir'}</button>`:''}
        </div></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function userForm(user){
    const editing=!!user;
    return `<label>Nome</label><input id="svUserName" value="${attr(user?.name||'')}">
      <label>Usuário / login</label><input id="svUserLogin" value="${attr(user?.user||'')}" ${editing?'disabled':''}>
      <label>Senha ${editing?'(deixe em branco para manter)':''}</label><input id="svUserPass" type="password" autocomplete="new-password">
      <label>Tipo de usuário</label><select id="svUserRole"><option value="${ADMIN}" ${user?.role===ADMIN?'selected':''}>Admin — acesso total</option><option value="${COLLAB}" ${user?.role!==ADMIN?'selected':''}>Colaborador — operação sem exclusões/inventário estrutural</option></select>
      <label class="check-item" style="margin-top:8px"><input id="svUserActive" type="checkbox" ${user?.active!==false?'checked':''}><span>Usuário ativo</span></label>
      <div class="row" style="margin-top:15px"><button class="primary" onclick="svSaveUser(${editing?`'${attr(user.user)}'`:'null'})">Salvar</button></div>`;
  }

  window.svNewUser=function(){
    if(!isAdmin()) return alert('Apenas administradores podem gerenciar usuários.');
    openModal('Novo usuário',userForm(null));
  };
  window.svEditUser=function(login){
    if(!isAdmin()) return alert('Apenas administradores podem gerenciar usuários.');
    const u=db.users.find(x=>x.user===login); if(!u)return;
    openModal('Editar usuário',userForm(u));
  };
  window.svSaveUser=async function(oldLogin){
    if(!isAdmin()) return alert('Apenas administradores podem gerenciar usuários.');
    normalizeUsers();
    const name=document.getElementById('svUserName').value.trim();
    const login=document.getElementById('svUserLogin').value.trim();
    const pass=document.getElementById('svUserPass').value;
    const role=document.getElementById('svUserRole').value===ADMIN?ADMIN:COLLAB;
    const active=document.getElementById('svUserActive').checked;
    if(!name||!login)return alert('Informe nome e usuário.');
    let u=oldLogin?db.users.find(x=>x.user===oldLogin):null;
    if(!u){
      if(db.users.some(x=>x.user.toLowerCase()===login.toLowerCase()))return alert('Este usuário já existe.');
      if(!pass)return alert('Informe uma senha para o novo usuário.');
      u={user:login,pass,name,role,active}; db.users.push(u);
    }else{
      if(pass)u.pass=pass;
      u.name=name;u.role=role;u.active=active;
      if(u.user===currentUser.user) currentUser=u;
    }
    saveDB();closeModal();renderUsers();render();
  };
  window.svDeleteUser=async function(login){
    if(!isAdmin()) return alert('Apenas administradores podem gerenciar usuários.');
    const u=db.users.find(x=>x.user===login); if(!u)return;
    if(u.user===currentUser?.user)return alert('Você não pode desativar seu próprio usuário.');
    const action=u.active!==false?'desativar':'excluir';
    if(!confirm(`${action==='desativar'?'Desativar':'Excluir'} o usuário "${u.name}"?\n\nO histórico do sistema será preservado.`))return;
    if(action==='desativar')u.active=false;
    else db.users=db.users.filter(x=>x.user!==login);
    saveDB();renderUsers();
  };

  const oldBuildNav=window.buildNav;
  window.buildNav=function(){
    normalizeUsers(); ensureView();
    if(typeof oldBuildNav==='function') oldBuildNav();
    const nav=document.getElementById('nav');
    if(nav && isAdmin() && !nav.querySelector('[data-view="users"]')){
      const b=document.createElement('button'); b.className='nav-btn'; b.dataset.view='users'; b.textContent='Usuários'; b.onclick=()=>show('users'); nav.appendChild(b);
    }
  };

  const oldShow=window.show;
  window.show=function(view){
    if(view==='users' && !isAdmin()) return oldShow('home');
    oldShow(view);
    if(view==='users') renderUsers();
  };

  normalizeUsers(); ensureView();
  if(typeof window.render==='function'){
    const oldRender=window.render;
    window.render=function(){ oldRender(); if(currentUser?.role===ADMIN && document.getElementById('users')?.classList.contains('active')) renderUsers(); };
  }
})();
