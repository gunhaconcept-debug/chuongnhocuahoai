let allStories = [];
let filtered = [];
let mode = "all";
let currentPage = 1;
let pageSize = 32;

const $ = s => document.querySelector(s);

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function n(v){ return Number(v || 0) || 0; }
function fmt(v){ return n(v).toLocaleString("vi-VN"); }

function storyCard(s, compact=false){
  const cover = s.cover
    ? `<img loading="lazy" src="${esc(s.cover)}" alt="${esc(s.title)}"
         onerror="this.remove()">`
    : "";

  const eye = s.monthlyViews ? s.monthlyViews : s.views;
  const info = [
    eye ? `👁 ${fmt(eye)}` : "",
    s.chapterCount ? `📖 ${esc(s.chapterCount)}` : ""
  ].filter(Boolean).join(" · ");

  return `
    <a class="${compact ? "monkey-card" : "story-card"}"
       href="truyen/${encodeURIComponent(s.slug)}/">
      <div class="coverbox">
        ${cover}
        <span class="cover-fallback">📖</span>
      </div>
      <div class="story-body">
        <h3>${esc(s.title)}</h3>
        ${info ? `<div class="tiny-meta">${info}</div>` : ""}
        ${!compact ? `
          <div class="meta">
            ${s.status ? `<span class="pill">✅ ${esc(s.status)}</span>` : ""}
            ${s.audio ? `<span class="pill">🎧 Audio</span>` : ""}
          </div>
          ${(s.genres || []).length
            ? `<div class="genres">${esc((s.genres || []).slice(0,3).join(" • "))}</div>`
            : ""}
        ` : ""}
      </div>
    </a>`;
}

function renderTeam(team){
  $("#teamName").textContent = team.name || "Chuồng nhỏ của Hoài";
  $("#teamDescription").textContent = team.description || "";
  $("#teamFollowers").textContent = team.followers || "—";
  $("#teamViews").textContent = team.views || "—";
  $("#teamStories").textContent = team.storyCount || allStories.length.toLocaleString("vi-VN");
  $("#teamAudio").textContent = team.audioCount || allStories.filter(x=>x.audio).length.toLocaleString("vi-VN");

  if(team.avatar){
    $("#teamAvatar").innerHTML = `<img src="${esc(team.avatar)}" alt="${esc(team.name||"")}">`;
  }

  const links = Array.isArray(team.facebookLinks) ? team.facebookLinks : [];
  $("#teamLinks").innerHTML = links.map((url,i)=>`
    <a href="${esc(url)}" target="_blank" rel="noopener">
      ${i===0 ? "Facebook Chuồng nhỏ của Hoài" : "Ổ này có Hoài"}
    </a>
  `).join("");
}

function renderTopSections(){
  const favorites = [...allStories]
    .filter(s => n(s.favoriteRank) > 0)
    .sort((a,b) => n(a.favoriteRank)-n(b.favoriteRank));

  const monthly = [...allStories]
    .filter(s => n(s.monthlyRank) > 0)
    .sort((a,b) => n(a.monthlyRank)-n(b.monthlyRank));

  if(favorites.length){
    $("#favoriteRail").innerHTML = favorites.map(s=>storyCard(s,true)).join("");
    $("#favoriteSection").style.display = "";
  }else{
    $("#favoriteSection").style.display = "none";
  }

  $("#monthlyRail").innerHTML = monthly.length
    ? monthly.map(s=>storyCard(s,true)).join("")
    : '<div class="rail-empty">Chưa lấy được dữ liệu lượt xem tháng.</div>';
}

function buildGenres(){
  const genres = [...new Set(allStories.flatMap(s=>s.genres||[]))]
    .filter(Boolean).sort((a,b)=>a.localeCompare(b,"vi"));
  $("#genreFilter").innerHTML =
    '<option value="">Chọn thể loại...</option>' +
    genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("");
}

function applyFilters(){
  const q = ($("#search")?.value || "").trim().toLowerCase();
  const genre = $("#genreFilter")?.value || "";

  filtered = allStories.filter(s=>{
    const hay = [s.title, ...(s.genres||[])].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(genre && !(s.genres||[]).includes(genre)) return false;
    if(mode==="full" && !/đã đủ bộ|full|hoàn thành/i.test(s.status||"")) return false;
    if(mode==="audio" && !s.audio) return false;
    return true;
  }).sort((a,b)=>n(a.listOrder)-n(b.listOrder));

  currentPage=1;
  renderList();
}

function renderList(){
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  if(currentPage>pages) currentPage=pages;
  const start=(currentPage-1)*pageSize;
  const list=filtered.slice(start,start+pageSize);

  $("#count").textContent=`${filtered.length.toLocaleString("vi-VN")} truyện`;
  $("#list").innerHTML=list.length
    ? list.map(s=>storyCard(s,false)).join("")
    : '<div class="empty">Không tìm thấy truyện.</div>';

  $("#pager").innerHTML=filtered.length>pageSize ? `
    <button ${currentPage<=1?"disabled":""} id="prevPage">← Trước</button>
    <span>Trang ${currentPage}/${pages}</span>
    <button ${currentPage>=pages?"disabled":""} id="nextPage">Sau →</button>
  ` : "";

  $("#prevPage")?.addEventListener("click",()=>{
    currentPage--; renderList();
    document.querySelector(".list-head")?.scrollIntoView({behavior:"smooth"});
  });
  $("#nextPage")?.addEventListener("click",()=>{
    currentPage++; renderList();
    document.querySelector(".list-head")?.scrollIntoView({behavior:"smooth"});
  });
}

async function init(){
  const [storiesRes,cfgRes,teamRes,syncRes]=await Promise.all([
    fetch("data/stories.json?"+Date.now()),
    fetch("data/config.json?"+Date.now()),
    fetch("data/team.json?"+Date.now()).catch(()=>null),
    fetch("data/sync-info.json?"+Date.now()).catch(()=>null)
  ]);

  allStories=await storiesRes.json();
  const cfg=await cfgRes.json();
  pageSize=Number(cfg.pageSize||32);

  const team = teamRes && teamRes.ok ? await teamRes.json() : {};
  renderTeam(team);

  try{
    const info=syncRes && syncRes.ok ? await syncRes.json() : null;
    if(info?.lastSync){
      $("#syncText").textContent=`Cập nhật ${new Date(info.lastSync).toLocaleString("vi-VN")}`;
    }
  }catch(e){}

  renderTopSections();
  buildGenres();
  filtered=[...allStories].sort((a,b)=>n(a.listOrder)-n(b.listOrder));
  renderList();

  $("#search").addEventListener("input",applyFilters);
  $("#genreFilter").addEventListener("change",applyFilters);

  document.querySelectorAll(".subfilters .filter").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".subfilters .filter").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    mode=b.dataset.mode;
    applyFilters();
  });

  document.querySelector(".filter-main")?.addEventListener("click",applyFilters);
}
init();