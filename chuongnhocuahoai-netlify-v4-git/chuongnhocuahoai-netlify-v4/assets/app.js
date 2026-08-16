(function(){
  const C = window.CHUONG_CONFIG || {};
  const DAY = 24*60*60*1000;
  const GATE_KEY = "chuong_gate_24h";

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function storyParts(){
    const parts = location.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("truyen");
    if(i >= 0 && parts[i+1]){
      return {slug: parts[i+1], youtubeId: parts[i+2] || ""};
    }
    const p = new URLSearchParams(location.search);
    return {slug:p.get("slug")||"", youtubeId:p.get("yt")||""};
  }
  function qs(name){ return new URLSearchParams(location.search).get(name)||""; }
  function youtubeUrl(id){
    if(!id) return qs("audio") || "";
    return "https://www.youtube.com/watch?v="+encodeURIComponent(id);
  }
  function monkeyUrl(slug){ return "https://monkeydd.com/"+slug+".html"; }
  function shopUrl(){ return qs("shop") || C.defaultShopee || ""; }

  async function loadStory(){
    const mount = document.getElementById("storyMount");
    if(!mount) return;
    const {slug,youtubeId} = storyParts();
    if(!slug){
      mount.innerHTML = '<div class="card"><h1 class="story-title">Chưa có truyện</h1><p class="desc">Hãy mở một link truyện được tạo từ trang quản trị.</p></div>';
      return;
    }

    const murl = monkeyUrl(slug);
    const aurl = youtubeUrl(youtubeId);
    const surl = shopUrl();

    const KNOWN = {
      "chong-dua-dan-em-ve-nha-o-toi-am-tham-lay-giay-ly-hon-roi-roi-di": {
        title: "CHỒNG ĐƯA ĐÀN EM VỀ NHÀ Ở, TÔI ÂM THẦM LẤY GIẤY LY HÔN RỒI RỜI ĐI",
        image: "",
        status: "Đã đủ bộ",
        chapterCount: "6",
        genres: ["Đô Thị","Nữ Cường","Vả Mặt","Hiện Đại","Trả Thù","Gia Đình"],
        team: "Chuồng nhỏ của Hoài",
        type: "Truyện Chữ"
      }
    };

    let data = KNOWN[slug] || {
      title: slug.replace(/-/g," ").toUpperCase(),
      image:"",
      status:"Đang tải dữ liệu...",
      chapterCount:"",
      genres:[],
      team:"Chuồng nhỏ của Hoài",
      type:"Truyện Chữ"
    };

    try{
      const r = await fetch("/api/monkeyd-meta?url="+encodeURIComponent(murl));
      if(r.ok){
        const j = await r.json();
        data = {...data,...j};
      }
    }catch(e){}

    const pills = [];
    if(data.status) pills.push("✅ "+data.status);
    if(data.chapterCount) pills.push("📚 "+data.chapterCount+" chương");
    (data.genres||[]).slice(0,6).forEach(g=>pills.push("🏷 "+g));
    if(aurl) pills.push("🎧 Có audio");

    mount.innerHTML = `
      <div class="card">
        <div class="cover">${data.image ? `<img src="${esc(data.image)}" alt="Bìa truyện">` : "ẢNH BÌA TRUYỆN"}</div>
        <h1 class="story-title">${esc(data.title)}</h1>
        <div class="meta">${pills.map(x=>`<span class="pill">${esc(x)}</span>`).join("")}</div>

        <button class="btn btn-read" id="readBtn">📖 ĐỌC TRUYỆN</button>
        ${aurl ? `<a class="btn btn-audio" href="${esc(aurl)}" target="_blank" rel="noopener">🎧 NGHE AUDIO</a>` : ""}
        <a class="btn btn-secondary" href="${esc(C.teamUrl)}" target="_blank" rel="noopener">🏠 XEM TẤT CẢ TRUYỆN CỦA TÔI</a>

        <div class="section-title">🛒 Ủng hộ nhà dịch</div>
        ${surl ? `<a class="btn btn-shop" href="${esc(surl)}" target="_blank" rel="sponsored noopener">MỞ SHOPEE ỦNG HỘ ❤️</a>` : ""}
        <div class="note">Shopee mở ở tab mới. Trang truyện hiện tại vẫn giữ nguyên.</div>

        <div class="section-title">📌 Thông tin</div>
        <div class="info">
          Team: ${esc(data.team || "Chuồng nhỏ của Hoài")}<br>
          Trạng thái: ${esc(data.status || "Đang cập nhật")}<br>
          ${data.type ? `Loại: ${esc(data.type)}<br>` : ""}
          ${data.genres && data.genres.length ? `Thể loại: ${esc(data.genres.join(" • "))}` : ""}
        </div>
      </div>`;

    const stickyAudio = document.getElementById("stickyAudio");
    if(stickyAudio){
      if(aurl){ stickyAudio.href=aurl; stickyAudio.style.display="block"; }
      else stickyAudio.style.opacity=".35";
    }
    const stickyShop = document.getElementById("stickyShop");
    if(stickyShop && surl) stickyShop.href=surl;
    const stickyTeam = document.getElementById("stickyTeam");
    if(stickyTeam) stickyTeam.href=C.teamUrl;

    document.getElementById("readBtn").onclick = () => openGate(murl,aurl,surl);
    const continueRead = document.getElementById("continueRead");
    if(continueRead) continueRead.href=murl;
    const gateShop = document.getElementById("gateShop");
    if(gateShop) gateShop.href=surl;
    const gateAudio = document.getElementById("gateAudio");
    if(gateAudio){
      if(aurl){ gateAudio.href=aurl; gateAudio.style.display="block"; }
      else gateAudio.style.display="none";
    }
  }

  function gateFresh(){
    const t = Number(localStorage.getItem(GATE_KEY)||0);
    return !t || Date.now()-t > DAY;
  }
  function openGate(murl,aurl,surl){
    if(!gateFresh()){
      window.open(murl,"_blank","noopener");
      return;
    }
    const g=document.getElementById("gate");
    if(g) g.style.display="flex";
  }
  window.closeGate = function(){
    const g=document.getElementById("gate");
    if(g) g.style.display="none";
  }
  window.markSupport = function(){
    localStorage.setItem(GATE_KEY,String(Date.now()));
    const t=document.getElementById("thanks");
    if(t) t.style.display="block";
    const b=document.getElementById("gateShop");
    if(b) b.textContent="✅ ĐÃ MỞ SHOPEE";
  }
  window.rememberGate = function(){ localStorage.setItem(GATE_KEY,String(Date.now())); }

  window.addEventListener("DOMContentLoaded",loadStory);
})();