import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT=process.cwd();
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,"data","config.json"),"utf8"));
const existing=JSON.parse(await fs.readFile(path.join(ROOT,"data","stories.json"),"utf8").catch(()=>Buffer.from("[]")));
const existingMap=new Map(existing.map(x=>[x.slug,x]));

const TEAM_URL=cfg.teamUrl;
const TEAM_PATH=new URL(TEAM_URL).pathname.replace(/\/$/,"");
const COVER_DIR=path.join(ROOT,"assets","covers");
await fs.mkdir(COVER_DIR,{recursive:true});

const EXCLUDED=new Set([
  "truyen-moi.html","truyen-hoan-thanh.html","danh-sach-nhom-dich.html",
  "dang-nhap.html","dang-ky.html","index.html"
]);

function slugFrom(url){
  try{
    const p=new URL(url).pathname.split("/").filter(Boolean);
    if(p.length!==1 || !p[0].endsWith(".html") || EXCLUDED.has(p[0])) return "";
    return p[0].replace(/\.html$/i,"");
  }catch(e){return ""}
}
function audioFromMonkey(url){
  try{
    const u=new URL(url);
    u.protocol="https:";
    u.hostname="monkeydaudio.com";
    u.port="";
    return u.toString();
  }catch(e){return ""}
}
function parseNumber(v=""){
  const s=String(v).replace(/[^\d]/g,"");
  return s?Number(s):0;
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
    const m=p.exec(html); if(m)return decode(m[1]);
  }
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
function titleFrom(html){
  const h2=/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  return strip(h2?.[1]||"") || meta(html,"og:title") || "";
}
function attr(tag,name){
  const m=new RegExp(`${name}=["']([^"']+)["']`,"i").exec(tag);
  return m?decode(m[1]):"";
}
function badImage(url=""){
  return !url || /^data:/i.test(url) || /spinner|loading|loader|lazy|placeholder|transparent|blank\.(gif|png)/i.test(url);
}
function imageFrom(html,title){
  const og=meta(html,"og:image")||meta(html,"twitter:image");
  if(!badImage(og))return og;
  const tags=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  const norm=s=>strip(s).toLowerCase().replace(/\s+/g," ").trim();
  const nt=norm(title);
  for(const tag of tags){
    const alt=attr(tag,"alt");
    const cands=[attr(tag,"data-original"),attr(tag,"data-src"),attr(tag,"data-lazy-src"),attr(tag,"src")];
    const src=cands.find(x=>!badImage(x))||"";
    if(src&&alt&&(norm(alt)===nt||nt.includes(norm(alt))||norm(alt).includes(nt)))return src;
  }
  for(const tag of tags){
    const cands=[attr(tag,"data-original"),attr(tag,"data-src"),attr(tag,"data-lazy-src"),attr(tag,"src")];
    const src=cands.find(x=>!badImage(x))||"";
    if(src&&/monkeyd|monkeydarchive|cdn\./i.test(src))return src;
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
  const seg=i>=0?text.slice(i,i+2500):text.slice(0,2500);
  return knownGenres.filter(g=>seg.includes(g));
}
function chaptersFrom(html){
  const end=html.search(/Truyện Hot Tháng Này/i);
  const pre=end>0?html.slice(0,end):html;
  const nums=[...pre.matchAll(/<a\b[^>]*>\s*(\d{1,4})\s*<\/a>/gi)]
    .map(m=>Number(m[1])).filter(n=>n>0&&n<1000);
  const u=[...new Set(nums)];
  if(!u.length)return "";
  let c=0;
  for(let n=1;n<=Math.max(...u);n++){if(u.includes(n))c++;else break;}
  return c||"";
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  locale:"vi-VN"
});
const page=await context.newPage();
page.setDefaultTimeout(12000);

