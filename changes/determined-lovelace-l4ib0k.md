---
bump: patch
---

Sửa lỗi video YouTube của bài học cứ phát ở 360p và chọn chất lượng không đổi gì, theo yêu cầu của chủ dự án ngày 21/11/2026. Không có migration.

### Sửa

- **Video YouTube của bài học không còn bị kẹt ở 360p, chọn chất lượng nào thì đổi đúng mức đó.** Trước đây YouTube tự chọn mức theo cỡ khung nhúng: trình phát cao khoảng 300px (laptop có cột giáo trình, điện thoại) nên chỉ được 240p hoặc 360p, nhìn mờ. Bấm Cài đặt, chọn 720p hay 1080p cũng không đổi gì, vì YouTube đã bỏ lệnh chọn chất lượng cho trình phát nhúng. Nay trang dựng khung YouTube đúng cỡ của mức muốn có rồi thu về vừa trình phát, nên YouTube phát đúng mức đó. Để "Tự động" thì video nét theo màn hình, thấp nhất 720p (mạng yếu YouTube vẫn tự hạ). Đổi chất lượng trong lúc phát thì video nạp lại ngay ở đúng chỗ đang xem, giữ tốc độ đang chọn; đổi lúc đang dừng thì áp dụng khi bấm phát. Mục Chất lượng không còn hiện các mức trên 4K.
- Các nền tảng khác (Vimeo, Bunny, Loom, Facebook, TikTok, Google Drive) và video YouTube ở bài viết, trang giới thiệu, trang sản phẩm dùng trình phát gốc của nền tảng, nút chọn chất lượng là của chính nền tảng đó nên không dính lỗi này. Không đổi gì ở các khung đó.

### Kiểm thử

- `apps/web/src/lib/youtube.test.ts`: mức muốn phát tới, hệ số phóng khung, cách nhận ra YouTube tính theo điểm ảnh thật, danh sách mức bỏ mức trên 4K.
- `e2e/helpers/youtube.ts`: YouTube giả nay chọn mức như YouTube thật (theo cỡ khung, bỏ qua lệnh chọn mức, khung nhỏ lại thì chỉ hạ mức khi nạp lại video). Chạy luồng 16 với trình phát cũ: để Tự động YouTube giả chỉ phát 240p, đúng như lỗi chủ dự án gặp.
- `e2e/tests/16-bai-hoc-video-youtube.spec.ts`: thêm hai luồng. Trình phát nhỏ trên máy tính: Tự động ra 720p, chọn 1080p rồi 360p trong lúc phát thì YouTube đổi đúng mức, khung YouTube to nhỏ thế nào tên video và dải "Video khác" vẫn ngoài vùng nhìn. Màn hình mật độ điểm ảnh 2: YouTube tính theo điểm ảnh thật thì trang tự thu khung lại, chọn 720p, 1080p, 360p đều ra đúng mức. Cả 6 luồng của tệp chạy qua trên Chromium.
- Chưa thử được với YouTube thật (máy chạy thử bị chặn mạng tới YouTube). Cần xem lại trên máy thật sau khi deploy: chọn 1080p rồi 360p, nhìn độ nét và nhãn mức đang phát trong mục Chất lượng.

## Quyết định

**Chất lượng video YouTube đổi bằng cỡ khung nhúng, không bằng lệnh của YouTube** ({version}, chủ dự án yêu cầu ngày 21/11/2026, thay phần chọn chất lượng của mục 59). YouTube đã biến `setPlaybackQuality` và `setPlaybackQualityRange` thành lệnh rỗng cho trình phát nhúng, và tự chọn mức cao nhất vừa cỡ khung. Trang đặt khung YouTube trong một lớp gấp `scale` lần vùng video đang hiện rồi thu về bằng `transform: scale(1/scale)` (`frameScale` trong `apps/web/src/lib/youtube.ts`): YouTube đo khung từ bên trong nên thấy khung lớn, người học thấy khung vừa khít như cũ. Chọn tay được dựng khung nhỏ hơn rồi phóng lên, để chọn 360p ở toàn màn hình vẫn là 360p. "Tự động" nhắm số điểm ảnh thật của vùng video, thấp nhất 720p: video bài học hay có chữ trên slide, 360p đọc không rõ, còn mạng yếu thì YouTube vẫn tự hạ vì cỡ khung chỉ là trần. Trần là 4K, vì khung cao gấp 2,4 lần bề rộng (để giấu tên video và dải "Video khác") nên khung 8K quá lớn với trình duyệt điện thoại. Không chắc YouTube có nhân cỡ khung với mật độ điểm ảnh hay không, nên trang bắt đầu như không nhân (thà nét hơn cần), rồi khi thấy YouTube phát vượt cả khung lớn nhất trang đưa nó trong 60 giây gần nhất thì kết luận là có nhân và thu khung lại (`learnGain`), nhớ cho mọi bài trong lượt mở trang. Đổi mức trong lúc phát thì gọi `loadVideoById` ở chỗ đang xem, vì khung nhỏ lại thì YouTube phát nốt phần đã tải ở mức cũ, người học tưởng bấm không ăn. Vẫn gọi hai lệnh cũ như lời gợi ý, phòng khi YouTube nghe lại.
