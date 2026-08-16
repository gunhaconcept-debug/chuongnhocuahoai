import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const monkeyd = (process.env.MONKEYD_URL || "").trim();
const audio = (process.env.AUDIO_URL || "").trim();
const shopeeInput = (process.env.SHOPEE_URL || "").trim();

if (!/^https:\/\/(www\.)?monkeydd\.com\//i.test(monkeyd)) {
  throw new Error("MONKEYD_URL không hợp lệ.");
}

const cfg = JSON.parse(await fs.readFile(path.join(ROOT,"data","config.json"),"utf8"));
const shopee = shopeeInput || cfg.defaultShopee || "";

function decode(s=""){
  return s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function strip(s=""){
  return decode(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi," ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/section|\/article)>/gi,"\n")
    .replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n\s+/g,"\n")).trim();
}
function meta(html,key){
  const e=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  for(const p of [
    new RegExp(`<meta[^>]+(?:property|name)=["']${e}["'][^>]+content=["']([^"']+)["']`,"i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${e}["']`,"i")
  ]){ const m=p.exec(html); if(m) return decode(m[1]); }
  return "";
}
function next(lines,label){
  const want=label.toLowerCase();
  for(let i=0;i<lines.length;i++){
    if(lines[i].toLowerCase()===want){
      for(let k=i+1;k<Math.min(lines.length,i+6);k++) if(lines[k]) return lines[k];
    }
  }
  return "";
}
function slugFrom(url){
  return new URL(url).pathname.split("/").filter(Boolean).pop().replace(/\.html$/i,"");
}
function titleFrom(html){
  const h2=/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  return strip(h2?.[1]||"") || meta(html,"og:title") || "Truyện MonkeyD";
}
function imageFrom(html,title){
  const og=meta(html,"og:image")||meta(html,"twitter:image");
  if(og) return og;
  const tags=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  const norm=s=>strip(s).toLowerCase().replace(/\s+/g," ").trim();
  const nt=norm(title);
  for(const tag of tags){
    const alt=/alt=["']([^"']*)["']/i.exec(tag)?.[1]||"";
    const src=/(?:src|data-src|data-original)=["']([^"']+)["']/i.exec(tag)?.[1]||"";
    if(src&&alt&&(norm(alt)===nt||nt.includes(norm(alt))||norm(alt).includes(nt))) return decode(src);
  }
  return "";
}
const knownGenres=["Bách Hợp","BE","Chữa Lành","Cổ Đại","Cung Đấu","Cưới Trước Yêu Sau","Cường Thủ Hào Đoạt","Đam Mỹ","Đô Thị","Đoản Văn","Gia Đình","Hào Môn Thế Gia","HE","Hiện Đại","Học Đường","Huyền Huyễn","Ngôn Tình","Ngọt","Ngược","Nữ Cường","Sảng Văn","Sủng","Trả Thù","Trọng Sinh","Truy Thê","Vả Mặt","Xuyên Không","Xuyên Sách"];
function genresFrom(text,title){
  const i=text.indexOf(title), seg=i>=0?text.slice(i,i+2400):text.slice(0,2400);
  return knownGenres.filter(g=>seg.includes(g));
}
function chaptersFrom(html){
  const end=html.search(/Truyện Hot Tháng Này/i);
  const pre=end>0?html.slice(0,end):html;
  const nums=[...pre.matchAll(/<a\b[^>]*>\s*(\d{1,4})\s*<\/a>/gi)].map(m=>Number(m[1])).filter(n=>n>0&&n<1000);
  const u=[...new Set(nums)];
  if(!u.length) return "";
  let c=0; for(let n=1;n<=Math.max(...u);n++){if(u.includes(n)) c++; else break;}
  return c||"";
}
async function fetchStory(url){
  const r=await fetch(url,{headers:{
    "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
    "accept-language":"vi-VN,vi;q=0.9,en;q=0.7"
  }});
  if(!r.ok) throw new Error(`MonkeyD HTTP ${r.status}`);
  const html=await r.text(), title=titleFrom(html), text=strip(html);
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return {html,title,text,lines};
}
async function saveCover(url,slug){
  if(!url) return "";
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0"}});
  if(!r.ok) return "";
  const ct=r.headers.get("content-type")||"";
  const ext=ct.includes("png")?"png":ct.includes("webp")?"webp":"jpg";
  const rel=`assets/covers/${slug}.${ext}`;
  await fs.mkdir(path.dirname(path.join(ROOT,rel)),{recursive:true});
  const buf=Buffer.from(await r.arrayBuffer());
  await fs.writeFile(path.join(ROOT,rel),buf);
  return rel;
}
function esc(s=""){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
async function renderPage(s){
  let t=await fs.readFile(path.join(ROOT,"templates","story.html"),"utf8");
  const pills=[];
  if(s.status)pills.push(`<span class="pill">✅ ${esc(s.status)}</span>`);
  if(s.chapterCount)pills.push(`<span class="pill">📚 ${esc(s.chapterCount)} chương</span>`);
  for(const g of (s.genres||[]).slice(0,6))pills.push(`<span class="pill">🏷 ${esc(g)}</span>`);
  if(s.audio)pills.push(`<span class="pill">🎧 Có Audio</span>`);
  let info=`Team: ${esc(s.team||"")}<br>Trạng thái: ${esc(s.status||"")}<br>Loại: ${esc(s.type||"")}`;
  if(s.genres?.length)info+=`<br>Thể loại: ${s.genres.map(esc).join(" • ")}`;
  const ab=s.audio?`<a class="btn audio" href="${esc(s.audio)}" target="_blank" rel="noopener">🎧 NGHE AUDIO</a>`:"";
  const sa=s.audio?`<a href="${esc(s.audio)}" target="_blank" rel="noopener">🎧<br>Audio</a>`:"<span></span>";
  const ga=s.audio?`<a class="btn secondary" href="${esc(s.audio)}" target="_blank" rel="noopener" onclick="rememberGate()">🎧 NGHE AUDIO</a>`:"";
  const rep={
    "__TITLE__":esc(s.title),"__TEAM_URL__":cfg.teamUrl,"__COVER__":s.cover||"",
    "__PILLS__":pills.join(""),"__AUDIO_BUTTON__":ab,"__SHOPEE__":s.shopee,
    "__INFO__":info,"__STICKY_AUDIO__":sa,"__GATE_AUDIO__":ga,"__MONKEYD__":s.monkeyd,
    "__STORY_JSON__":JSON.stringify(s).replace(/<\//g,"<\\/"),
    "__CONFIG_JSON__":JSON.stringify(cfg).replace(/<\//g,"<\\/")
  };
  for(const [k,v] of Object.entries(rep))t=t.split(k).join(v);
  const dir=path.join(ROOT,"truyen",s.slug);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),t);
}
async function upsert(input, overrideAudio=null, overrideShop=null){
  const slug=slugFrom(input);
  const {html,title,text,lines}=await fetchStory(input);
  const image=imageFrom(html,title);
  const oldList=JSON.parse(await fs.readFile(path.join(ROOT,"data","stories.json"),"utf8"));
  const old=oldList.find(x=>x.slug===slug)||{};
  const cover=await saveCover(image,slug) || old.cover || "";
  const s={
    slug,title,monkeyd:input,
    audio:overrideAudio===null?(old.audio||""):overrideAudio,
    shopee:overrideShop===null?(old.shopee||cfg.defaultShopee||""):overrideShop,
    cover,status:next(lines,"Trạng thái")||old.status||"",
    chapterCount:chaptersFrom(html)||old.chapterCount||"",
    genres:genresFrom(text,title),
    team:next(lines,"Team")||old.team||"Chuồng nhỏ của Hoài",
    type:next(lines,"Loại")||old.type||"Truyện Chữ"
  };
  const idx=oldList.findIndex(x=>x.slug===slug);
  if(idx>=0)oldList[idx]=s; else oldList.unshift(s);
  await fs.writeFile(path.join(ROOT,"data","stories.json"),JSON.stringify(oldList,null,2));
  await renderPage(s);
  return s;
}

const s=await upsert(monkeyd,audio,shopee);
console.log("Đã cập nhật:",s.title);