async function expand(){
  let stable=0,lastH=0,lastA=0;
  for(let i=0;i<120;i++){
    for(const text of ["Xem thêm","Tải thêm","Load more","Xem nhiều hơn"]){
      const loc=page.getByText(text,{exact:false});
      if(await loc.count()){
        try{await loc.last().click({timeout:700});await page.waitForTimeout(250)}catch(e){}
      }
    }
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.waitForTimeout(300);
    const h=await page.evaluate(()=>document.body.scrollHeight);
    const a=await page.evaluate(()=>document.querySelectorAll("a[href]").length);
    if(h===lastH&&a===lastA)stable++;else stable=0;
    lastH=h;lastA=a;
    if(stable>=5)break;
  }
}

async function extractPage(){
  return await page.evaluate(({teamPath})=>{
    const abs=h=>{try{return new URL(h,location.href).href}catch(e){return ""}};
    const excluded=new Set(["truyen-moi.html","truyen-hoan-thanh.html","danh-sach-nhom-dich.html","index.html"]);
    const valid=href=>{
      try{
        const u=new URL(href);
        if(!/^(www\.)?monkeydd\.com$/i.test(u.hostname))return false;
        const p=u.pathname.split("/").filter(Boolean);
        return p.length===1&&p[0].endsWith(".html")&&!excluded.has(p[0]);
      }catch(e){return false}
    };
    const cardFor=a=>{
      let box=a;
      for(let i=0;i<7&&box.parentElement;i++){
        const txt=(box.innerText||"").trim();
        if(box.querySelector?.("img")&&txt.length>=5&&txt.length<900)break;
        box=box.parentElement;
      }
      return box;
    };
    const basicFor=a=>{
      const url=abs(a.getAttribute("href"));
      if(!valid(url))return null;
      const box=cardFor(a);
      const img=box.querySelector?.("img")||a.querySelector?.("img");
      const heading=box.querySelector?.("h1,h2,h3,h4,h5,h6");
      const title=(heading?.innerText||img?.alt||a.innerText||"").trim().replace(/\s+/g," ");
      const cover=(img?.dataset?.original||img?.dataset?.src||img?.getAttribute?.("data-lazy-src")||img?.currentSrc||img?.src||"").trim();
      const cardText=(box.innerText||"").trim().replace(/\s+/g," ");
      return {url,title,cover,cardText};
    };

    const headings=[...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];

    function sectionByHeading(startMatchers,endMatchers){
      const norm=s=>(s||"").trim().toLowerCase();
      const start=headings.find(h=>startMatchers.some(x=>norm(h.innerText).includes(x)));
      if(!start)return [];
      let stop=null;
      for(const h of headings){
        if(h===start)continue;
        const follows=!!(start.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING);
        if(follows&&endMatchers.some(x=>norm(h.innerText).includes(x))){stop=h;break;}
      }
      const out=[],seen=new Set();
      for(const a of document.querySelectorAll("a[href]")){
        const follows=!!(start.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING);
        const beforeStop=!stop||!!(a.compareDocumentPosition(stop)&Node.DOCUMENT_POSITION_FOLLOWING);
        if(!follows||!beforeStop)continue;
        const b=basicFor(a);
        if(!b||seen.has(b.url))continue;
        seen.add(b.url);
        const nums=[...b.cardText.matchAll(/\b[\d][\d.,]*\b/g)].map(m=>Number(m[0].replace(/[^\d]/g,""))).filter(Boolean);
        b.numbers=nums;
        out.push(b);
      }
      return out;
    }

    const favorites=sectionByHeading(
      ["truyện tâm đắc nhà"],
      ["truyện có nhiều lượt xem trong tháng","danh sách truyện"]
    );
    const monthly=sectionByHeading(
      ["truyện có nhiều lượt xem trong tháng"],
      ["danh sách truyện"]
    );
    const list=sectionByHeading(
      ["danh sách truyện"],
      ["bảng xếp hạng","thể loại","donate"]
    );

    const pages=[];
    for(const a of document.querySelectorAll("a[href]")){
      const href=abs(a.getAttribute("href"));
      if(!href)continue;
      try{
        const u=new URL(href);
        if(/^(www\.)?monkeydd\.com$/i.test(u.hostname)&&
           u.pathname.replace(/\/$/,"")===teamPath&&
           u.searchParams.has("page")){
          pages.push(u.href);
        }
      }catch(e){}
    }

    // Team profile
    const h1=headings.find(h=>(h.innerText||"").trim()==="Chuồng nhỏ của Hoài")||headings.find(h=>/Chuồng nhỏ của Hoài/i.test(h.innerText||""));
    let avatar="";
    if(h1){
      const scope=h1.closest("section,article,div")||document.body;
      const img=scope.querySelector("img");
      avatar=(img?.dataset?.original||img?.dataset?.src||img?.currentSrc||img?.src||"").trim();
    }
    const bodyText=document.body.innerText||"";
    const grab=label=>{
      const r=new RegExp(label+"\\s*[:：]?\\s*([\\d.,]+)","i").exec(bodyText);
      return r?r[1]:"";
    };
    const fb=[...document.querySelectorAll('a[href*="facebook.com"]')].map(a=>a.href).filter(Boolean);

    return {
      favorites,monthly,list,pages,
      team:{
        name:"Chuồng nhỏ của Hoài",
        avatar,
        followers:grab("Lượt theo dõi"),
        views:grab("Lượt xem"),
        storyCount:grab("Số truyện"),
        audioCount:grab("Số truyện có Audio"),
        facebookLinks:[...new Set(fb)].slice(0,4)
      }
    };
  },{teamPath:TEAM_PATH});
}

