(function(){
  const S=window.STORY||{};
  const C=window.SITE_CONFIG||{};
  const key="chuongnhocuahoai_aff_gate";
  const hours=Number(C.popupHours||24);
  const fresh=()=>{
    const t=Number(localStorage.getItem(key)||0);
    return !t || Date.now()-t > hours*60*60*1000;
  };
  window.openReadGate=function(){
    if(!fresh()){ window.open(S.monkeyd,"_blank","noopener"); return; }
    document.getElementById("gate").style.display="flex";
  };
  window.closeGate=function(){document.getElementById("gate").style.display="none"};
  window.markSupport=function(){
    localStorage.setItem(key,String(Date.now()));
    document.getElementById("thanks").style.display="block";
    document.getElementById("gateShop").textContent="✅ ĐÃ MỞ SHOPEE";
  };
  window.rememberGate=function(){localStorage.setItem(key,String(Date.now()))};
})();