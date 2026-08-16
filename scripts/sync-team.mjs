import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = process.cwd();
const cfg = JSON.parse(await fs.readFile(path.join(ROOT,"data","config.json"),"utf8"));
const audioMap = JSON.parse(await fs.readFile(path.join(ROOT,"data","audio-map.json"),"utf8").catch(()=>Buffer.from("{}")));
const existing = JSON.parse(await fs.readFile(path.join(ROOT,"data","stories.json"),"utf8").catch(()=>Buffer.from("[]")));
const existingMap = new Map(existing.map(x => [x.slug, x]));

const TEAM_URL = cfg.teamUrl;
const TEAM_PATH = new URL(TEAM_URL).pathname.replace(/\/$/,"");
const COVER_DIR = path.join(ROOT,"assets","covers");
await fs.mkdir(COVER_DIR,{recursive:true});

const EXCLUDED_ROOT_HTML = new Set([
  "truyen-moi.html","truyen-hoan-thanh.html","danh-sach-nhom-dich.html",
  "dang-nhap.html","dang-ky.html","index.html"
]);

function slugFrom(url){
  try{
    const p = new URL(url).pathname.split("/").filter(Boolean);
    if(p.length !== 1 || !p[0].endsWith(".html")) return "";
    if(EXCLUDED_ROOT_HTML.has(p[0])) return "";
    return p[0].replace(/\.html$/i,"");
  }catch(e){ return ""; }
}
function parseNumber(v=""){
  const digits=String(v).replace(/[^\d]/g,"");
  return digits ? Number(digits) : 0;
}
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
  ]){
    const m=p.exec(html); if(m) return decode(m[1]);
  }
  return "";
}
function next(lines,label){
  const want=label.toLowerCase();
  for(let i=0;i<lines.length;i++){
    if(lines[i].toLowerCase()===want){
      for(let k=i+1;k<Math.min(lines.length,i+6);k++){
        if(lines[k]) return lines[k];
      }
    }
  }
  return "";
}
function titleFrom(html){
  const h2=/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  return strip(h2?.[1]||"") || meta(html,"og:title") || "";
}
function attr(tag,name){
  const m=new RegExp(`${name}=["']([^"']+)["']`,"i").exec(tag);
  return m ? decode(m[1]) : "";
}
function badImage(url=""){
  return !url || /^data:/i.test(url) || /spinner|loading|loader|lazy|placeholder|transparent|blank\.(gif|png)/i.test(url);
}
function imageFrom(html,title){
  const og=meta(html,"og:image") || meta(html,"twitter:image");
  if(!badImage(og)) return og;

  const tags=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  const norm=s=>strip(s).toLowerCase().replace(/\s+/g," ").trim();
  const nt=norm(title);

  // Ưu tiên data-original/data-src trước src để tránh lấy ảnh spinner lazy-load.
  for(const tag of tags){
    const alt=attr(tag,"alt");
    const candidates=[attr(tag,"data-original"),attr(tag,"data-src"),attr(tag,"data-lazy-src"),attr(tag,"src")];
    const src=candidates.find(x=>!badImage(x)) || "";
    if(src && alt && (norm(alt)===nt || nt.includes(norm(alt)) || norm(alt).includes(nt))) return src;
  }
  for(const tag of tags){
    const candidates=[attr(tag,"data-original"),attr(tag,"data-src"),attr(tag,"data-lazy-src"),attr(tag,"src")];
    const src=candidates.find(x=>!badImage(x)) || "";
    if(src && /monkeyd|monkeydarchive|cdn\./i.test(src)) return src;
  }
  return "";
}
const knownGenres=[
  "Bách Hợp","BE","Bình Luận Cốt Truyện","Chữa Lành","Cổ Đại","Cung Đấu",
  "Cưới Trước Yêu Sau","Cường Thủ Hào Đoạt","Dị Năng","Dưỡng Thê","Đam Mỹ",
  "Điền Văn","Đô Thị","Đoản Văn","Đọc Tâm","Gả Thay","Gia Đấu","Gia Đình",
  "Gương Vỡ Không Lành","Gương Vỡ Lại Lành","Hài Hước","Hành Động",
  "Hào Môn Thế Gia","HE","Hệ Thống","Hiện Đại","Hoán Đổi Thân Xác",
  "Học Bá","Học Đường","Hư Cấu Kỳ Ảo","Huyền Huyễn","Không CP","Kinh Dị",
  "Linh Dị","Mạt Thế","Mỹ Thực","Ngôn Tình","Ngọt","Ngược",
  "Ngược Luyến Tàn Tâm","Ngược Nam","Ngược Nữ","Nhân Thú","Niên Đại",
  "Nữ Cường","OE","Phép Thuật","Phiêu Lưu","Phương Đông","Phương Tây",
  "Quy tắc","Sảng Văn","SE","Showbiz","Sủng","Thanh Xuân Vườn Trường",
  "Thức Tỉnh Nhân Vật","Tiên Hiệp","Tiểu Thuyết","Tổng Tài","Trả Thù",
  "Trinh thám","Trọng Sinh","Truy Thê","Truyền Cảm Hứng","Vả Mặt",
  "Vô Tri","Xuyên Không","Xuyên Sách"
];
function genresFrom(text,title){
  const i=text.indexOf(title);
  const seg=i>=0 ? text.slice(i,i+2500) : text.slice(0,2500);
  return knownGenres.filter(g=>seg.includes(g));
}
function chaptersFrom(html){
  const end=html.search(/Truyện Hot Tháng Này/i);
  const pre=end>0 ? html.slice(0,end) : html;
  const nums=[...pre.matchAll(/<a\b[^>]*>\s*(\d{1,4})\s*<\/a>/gi)]
    .map(m=>Number(m[1])).filter(n=>n>0&&n<1000);
  const u=[...new Set(nums)];
  if(!u.length) return "";
  let c=0;
  for(let n=1;n<=Math.max(...u);n++){
    if(u.includes(n)) c++; else break;
  }
  return c || "";
}

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({
  userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  locale:"vi-VN"
});
const page = await context.newPage();
page.setDefaultTimeout(12000);