// First page
await page.goto(TEAM_URL,{waitUntil:"domcontentloaded",timeout:45000});
await page.waitForTimeout(700);
await expand();
const first=await extractPage();

const favoriteMap=new Map();
first.favorites.forEach((x,i)=>{
  const slug=slugFrom(x.url); if(slug)favoriteMap.set(slug,{rank:i+1});
});
const monthlyMap=new Map();
first.monthly.forEach((x,i)=>{
  const slug=slugFrom(x.url);
  if(slug)monthlyMap.set(slug,{rank:i+1,views:(x.numbers||[])[0]||0});
});

// collect list pages in numeric order
const pageNums=[1,...first.pages.map(u=>Number(new URL(u).searchParams.get("page"))||1)];
const uniquePages=[...new Set(pageNums)].sort((a,b)=>a-b);
let maxPage=Math.max(...uniquePages);
if(maxPage<2)maxPage=1;

const listMap=new Map();
let listOrder=0;

async function addListEntries(items){
  for(const item of items){
    const slug=slugFrom(item.url);
    if(!slug)continue;
    if(!listMap.has(slug)){
      listMap.set(slug,{...item,slug,listOrder:++listOrder});
    }
  }
}
await addListEntries(first.list);

// crawl every page 2..maxPage; if page links reveal a bigger max, extend.
for(let p=2;p<=maxPage;p++){
  const url=`${TEAM_URL}?page=${p}`;
  console.log(`[LIST ${p}/${maxPage}] ${url}`);
  try{
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForTimeout(450);
    await expand();
    const data=await extractPage();
    await addListEntries(data.list);
    const seenNums=data.pages.map(u=>Number(new URL(u).searchParams.get("page"))||1);
    const revealed=Math.max(1,...seenNums);
    if(revealed>maxPage)maxPage=revealed;
  }catch(e){
    console.warn("List page failed:",p,e.message);
  }
}

console.log(`Danh sách MonkeyD: ${listMap.size} truyện; ${maxPage} trang.`);

// ensure favorites/monthly also included even if not in crawled list
for(const item of [...first.favorites,...first.monthly]){
  const slug=slugFrom(item.url);
  if(slug&&!listMap.has(slug)){
    listMap.set(slug,{...item,slug,listOrder:++listOrder});
  }
}

