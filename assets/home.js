let allStories=[];
let mode="all";
const $=s=>document.querySelector(s);
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function render(){
  const q=$("#search").value.trim().toLowerCase();
  let list=allStories.filter(s=>{
    const text=[s.title,...(s.genres||[])].join(" ").toLowerCase();
    if(q && !text.includes(q)) return false;
    if(mode==="full" && !/đã đủ bộ|full/i.test(s.status||"")) return false;
    if(mode==="audio" && !s.audio) return false;
    return true;
  });
  $("#list").innerHTML=list.length?list.map(s=>`
    <a class="story-card" href="truyen/${encodeURIComponent(s.slug)}/">
      <img src="${esc(s.cover||"")}" alt="${esc(s.title)}">
      <div class="story-body">
        <h2>${esc(s.title)}</h2>
        <div class="meta">
          ${s.status?`<span class="pill">✅ ${esc(s.status)}</span>`:""}
          ${s.chapterCount?`<span class="pill">📚 ${esc(s.chapterCount)} chương</span>`:""}
          ${s.audio?`<span class="pill">🎧 Audio</span>`:""}
        </div>
      </div>
    </a>`).join(""):'<div class="empty">Không tìm thấy truyện.</div>';
}
async function init(){
  const r=await fetch("data/stories.json?"+Date.now());
  allStories=await r.json();
  render();
  $("#search").addEventListener("input",render);
  document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");mode=b.dataset.mode;render();
  });
}
init();