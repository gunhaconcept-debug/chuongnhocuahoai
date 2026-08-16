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
function num(v){ return Number(v || 0) || 0; }
function fmt(v){ return num(v).toLocaleString("vi-VN"); }

function card(s, compact=false){
  const img = s.cover
    ? `<img loading="lazy" src="${esc(s.cover)}" alt="${esc(s.title)}" onerror="this.closest('.coverbox').classList.add('img-error');this.remove()">`
    : "";
  const views = s.monthlyViews ? `👁 ${fmt(s.monthlyViews)}` : (s.views ? `👁 ${fmt(s.views)}` : "");
  const chapters = s.chapterCount ? `📖 ${esc(s.chapterCount)}` : "";
  const extra = [views, chapters].filter(Boolean).join(" · ");

  return `
    <a class="${compact ? "rail-card" : "story-card"}" href="truyen/${encodeURIComponent(s.slug)}/">
      <div class="coverbox">${img}<span class="cover-fallback">📖</span></div>
      <div class="story-body">
        <h3>${esc(s.title)}</h3>
        ${extra ? `<div class="tiny-meta">${extra}</div>` : ""}
        ${!compact ? `
          <div class="meta">
            ${s.status ? `<span class="pill">✅ ${esc(s.status)}</span>` : ""}
            ${s.audio ? `<span class="pill">🎧 Audio</span>` : ""}
          </div>
          ${(s.genres || []).length ? `<div class="genres">${esc((s.genres || []).slice(0,3).join(" • "))}</div>` : ""}
        ` : ""}
      </div>
    </a>`;
}

function renderRails(){
  const newest = [...allStories]
    .filter(s => num(s.newestRank) > 0)
    .sort((a,b) => num(a.newestRank)-num(b.newestRank))
    .slice(0,12);

  const monthly = [...allStories]
    .filter(s => num(s.monthlyRank) > 0 || num(s.monthlyViews) > 0)
    .sort((a,b) => {
      const ar=num(a.monthlyRank), br=num(b.monthlyRank);
      if(ar && br) return ar-br;
      if(ar) return -1;
      if(br) return 1;
      return num(b.monthlyViews)-num(a.monthlyViews);
    })
    .slice(0,12);

  $("#newestRail").innerHTML = newest.length
    ? newest.map(s => card(s,true)).join("")
    : '<div class="rail-empty">Chưa có dữ liệu truyện mới.</div>';

  $("#monthlyRail").innerHTML = monthly.length
    ? monthly.map(s => card(s,true)).join("")
    : '<div class="rail-empty">Chưa lấy được bảng lượt xem tháng.</div>';
}

function buildGenres(){
  const genres = [...new Set(allStories.flatMap(s => s.genres || []))]
    .filter(Boolean).sort((a,b)=>a.localeCompare(b,"vi"));
  $("#genreFilter").innerHTML =
    '<option value="">Chọn thể loại...</option>' +
    genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
}

function applyFilters(){
  const q = ($("#search")?.value || "").trim().toLowerCase();
  const genre = $("#genreFilter")?.value || "";

  filtered = allStories.filter(s => {
    const text = [s.title, ...(s.genres || [])].join(" ").toLowerCase();
    if(q && !text.includes(q)) return false;
    if(genre && !(s.genres || []).includes(genre)) return false;
    if(mode === "full" && !/đã đủ bộ|full|hoàn thành/i.test(s.status || "")) return false;
    if(mode === "audio" && !s.audio) return false;
    return true;
  });

  currentPage = 1;
  renderList();
}

function renderList(){
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if(currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  $("#count").textContent = `${filtered.length.toLocaleString("vi-VN")} truyện`;
  $("#list").innerHTML = list.length
    ? list.map(s => card(s,false)).join("")
    : '<div class="empty">Không tìm thấy truyện.</div>';

  const p = $("#pager");
  p.innerHTML = filtered.length > pageSize ? `
    <button ${currentPage<=1?"disabled":""} id="prevPage">← Trước</button>
    <span>Trang ${currentPage}/${pages}</span>
    <button ${currentPage>=pages?"disabled":""} id="nextPage">Sau →</button>
  ` : "";

  $("#prevPage")?.addEventListener("click", () => {
    currentPage--; renderList();
    document.querySelector(".list-head")?.scrollIntoView({behavior:"smooth"});
  });
  $("#nextPage")?.addEventListener("click", () => {
    currentPage++; renderList();
    document.querySelector(".list-head")?.scrollIntoView({behavior:"smooth"});
  });
}

async function init(){
  const [storiesRes, cfgRes, syncRes] = await Promise.all([
    fetch("data/stories.json?" + Date.now()),
    fetch("data/config.json?" + Date.now()),
    fetch("data/sync-info.json?" + Date.now()).catch(()=>null)
  ]);

  allStories = await storiesRes.json();
  const cfg = await cfgRes.json();
  pageSize = Number(cfg.pageSize || 32);
  filtered = [...allStories];

  try{
    const info = syncRes && syncRes.ok ? await syncRes.json() : null;
    if(info?.lastSync){
      $("#syncText").textContent = `Cập nhật ${new Date(info.lastSync).toLocaleString("vi-VN")}`;
    }
  }catch(e){}

  renderRails();
  buildGenres();
  renderList();

  $("#search").addEventListener("input", applyFilters);
  $("#genreFilter").addEventListener("change", applyFilters);
  document.querySelectorAll(".filter").forEach(b => b.onclick = () => {
    document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    mode = b.dataset.mode;
    applyFilters();
  });
}
init();