# Chuồng nhỏ của Hoài — GitHub Pages V6.1

## Trang chủ
V6.1 có 3 khu:
1. **Truyện mới nhất** — lấy thứ tự mới nhất từ phần "Danh sách truyện" của trang team MonkeyD.
2. **Truyện có nhiều lượt xem trong tháng** — lấy đúng section tương ứng trên MonkeyD.
3. **Danh sách truyện** — tìm kiếm, lọc thể loại, FULL, Có Audio, phân trang.

## Ảnh bìa
Workflow ưu tiên URL ảnh thật (`data-original` / `data-src`) thay vì spinner lazy-load.
Ảnh được tải về, thu nhỏ và chuyển WebP rồi lưu tại `assets/covers/` để GitHub Pages hiển thị ổn định hơn.
Ảnh đã có sẽ được giữ lại, không tải lại mỗi lần.

## Chạy
GitHub → Actions → **Sync all MonkeyD stories** → Run workflow.

Lần chạy V6.1 đầu tiên sẽ lâu hơn V6 vì phải tải/đổi định dạng ảnh bìa.
Các lần sau nhanh hơn vì ảnh đã tồn tại.

## Audio
Giữ map audio tại `data/audio-map.json`.

## Shopee
Link mặc định trong `data/config.json`.