const basics=[...listMap.values()];
const results=new Array(basics.length);
let cursor=0,done=0;

async function detailOne(basic,index){
  const old=existingMap.get(basic.slug)||{};
  try{
    const r=await context.request.get(basic.url,{timeout:30000,failOnStatusCode:false});
    if(!r.ok())throw new Error(`HTTP ${r.status()}`);
    const html=await r.text();
    const title=titleFrom(html)||basic.title||old.title||basic.slug.replace(/-/g," ");
    const text=strip(html);
    const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const fav=favoriteMap.get(basic.slug)||{};
    const month=monthlyMap.get(basic.slug)||{};

    results[index]={
      slug:basic.slug,
      title,
      monkeyd:basic.url,
      audio:audioFromMonkey(basic.url),
      shopee:old.shopee||cfg.defaultShopee||"",
      cover:old.cover||"",
      remoteCover:imageFrom(html,title)||basic.cover||old.remoteCover||"",
      status:next(lines,"Trạng thái")||old.status||"",
      chapterCount:chaptersFrom(html)||old.chapterCount||"",
      genres:genresFrom(text,title),
      team:next(lines,"Team")||old.team||"Chuồng nhỏ của Hoài",
      type:next(lines,"Loại")||old.type||"Truyện Chữ",
      views:parseNumber(next(lines,"Lượt xem"))||old.views||0,
      updatedText:next(lines,"Cập nhật")||old.updatedText||"",
      favoriteRank:fav.rank||0,
      monthlyRank:month.rank||0,
      monthlyViews:month.views||0,
      listOrder:basic.listOrder
    };
  }catch(e){
    const fav=favoriteMap.get(basic.slug)||{};
    const month=monthlyMap.get(basic.slug)||{};
    results[index]={
      ...old,
      slug:basic.slug,
      title:basic.title||old.title||basic.slug.replace(/-/g," "),
      monkeyd:basic.url,
      audio:audioFromMonkey(basic.url),
      shopee:old.shopee||cfg.defaultShopee||"",
      remoteCover:basic.cover||old.remoteCover||"",
      favoriteRank:fav.rank||0,
      monthlyRank:month.rank||0,
      monthlyViews:month.views||0,
      listOrder:basic.listOrder
    };
  }
  done++;
  if(done%100===0)console.log(`Chi tiết ${done}/${basics.length}`);
}

async function detailWorker(){
  while(true){
    const i=cursor++;
    if(i>=basics.length)return;
    await detailOne(basics[i],i);
    await new Promise(r=>setTimeout(r,45));
  }
}
await Promise.all(Array.from({length:12},()=>detailWorker()));

async function localCoverFor(s){
  if(s.cover&&!/^https?:/i.test(s.cover)){
    try{await fs.access(path.join(ROOT,s.cover));return s.cover}catch(e){}
  }
  const url=s.remoteCover;
  if(badImage(url))return url||"";
  const rel=`assets/covers/${s.slug}.webp`;
  const out=path.join(ROOT,rel);
  try{
    const r=await context.request.get(url,{timeout:25000,failOnStatusCode:false,headers:{referer:s.monkeyd||TEAM_URL}});
    if(!r.ok())throw new Error(`HTTP ${r.status()}`);
    const buf=Buffer.from(await r.body());
    if(buf.length<5000)throw new Error("ảnh quá nhỏ");
    await sharp(buf).rotate().resize({width:360,height:480,fit:"inside",withoutEnlargement:true}).webp({quality:68}).toFile(out);
    return rel;
  }catch(e){
    return url||"";
  }
}

