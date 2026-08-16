(function(){
  const LOGO='/star-vision-logo.svg?v=1';
  function install(){
    if(document.getElementById('sv-brand-style'))return;
    const style=document.createElement('style');
    style.id='sv-brand-style';
    style.textContent=`
      .sv-official-logo{display:block;width:min(360px,78vw);height:auto;object-fit:contain}
      .brand .sv-official-logo{width:220px;max-width:52vw}
      .sv-brand-sub{display:block;color:var(--muted,#a1a1aa);font-size:9px;letter-spacing:2.5px;margin-top:3px}
      .sv-login-brand{display:flex;justify-content:center;margin:0 auto 20px;padding:4px 0}
      .sv-login-brand .sv-official-logo{width:min(360px,82vw)}
      @media(max-width:760px){.brand .sv-official-logo{width:190px;max-width:58vw}.sv-brand-sub{font-size:8px;letter-spacing:2px}}
    `;
    document.head.appendChild(style);
    document.title='Star Vision Gestão';
  }
  function brandHeader(){
    document.querySelectorAll('.brand').forEach(el=>{
      if(el.dataset.svBrand==='1')return;
      el.dataset.svBrand='1';
      el.innerHTML='<img class="sv-official-logo" src="'+LOGO+'" alt="Star Vision Áudio Visual"><span class="sv-brand-sub">GESTÃO DE EQUIPAMENTOS</span>';
      el.style.flexDirection='column';
      el.style.alignItems='flex-start';
      el.style.gap='0';
    });
  }
  function brandLogin(){
    if(document.querySelector('.sv-login-brand'))return;
    const password=document.querySelector('input[type="password"]');
    if(!password)return;
    const form=password.closest('form')||password.parentElement;
    if(!form||form.querySelector('.sv-login-brand'))return;
    const box=document.createElement('div');
    box.className='sv-login-brand';
    box.innerHTML='<img class="sv-official-logo" src="'+LOGO+'" alt="Star Vision Áudio Visual">';
    form.parentElement.insertBefore(box,form);
  }
  function run(){install();brandHeader();brandLogin();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
