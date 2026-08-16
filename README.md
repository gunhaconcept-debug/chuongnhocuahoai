# Chuồng nhỏ của Hoài — GitHub Pages V5

Bản này dùng **GitHub + GitHub Pages + GitHub Actions**, không cần Netlify.

## Bật website
1. GitHub repo → **Settings** → **Pages**.
2. Build and deployment → **Source: GitHub Actions**.
3. Vào **Actions** → `Deploy GitHub Pages` → Run workflow (hoặc commit bất kỳ thay đổi nào).

Với repo `gunhaconcept-debug/chuongnhocuahoai`, link dự kiến:
`https://gunhaconcept-debug.github.io/chuongnhocuahoai/`

## Thêm truyện mới — chỉ cần 3 link
1. Vào tab **Actions**.
2. Chọn **Add or update story**.
3. Bấm **Run workflow**.
4. Dán:
   - MonkeyD URL (bắt buộc)
   - Audio / YouTube (có thể trống)
   - Shopee Affiliate (có thể trống; trống sẽ dùng link mặc định)
5. Bấm **Run workflow**.

Workflow sẽ:
- đọc tên truyện từ MonkeyD;
- lấy ảnh bìa;
- lấy trạng thái;
- lấy số chương;
- lấy thể loại;
- tạo URL riêng dưới `/truyen/<slug>/`;
- cập nhật trang chủ;
- tự deploy GitHub Pages.

## Cập nhật tự động
Workflow `Refresh MonkeyD data` chạy mỗi ngày và có nút chạy thủ công.
Nó cập nhật trạng thái/số chương/thể loại/ảnh của các truyện đã có.

## Shopee mặc định
Sửa `data/config.json` nếu muốn đổi link Affiliate toàn site.

## Lưu ý GitHub Pages
Nếu tài khoản GitHub Free và repo đang **Private**, GitHub Pages có thể yêu cầu repo Public.
Repo private dùng Pages tùy gói GitHub.