let coverCursor=0,coverDone=0;
async function coverWorker(){
  while(true){
    const i=coverCursor++;
    if(i>=results.length)return;
    const s=results[i];
    if(!s)continue;
    s.cover=await localCoverFor(s);
    coverDone++;
    if(coverDone%100===0)console.log(`Ảnh ${coverDone}/${results.length}`);
  }
}
await Promise.all(Array.from({length:8},()=>coverWorker()));
await browser.close();

const stories=results.filter(Boolean).sort((a,b)=>(a.listOrder||0)-(b.listOrder||0));

// render story pages
let template=await fs.readFile(path.join(ROOT,"templates","story.html"),"utf8");
function esc(s=""){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function renderPage(s){
  let t=template;
  const pills=[];
  if(s.status)pills.push(`<span class="pill">✅ ${esc(s.status)}</span>`);
  if(s.chapterCount)pills.push(`<span class="pill">📚 ${esc(s.chapterCount)} chương</span>`);
  for(const g of (s.genres||[]).slice(0,6))pills.push(`<span class="pill">🏷 ${esc(g)}</span>`);
  if(s.audio)pills.push(`<span class="pill">🎧 Có Audio</span>`);

  let info=`Team: ${esc(s.team||"")}<br>Trạng thái: ${esc(s.status||"")}<br>Loại: ${esc(s.type||"")}`;
  if(s.views)info+=`<br>Lượt xem: ${Number(s.views).toLocaleString("vi-VN")}`;
  if(s.genres?.length)info+=`<br>Thể loại: ${s.genres.map(esc).join(" • ")}`;

  const ab=s.audio?`<a class="btn audio" href="${esc(s.audio)}" target="_blank" rel="noopener">🎧 NGHE AUDIO</a>`:"";
  const sa=s.audio?`<a href="${esc(s.audio)}" target="_blank" rel="noopener">🎧<br>Audio</a>`:"<span></span>";
  const ga=s.audio?`<a class="btn secondary" href="${esc(s.audio)}" target="_blank" rel="noopener" onclick="rememberGate()">🎧 NGHE AUDIO</a>`:"";

  const coverSrc=/^https?:\/\//i.test(s.cover||"")?(s.cover||""):`../../${s.cover||""}`;

  const rep={
    "__TITLE__":esc(s.title),
    "__TEAM_URL__":cfg.teamUrl,
    "__COVER_SRC__":coverSrc,
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
  for(const [k,v] of Object.entries(rep))t=t.split(k).join(v);
  return t;
}

await fs.rm(path.join(ROOT,"truyen"),{recursive:true,force:true});
await fs.mkdir(path.join(ROOT,"truyen"),{recursive:true});
for(let i=0;i<stories.length;i++){
  const s=stories[i];
  const dir=path.join(ROOT,"truyen",s.slug);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),renderPage(s));
  if((i+1)%250===0)console.log(`Trang ${i+1}/${stories.length}`);
}

const teamData={
  ...first.team,
  name:"Chuồng nhỏ của Hoài",
  description:"Theo dõi tui để đọc truyện full nhanh chóng.",
  storyCount:first.team.storyCount||String(stories.length),
  facebookLinks:(first.team.facebookLinks||[]).length?first.team.facebookLinks:[
    "https://www.facebook.com/profile.php?id=100081084263207",
    "https://www.facebook.com/profile.php?id=61558321836154"
  ]
};

await fs.writeFile(path.join(ROOT,"data","team.json"),JSON.stringify(teamData,null,2));
await fs.writeFile(path.join(ROOT,"data","stories.json"),JSON.stringify(stories,null,2));
await fs.writeFile(path.join(ROOT,"data","sync-info.json"),JSON.stringify({
  lastSync:new Date().toISOString(),
  totalStories:stories.length,
  source:TEAM_URL,
  listPages:maxPage,
  favorites:favoriteMap.size,
  monthlyHot:monthlyMap.size,
  audioRule:"monkeydd.com -> monkeydaudio.com, giữ nguyên path"
},null,2));

console.log(`HOÀN TẤT: ${stories.length} truyện.`);