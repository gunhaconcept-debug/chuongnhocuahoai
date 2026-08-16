# Chuồng nhỏ của Hoài — GitHub Pages V6

## V6 khác V5
Trang chủ không còn chỉ có truyện nhập tay. Workflow **Sync all MonkeyD stories** sẽ:
1. Mở `https://monkeydd.com/nhom-dich/2837`.
2. Cuộn / bấm "Xem thêm" và theo các trang phân trang được phát hiện.
3. Thu thập toàn bộ link truyện của team.
4. Đọc chi tiết từng truyện: tên, bìa, trạng thái, số chương, thể loại.
5. Tạo trang `/truyen/<slug>/` cho từng truyện.
6. Cập nhật `data/stories.json`.
7. Tự deploy GitHub Pages.

## Chạy đồng bộ
GitHub → Actions → **Sync all MonkeyD stories** → Run workflow.

Lần đầu có thể mất vài phút vì phải đọc toàn bộ kho truyện.
Sau đó workflow được lên lịch chạy hằng ngày.

## Audio riêng của bạn
`data/audio-map.json` chứa:
`slug-truyen: link YouTube/audio`

Khi sync lại, audio trong file này được giữ và gắn vào đúng truyện.

## Shopee
Link mặc định:
`https://s.shopee.vn/5ArjEaR2ZS`

Đổi tại `data/config.json`.

## Nếu không thấy workflow Sync
Do Windows/GitHub upload có thể bỏ qua folder `.github`.
Tạo file trên GitHub:
`.github/workflows/sync-team.yml`

Sau đó copy toàn bộ nội dung file:
`SYNC-TEAM-WORKFLOW.yml`
vào file đó và Commit.