# Daymark — Habit Tracker MVP

Daymark là website theo dõi thói quen bằng tiếng Anh, có điểm XP, streak và thành tích. Dự án dùng HTML, CSS và JavaScript thuần để dễ học từng phần; GitHub Pages phục vụ giao diện, Supabase lưu tài khoản và dữ liệu trực tuyến.

## MVP hiện có

- Tạo habit quest và tự đặt mục tiêu từ 1 đến 7 ngày hoàn thành mỗi tuần
- Hiển thị đủ 7 ngày (Mon–Sun) cho mỗi quest, mỗi ngày có một ô tick và ngày tháng
- Theo dõi mục tiêu hàng tuần; tuần cũ vẫn xem được và lưu cho thống kê
- Nhận 10 XP mỗi lần check-in; điểm được quy đổi thành level
- Theo dõi streak, lịch sử 4 tuần, tiến độ tuần và 4 huy hiệu
- Đăng nhập bằng email/mật khẩu với Supabase
- Tách dữ liệu theo tài khoản bằng Row Level Security
- Giao diện thích ứng với màn hình máy tính và điện thoại
- Chế độ xem thử trước khi cấu hình Supabase

## Lộ trình phát triển

| Chặng | Việc cần làm | Kết quả |
| --- | --- | --- |
| 1. Chốt MVP | Hoàn thiện dashboard, check-in, XP, streak, thành tích và bố cục responsive | Có phiên bản đầu để dùng thử |
| 2. Bật database online | Tạo Supabase, chạy `supabase/schema.sql`, điền URL và public anon key vào `config.js` | Tài khoản lưu dữ liệu cá nhân trên mạng |
| 3. Học và chỉnh giao diện | Sửa nội dung trong `index.html`, màu và khoảng cách trong `styles.css`; đọc `render()`, `toggleHabit()`, `addHabit()` trong `app.js` | Có thể tự sửa các phần nhỏ mà chưa cần viết lại ứng dụng |
| 4. Mở rộng sau MVP | Thêm sửa/lưu trữ thói quen, chọn ngày lặp, lịch sử chi tiết và đặt lại mật khẩu | Trải nghiệm đầy đủ hơn, sau khi MVP ổn định |
| 5. Phát hành | Đưa nội dung thư mục này lên GitHub, bật Pages, thêm URL Pages vào Supabase Auth | Website hoạt động trên đường dẫn GitHub Pages |

## Bắt đầu với Supabase

1. Tạo một project Supabase.
2. Với project mới, mở **SQL Editor** và chạy `supabase/schema.sql`. Nếu đã dùng phiên bản Daymark trước đây, chạy `supabase/migrations/20261114_habit_quests.sql` để thêm mục tiêu tuần mà giữ nguyên check-in cũ.
3. Trong cài đặt API của project, lấy **Project URL** và **anon/publishable key**; dán vào `config.js`.
4. Trong cài đặt Supabase Auth, thêm URL GitHub Pages vào danh sách **Allowed redirect URLs**.
5. Đưa các file trong thư mục này lên GitHub Pages. Tạo tài khoản Daymark; thói quen và check-in sẽ được lưu online.

Public anon/publishable key được thiết kế để dùng trong ứng dụng trình duyệt; các chính sách RLS trong schema giới hạn mỗi tài khoản vào dữ liệu của chính họ. Không bao giờ đưa `service_role` key hoặc secret key vào `config.js` hay repository.

## Phát hành lên GitHub Pages

Đặt nội dung thư mục này ở thư mục gốc của repository GitHub. Workflow trong `.github/workflows/deploy-pages.yml` sẽ phát hành lại website mỗi khi có thay đổi trên nhánh `main`. Trong **Settings → Pages**, chọn **GitHub Actions** làm nguồn. Sau lần phát hành đầu, thêm URL website vào danh sách redirect cho Supabase Auth.

## Phạm vi MVP

Mỗi habit quest có một mục tiêu từ 1 đến 7 ngày và một ô tick cho từng ngày từ Mon đến Sun. Mỗi ngày có tối đa một dấu tick cho mỗi quest; đạt hoặc vượt mục tiêu sẽ thể hiện trong tiến độ mà không tạo thêm ô. Tuần mới hiển thị bảy ngày mới, còn các tuần cũ tiếp tục được lưu để xem và thống kê. Mỗi check-in nhận cố định 10 XP, và streak tính theo ngày có ít nhất một check-in. Dữ liệu xem thử chỉ nằm trong bộ nhớ của trang và sẽ mất khi tải lại; đây không phải tài khoản online. Sau khi cấu hình Supabase, ứng dụng yêu cầu đăng nhập và đọc/ghi dữ liệu của tài khoản trên database.

