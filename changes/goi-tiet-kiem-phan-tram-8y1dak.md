---
bump: patch
---

Bảng gói: mức lợi của kỳ dài luôn ghi bằng phần trăm, thẻ bảng giá ghi "Giới hạn N thành viên", làm nổi gói không giới hạn và đưa dòng có dấu tích lên đầu (chủ dự án yêu cầu). Không có migration.

### Thay đổi

- **Mức lợi của kỳ dài luôn ghi bằng phần trăm.** Trước đây giá tròn tháng thì ghi "tặng 2 tháng", lẻ thì ghi phần trăm, nên mỗi chỗ một kiểu. Nay mọi nơi (bảng giá trang tạo hội, nhãn cạnh tab kỳ hạn, bước chọn gói, màn nâng gói) đều ghi "tiết kiệm 17%" hoặc "tiết kiệm tới 33%". Số ngày còn lại của gói cũ khi nâng gói vẫn được cộng như cũ.
- **Bảng giá trang tạo hội.** Dòng thành viên thành một ô: gói có trần ghi "Giới hạn 5.000 thành viên", gói Không giới hạn là ô vàng có biểu tượng vô cực và chữ "Không giới hạn" to. Trong mỗi thẻ, các dòng có dấu tích đứng trước, dòng có ổ khóa xuống cuối. Các thẻ vẫn cao bằng nhau.

## Quyết định

**Mức lợi của kỳ dài chỉ ghi bằng phần trăm, không ghi "tặng N tháng"** ({version}, chủ dự án chốt ngày 23/11/2026). "Tặng N tháng" chỉ đúng khi giá chia tròn tháng, nên lúc tặng tháng lúc phần trăm, người mua khó so. `planSaving` nay luôn trả phần trăm (bỏ kiểu `months`).