async function expandCurrentPage(){
  let same=0, lastCount=0, lastHeight=0;
  for(let i=0;i<120;i++){
    for(const text of ["Xem thêm","Tải thêm","Load more","Xem nhiều hơn"]){
      const loc=page.getByText(text,{exact:false});
      if(await loc.count()){
        try{ await loc.last().click({timeout:800}); await page.waitForTimeout(350); }catch(e){}
      }
    }
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.waitForTimeout(350);
    const count=await page.evaluate(()=>document.querySelectorAll('a[href]').length);
    const height=await page.evaluate(()=>document.body.scrollHeight);
    if(count===lastCount && height===lastHeight) same++; else same=0;
    lastCount=count; lastHeight=height;
    if(same>=5) break;
  }
}

async function extractCurrentPage(){
  return await page.evaluate(({teamPath})=>{
    const abs=h=>{try{return new URL(h,location.href).href}catch(e){return ""}};
    const excluded=new Set(["truyen-moi.html","truyen-hoan-thanh.html","danh-sach-nhom-dich.html","index.html"]);
    const validStoryUrl=href=>{
      try{
        const u=new URL(href);
        if(!/^(www\.)?monkeydd\.com$/i.test(u.hostname)) return false;
        const p=u.pathname.split("/").filter(Boolean);
        return p.length===1 && p[0].endsWith(".html") && !excluded.has(p[0]);
      }catch(e){return false}
    };
    const boxFor=a=>{
      let box=a;
      for(let i=0;i<6 && box.parentElement;i++){
        const txt=(box.innerText||"").trim();
        if(box.querySelector?.("img") && txt.length>=5 && txt.length<700) break;
        box=box.parentElement;
      }
      return box;
    };
    const basicFor=a=>{
      const href=abs(a.getAttribute("href"));
      if(!validStoryUrl(href)) return null;
      const box=boxFor(a);
      const img=box.querySelector?.("img") || a.querySelector?.("img");
      const heading=box.querySelector?.("h1,h2,h3,h4,h5,h6");
      const title=(heading?.innerText || img?.alt || a.innerText || "").trim().replace(/\s+/g," ");
      const cover=(
        img?.dataset?.original ||
        img?.dataset?.src ||
        img?.getAttribute?.("data-lazy-src") ||
        img?.currentSrc ||
        img?.src ||
        ""
      ).trim();
      const cardText=(box.innerText||"").trim().replace(/\s+/g," ");
      return {url:href,title,cover,cardText};
    };

    const stories=[];
    for(const a of document.querySelectorAll("a[href]")){
      const b=basicFor(a); if(b) stories.push(b);
    }

    const pages=[];
    for(const a of document.querySelectorAll("a[href]")){
      const href=abs(a.getAttribute("href"));
      if(!href) continue;
      try{
        const u=new URL(href);
        if(/^(www\.)?monkeydd\.com$/i.test(u.hostname) &&
           (u.pathname.replace(/\/$/,"")===teamPath || u.pathname.replace(/\/$/,"").startsWith(teamPath+"/")) &&
           u.href!==location.href){
          pages.push(u.href);
        }
      }catch(e){}
    }

    const headings=[...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    const between=(startText,stopText)=>{
      const start=headings.find(h=>(h.innerText||"").toLowerCase().includes(startText.toLowerCase()));
      if(!start) return [];
      const stop=headings.find(h=>{
        if(h===start) return false;
        const follows=!!(start.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING);
        return follows && (h.innerText||"").toLowerCase().includes(stopText.toLowerCase());
      });
      const out=[], seen=new Set();
      for(const a of document.querySelectorAll("a[href]")){
        const follows=!!(start.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING);
        const beforeStop=!stop || !!(a.compareDocumentPosition(stop)&Node.DOCUMENT_POSITION_FOLLOWING);
        if(!follows || !beforeStop) continue;
        const b=basicFor(a);
        if(!b || seen.has(b.url)) continue;
        seen.add(b.url);
        const m=b.cardText.match(/(?:^|\s)([\d][\d.,]{0,15})(?:\s|$)/);
        b.firstNumber=m ? Number(m[1].replace(/[^\d]/g,"")) : 0;
        out.push(b);
      }
      return out;
    };

    const monthly=between("Truyện có nhiều lượt xem trong tháng","Danh sách truyện");
    const newest=between("Danh sách truyện","Donate").slice(0,16);

    return {stories,pages,monthly,newest};
  },{teamPath:TEAM_PATH});
}

const queue=[TEAM_URL], seenPages=new Set(), basicMap=new Map();
const monthlyMap=new Map(), newestMap=new Map();

while(queue.length && seenPages.size<400){
  const url=queue.shift();
  if(seenPages.has(url)) continue;
  seenPages.add(url);
  console.log(`[LIST ${seenPages.size}] ${url}`);
  try{
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForTimeout(700);
    await expandCurrentPage();
    const data=await extractCurrentPage();

    for(const s of data.stories){
      const slug=slugFrom(s.url);
      if(!slug) continue;
      const old=basicMap.get(slug);
      if(!old || (s.title||"").length>(old.title||"").length) basicMap.set(slug,{...s,slug});
    }

    // Chỉ dùng trang đầu của team để xác định "mới nhất" và bảng lượt xem tháng.
    const u=new URL(url);
    if(u.pathname.replace(/\/$/,"")===TEAM_PATH && !u.searchParams.get("page")){
      data.monthly.forEach((s,i)=>{
        const slug=slugFrom(s.url);
        if(slug) monthlyMap.set(slug,{rank:i+1,views:s.firstNumber||0});
      });
      data.newest.forEach((s,i)=>{
        const slug=slugFrom(s.url);
        if(slug) newestMap.set(slug,{rank:i+1});
      });
    }

    for(const p of data.pages){
      if(!seenPages.has(p) && !queue.includes(p)) queue.push(p);
    }
  }catch(e){
    console.warn("List page failed:",url,e.message);
  }
}
console.log(`Tìm thấy ${basicMap.size} truyện từ trang team.`);
console.log(`Top tháng: ${monthlyMap.size}; mới nhất: ${newestMap.size}`);

if(basicMap.size < 2){
  throw new Error("Không lấy được danh sách truyện từ MonkeyD. Dừng để tránh ghi đè dữ liệu cũ.");
}

const basics=[...basicMap.values()];
let done=0;
const results=new Array(basics.length);

async function detailOne(basic,index){
  const old=existingMap.get(basic.slug)||{};
  try{
    const r=await context.request.get(basic.url,{timeout:30000,failOnStatusCode:false});
    if(!r.ok()) throw new Error(`HTTP ${r.status()}`);
    const html=await r.text();
    const title=titleFrom(html) || basic.title || old.title || basic.slug.replace(/-/g," ");
    const text=strip(html);
    const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const monthly=monthlyMap.get(basic.slug)||{};
    const newest=newestMap.get(basic.slug)||{};
    const remoteCover=imageFrom(html,title) || basic.cover || old.remoteCover || "";

    results[index]={
      slug:basic.slug,
      title,
      monkeyd:basic.url,
      audio:audioMap[basic.slug] || old.audio || "",
      shopee:old.shopee || cfg.defaultShopee || "",
      cover:old.cover || "",
      remoteCover,
      status:next(lines,"Trạng thái") || old.status || "",
      chapterCount:chaptersFrom(html) || old.chapterCount || "",
      genres:genresFrom(text,title),
      team:next(lines,"Team") || old.team || "Chuồng nhỏ của Hoài",
      type:next(lines,"Loại") || old.type || "Truyện Chữ",
      views:parseNumber(next(lines,"Lượt xem")) || old.views || 0,
      updatedText:next(lines,"Cập nhật") || old.updatedText || "",
      monthlyViews:monthly.views || 0,
      monthlyRank:monthly.rank || 0,
      newestRank:newest.rank || 0
    };
  }catch(e){
    console.warn("Detail failed:",basic.url,e.message);
    const monthly=monthlyMap.get(basic.slug)||{};
    const newest=newestMap.get(basic.slug)||{};
    results[index]={
      ...old,
      slug:basic.slug,
      title:basic.title || old.title || basic.slug.replace(/-/g," "),
      monkeyd:basic.url,
      audio:audioMap[basic.slug] || old.audio || "",
      shopee:old.shopee || cfg.defaultShopee || "",
      remoteCover:basic.cover || old.remoteCover || "",
      monthlyViews:monthly.views || old.monthlyViews || 0,
      monthlyRank:monthly.rank || old.monthlyRank || 0,
      newestRank:newest.rank || old.newestRank || 0
    };
  }
  done++;
  if(done%100===0) console.log(`Đã đọc chi tiết ${done}/${basics.length}`);
}

let cursor=0;
async function detailWorker(){
  while(true){
    const i=cursor++;
    if(i>=basics.length) return;
    await detailOne(basics[i],i);
    await new Promise(r=>setTimeout(r,50));
  }
}
await Promise.all(Array.from({length:12},()=>detailWorker()));

async function localCoverFor(s){
  // Giữ ảnh local cũ nếu file vẫn tồn tại.
  if(s.cover && !/^https?:/i.test(s.cover)){
    try{
      await fs.access(path.join(ROOT,s.cover));
      return s.cover;
    }catch(e){}
  }
  const url=s.remoteCover;
  if(badImage(url)) return url || "";

  const rel=`assets/covers/${s.slug}.webp`;
  const out=path.join(ROOT,rel);

  try{
    const r=await context.request.get(url,{
      timeout:25000,
      failOnStatusCode:false,
      headers:{referer:s.monkeyd || TEAM_URL}
    });
    if(!r.ok()) throw new Error(`HTTP ${r.status()}`);
    const buf=Buffer.from(await r.body());
    if(buf.length<5000) throw new Error("ảnh quá nhỏ/placeholder");

    await sharp(buf)
      .rotate()
      .resize({width:480,height:640,fit:"inside",withoutEnlargement:true})
      .webp({quality:76})
      .toFile(out);

    return rel;
  }catch(e){
    console.warn("Cover failed:",s.slug,e.message);
    return url || "";
  }
}

console.log("Bắt đầu tải và tối ưu ảnh bìa...");
let coverCursor=0, coverDone=0;
async function coverWorker(){
  while(true){
    const i=coverCursor++;
    if(i>=results.length) return;
    const s=results[i];
    if(!s) continue;
    s.cover=await localCoverFor(s);
    coverDone++;
    if(coverDone%100===0) console.log(`Ảnh bìa ${coverDone}/${results.length}`);
  }
}
await Promise.all(Array.from({length:8},()=>coverWorker()));
await browser.close();

const stories=results.filter(Boolean);

// Render pages
let template=await fs.readFile(path.join(ROOT,"templates","story.html"),"utf8");
function esc(s=""){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function renderPage(s){
  let t=template;
  const pills=[];
  if(s.status)pills.push(`<span class="pill">✅ ${esc(s.status)}</span>`);
  if(s.chapterCount)pills.push(`<span class="pill">📚 ${esc(s.chapterCount)} chương</span>`);
  for(const g of (s.genres||[]).slice(0,6))pills.push(`<span class="pill">🏷 ${esc(g)}</span>`);
  if(s.audio)pills.push(`<span class="pill">🎧 Có Audio</span>`);
  let info=`Team: ${esc(s.team||"")}<br>Trạng thái: ${esc(s.status||"")}<br>Loại: ${esc(s.type||"")}`;
  if(s.views) info+=`<br>Lượt xem: ${Number(s.views).toLocaleString("vi-VN")}`;
  if(s.genres?.length)info+=`<br>Thể loại: ${s.genres.map(esc).join(" • ")}`;
  const ab=s.audio?`<a class="btn audio" href="${esc(s.audio)}" target="_blank" rel="noopener">🎧 NGHE AUDIO</a>`:"";
  const sa=s.audio?`<a href="${esc(s.audio)}" target="_blank" rel="noopener">🎧<br>Audio</a>`:"<span></span>";
  const ga=s.audio?`<a class="btn secondary" href="${esc(s.audio)}" target="_blank" rel="noopener" onclick="rememberGate()">🎧 NGHE AUDIO</a>`:"";
  const rep={
    "__TITLE__":esc(s.title),
    "__TEAM_URL__":cfg.teamUrl,
    "__COVER_SRC__": /^https?:\/\//i.test(s.cover||"") ? (s.cover||"") : `../../${s.cover||""}`,
    "__PILLS__":pills.join(""),
    "__AUDIO_BUTTON__":ab,
    "__SHOPEE__":s.shopee||cfg.defaultShopee||"",
    "__INFO__":info,
    "__STICKY_AUDIO__":sa,
    "__GATE_AUDIO__":ga,
    "__MONKEYD__":s.monkeyd,
    "__STORY_JSON__":JSON.stringify(s).replace(/<\//g,"<\\/"),
    "__CONFIG_JSON__":JSON.stringify(cfg).replace(/<\//g,"<\\/")
  };
  for(const [k,v] of Object.entries(rep)) t=t.split(k).join(v);
  return t;
}

await fs.rm(path.join(ROOT,"truyen"),{recursive:true,force:true});
await fs.mkdir(path.join(ROOT,"truyen"),{recursive:true});
for(let i=0;i<stories.length;i++){
  const s=stories[i];
  const dir=path.join(ROOT,"truyen",s.slug);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),renderPage(s));
  if((i+1)%250===0) console.log(`Đã tạo trang ${i+1}/${stories.length}`);
}

await fs.writeFile(path.join(ROOT,"data","stories.json"),JSON.stringify(stories,null,2));
await fs.writeFile(path.join(ROOT,"data","sync-info.json"),JSON.stringify({
  lastSync:new Date().toISOString(),
  totalStories:stories.length,
  source:TEAM_URL,
  listPagesVisited:seenPages.size,
  monthlyHotCount:[...monthlyMap.keys()].length,
  newestCount:[...newestMap.keys()].length
},null,2));

console.log(`HOÀN TẤT: ${stories.length} truyện.`);