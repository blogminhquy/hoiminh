---
bump: minor
---

Gói Hội Mình bán theo bốn kỳ với giá riêng từng kỳ, theo yêu cầu của chủ dự án ngày 21/11/2026. Thay luật "chỉ bán hai chu kỳ, giá 3 tháng và 1 năm tự tính từ giá tháng" của kế hoạch 11/11/2026. Có migration `0017_plan_cycle_prices`: thêm cột `plans.cycle_prices` (jsonb) và điền sẵn từ giá cũ, chạy lại được. **Áp dụng lên database thật trước khi merge.**

### Thêm

- **Bốn kỳ trả tiền: 1 tháng, 3 tháng, 6 tháng, 1 năm.** Số ngày của từng kỳ là 30, 90, 180, 365. Gia hạn nối tiếp và nâng gói tặng ngày còn lại vẫn như cũ, dùng được với mọi kỳ.
- **Quản trị nhập giá riêng cho từng kỳ của từng gói** ở Hệ thống, Gói nền tảng. Dưới mỗi ô có ghi giá quy ra mỗi tháng để dễ so.
- **Kỳ nào để giá 0 thì không bán.** Trang mua gói, bảng giá công khai và bước chọn gói khi tạo hội thứ hai chỉ hiện tab của kỳ có ít nhất một gói đang bán; gói không bán kỳ đang chọn thì không có thẻ ở kỳ đó. Gói để 0 ở cả bốn kỳ thì không hiện ở đâu để mua. Gọi thẳng API mua một kỳ có giá 0 cũng bị từ chối.
- **Lời mời tự tính theo giá đã nhập.** "Tặng 2 tháng" không còn viết cứng: mức lợi của kỳ dài tính so với kỳ ngắn nhất gói đang bán, ra số tháng tròn thì ghi "tặng N tháng", không thì ghi "tiết kiệm N%".

### Thay đổi

- **Sau khi cập nhật, trang mua gói chưa đổi gì.** Giá 3 tháng và 1 năm giữ nguyên con số đang bán; 1 tháng và 6 tháng để 0 (trước đây không bán) cho tới khi quản trị nhập giá.
- **Bảng gói có thêm hai luật kiểm tra khi lưu.** Trong một gói, kỳ dài hơn không được có tổng tiền thấp hơn kỳ ngắn hơn (bắt lỗi gõ thiếu một số 0). Gói cao hơn không được rẻ hơn gói thấp hơn ở kỳ mà cả hai cùng bán.
- **Bảng so sánh** có một dòng giá cho mỗi kỳ đang bán, gói không bán kỳ đó ghi "Không bán". Bỏ dòng "Giá niêm yết mỗi tháng".
- **Lời mời nâng gói** ghi "từ ... mỗi tháng" theo kỳ rẻ nhất, và không gợi ý gói đã ngừng bán.
- **Dãy tab kỳ hạn trên điện thoại** thu lề để bốn tab nằm gọn một hàng.
- API: `GET /v1/plans` và `GET /v1/admin/plans` trả `prices` (`monthly`, `quarterly`, `semiannual`, `yearly`) thay cho `monthlyMinor`; `PUT /v1/admin/plans` nhận `prices`; `POST /v1/checkout` cho gói nhận thêm `cycle` là `monthly` và `semiannual`. Số liệu gói trả `cycleCounts` thay cho `quarterlyCount`, `yearlyCount`.

## Quyết định

**Gói Hội Mình bán bốn kỳ, giá từng kỳ nhập riêng, giá 0 là không bán** ({version}, chủ dự án yêu cầu ngày 21/11/2026, thay phần "hai chu kỳ" và "giá tự tính" của mục 68). Giá nằm ở `plans.cycle_prices` (jsonb, bốn khóa `monthly`, `quarterly`, `semiannual`, `yearly`), không thêm bốn cột riêng: thêm kỳ sau này không cần migration. Hai cột cũ `monthly_minor`, `yearly_minor` giữ bản sao giá 1 tháng và 1 năm để không phải xóa dữ liệu; dòng chưa có `cycle_prices` thì đọc theo luật cũ (3 tháng = 3 lần giá tháng, 1 năm = `yearly_minor`). "Không bán" không có cờ riêng mà chính là giá 0: một ô nhập duy nhất, không có hai trạng thái lệch nhau. Mọi chỗ hỏi "kỳ nào đang bán" đi qua các hàm thuần ở `packages/contracts/src/plans.ts` (`planSells`, `planCyclesOf`, `soldCycles`, `pickCycle`), dùng chung cho API và web; checkout chặn lại ở máy chủ (`planQuote` trả `blocked: 'unsold'`) nên ẩn trên giao diện không phải là lớp chặn duy nhất. Migration giữ nguyên những gì đang bán (1 tháng và 6 tháng bằng 0) thay vì tự mở bán kỳ mới với giá suy ra: mở bán một kỳ là quyết định về tiền, để chủ dự án tự nhập. Lời mời ("tặng 2 tháng", "tiết kiệm 17%") tính từ giá đã nhập, so với kỳ ngắn nhất gói đang bán, vì không còn "giá niêm yết mỗi tháng" làm mốc. Doanh thu quy ra tháng ở màn quản trị tính theo giá đang niêm yết của kỳ hội đang trả; kỳ đã ngừng bán thì tính 0 (giống trước đây: không lưu giá lúc mua vào kỳ trả tiền).
