(function(){
  const MARK='/star-mark.svg?v=1';
  function install(){
    if(document.getElementById('sv-brand-style'))return;
    const style=document.createElement('style');
    style.id='sv-brand-style';
    style.textContent=`
      .sv-brand-lockup{display:flex;align-items:center;gap:10px;white-space:nowrap}
      .sv-brand-mark{display:block;width:42px;height:42px;flex:none;object-fit:contain}
      .sv-brand-name{font-family:'Ethnocentric','Arial Black',Arial,sans-serif;font-weight:900;letter-spacing:2px;font-size:20px;line-height:1}
      .sv-login-brand{display:flex;justify-content:center;margin:0 auto 20px;padding:4px 0}
      .sv-login-brand .sv-brand-lockup{gap:14px}
      .sv-login-brand .sv-brand-mark{width:58px;height:58px}
      .sv-login-brand .sv-brand-name{font-size:30px;letter-spacing:3px}
      @media(max-width:760px){
        .sv-brand-mark{width:38px;height:38px}
        .sv-brand-name{font-size:17px;letter-spacing:1.5px}
        .sv-login-brand .sv-brand-mark{width:50px;height:50px}
        .sv-login-brand .sv-brand-name{font-size:24px;letter-spacing:2px}
      }
    `;
    document.head.appendChild(style);
    document.title='Star Vision Gestão';
  }
  function lockup(extraClass){
    return '<div class="sv-brand-lockup '+(extraClass||'')+'"><img class="sv-brand-mark" src="'+MARK+'" alt=""><span class="sv-brand-name">STAR VISION</span></div>';
  }
  function brandHeader(){
    document.querySelectorAll('.brand').forEach(el=>{
      if(el.dataset.svBrand==='1')return;
      el.dataset.svBrand='1';
      el.innerHTML=lockup();
      el.style.flexDirection='row';
      el.style.alignItems='center';
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
    box.innerHTML=lockup();
    form.parentElement.insertBefore(box,form);
  }
  function run(){install();brandHeader();brandLogin();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
