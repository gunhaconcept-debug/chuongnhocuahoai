function decodeEntities(s = "") {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s = "") {
  return decodeEntities(
    s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/section|\/article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
  ).trim();
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}

function nextValue(lines, label) {
  const wanted = label.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === wanted) {
      for (let k = i + 1; k < Math.min(lines.length, i + 6); k++) {
        const v = lines[k].trim();
        if (v) return v;
      }
    }
  }
  return "";
}

function extractTitle(html) {
  const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  if (h2) return stripTags(h2[1]);
  return metaContent(html, "og:title") || "";
}

function extractImage(html, title) {
  const og = metaContent(html, "og:image") || metaContent(html, "twitter:image");
  if (og) return og;

  // Prefer an image whose alt resembles the story title.
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const norm = s => stripTags(s).toLowerCase().replace(/\s+/g, " ").trim();
  const nt = norm(title);

  for (const tag of imgs) {
    const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] || "";
    const src = /(?:src|data-src|data-original)=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (src && alt && (norm(alt) === nt || nt.includes(norm(alt)) || norm(alt).includes(nt))) {
      return decodeEntities(src);
    }
  }

  // Fallback: likely MonkeyD CDN image near the main story area.
  for (const tag of imgs) {
    const src = /(?:src|data-src|data-original)=["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (src && /monkeyd|monkeydarchive|cdn\./i.test(src)) return decodeEntities(src);
  }
  return "";
}

function extractGenres(text, title) {
  const known = [
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

  // Restrict search to a window after the main title to avoid the global menu.
  const idx = text.indexOf(title);
  const segment = idx >= 0 ? text.slice(idx, idx + 2200) : text.slice(0, 2200);
  return known.filter(g => segment.includes(g));
}

function extractChapterCount(html, text, title) {
  // Limit to story area before recommendations.
  let end = html.search(/Truyện Hot Tháng Này/i);
  const pre = end > 0 ? html.slice(0, end) : html;

  // Chapter anchors often display only a number: 6,5,4,3,2,1.
  const nums = [...pre.matchAll(/<a\b[^>]*>\s*(\d{1,4})\s*<\/a>/gi)]
    .map(m => Number(m[1]))
    .filter(n => n > 0 && n < 1000);

  if (nums.length) {
    // Ignore isolated global-navigation numbers by looking for a dense 1..N sequence.
    const unique = [...new Set(nums)];
    const max = Math.max(...unique);
    let consecutive = 0;
    for (let n = 1; n <= max; n++) {
      if (unique.includes(n)) consecutive++;
      else break;
    }
    if (consecutive >= 1) return String(consecutive);
  }
  return "";
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const target = u.searchParams.get("url") || "";

    if (!/^https:\/\/(www\.)?monkeydd\.com\//i.test(target)) {
      return new Response(JSON.stringify({ error: "Invalid MonkeyD URL" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    const r = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "accept-language": "vi-VN,vi;q=0.9,en;q=0.7"
      }
    });

    if (!r.ok) throw new Error(`MonkeyD returned HTTP ${r.status}`);

    const html = await r.text();
    const title = extractTitle(html) || "Truyện MonkeyD";
    const text = stripTags(html);
    const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);

    const result = {
      title,
      image: extractImage(html, title),
      status: nextValue(lines, "Trạng thái"),
      team: nextValue(lines, "Team"),
      type: nextValue(lines, "Loại"),
      genres: extractGenres(text, title),
      chapterCount: extractChapterCount(html, text, title),
      url: target
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
};

export const config = {
  path: "/api/monkeyd-meta"
};