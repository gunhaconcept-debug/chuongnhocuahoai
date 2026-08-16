let allStories = [];
let filtered = [];
let mode = "all";
let currentPage = 1;
let pageSize = 30;
const $ = s => document.querySelector(s);

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function applyFilters(){
  const q = ($("#search")?.value || "").trim().toLowerCase();
  filtered = allStories.filter(s => {
    const text = [s.title, ...(s.genres || [])].join(" ").toLowerCase();
    if(q && !text.includes(q)) return false;
    if(mode === "full" && !/đã đủ bộ|full|hoàn thành/i.test(s.status || "")) return false;
    if(mode === "audio" && !s.audio) return false;
    return true;
  });
  currentPage = 1;
  render();
}

function render(){
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if(currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  $("#count").textContent = `${filtered.length.toLocaleString("vi-VN")} truyện`;
  $("#list").innerHTML = list.length ? list.map(s => `
    <a class="story-card" href="truyen/${encodeURIComponent(s.slug)}/">
      <img loading="lazy" src="${esc(s.cover || "")}" alt="${esc(s.title)}"
           onerror="this.style.display='none'">
      <div class="story-body">
        <h2>${esc(s.title)}</h2>
        <div class="meta">
          ${s.status ? `<span class="pill">✅ ${esc(s.status)}</span>` : ""}
          ${s.chapterCount ? `<span class="pill">📚 ${esc(s.chapterCount)} chương</span>` : ""}
          ${s.audio ? `<span class="pill">🎧 Audio</span>` : ""}
        </div>
        ${(s.genres || []).length ? `<div class="genres">${esc((s.genres || []).slice(0,3).join(" • "))}</div>` : ""}
      </div>
    </a>
  `).join("") : '<div class="empty">Không tìm thấy truyện.</div>';

  const p = $("#pager");
  p.innerHTML = filtered.length > pageSize ? `
    <button ${currentPage<=1?"disabled":""} id="prevPage">← Trước</button>
    <span>Trang ${currentPage}/${pages}</span>
    <button ${currentPage>=pages?"disabled":""} id="nextPage">Sau →</button>
  ` : "";
  $("#prevPage")?.addEventListener("click", () => { currentPage--; render(); scrollTo(0,0); });
  $("#nextPage")?.addEventListener("click", () => { currentPage++; render(); scrollTo(0,0); });
}

async function init(){
  const [storiesRes, cfgRes, syncRes] = await Promise.all([
    fetch("data/stories.json?" + Date.now()),
    fetch("data/config.json?" + Date.now()),
    fetch("data/sync-info.json?" + Date.now()).catch(()=>null)
  ]);
  allStories = await storiesRes.json();
  const cfg = await cfgRes.json();
  pageSize = Number(cfg.pageSize || 30);
  filtered = [...allStories];

  try{
    const info = syncRes && syncRes.ok ? await syncRes.json() : null;
    if(info?.lastSync){
      const d = new Date(info.lastSync);
      $("#syncText").textContent = `Đồng bộ MonkeyD: ${d.toLocaleString("vi-VN")}`;
    }
  }catch(e){}

  render();
  $("#search").addEventListener("input", applyFilters);
  document.querySelectorAll(".filter").forEach(b => b.onclick = () => {
    document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    mode = b.dataset.mode;
    applyFilters();
  });
}
init();