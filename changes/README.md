# Phiếu thay đổi

Mỗi nhánh sửa mã trong `apps/` hoặc `packages/` viết **một phiếu** vào thư mục này, thay cho việc tự sửa `CHANGELOG.md`, tự thêm mục vào `DECISIONS.md` và tự tăng số phiên bản.

Lý do: bốn tệp `package.json`, `packages/config/src/version.ts`, `CHANGELOG.md`, `DECISIONS.md` là chỗ mọi nhánh cùng sửa. Hai nhánh làm song song mà cùng sửa thì chắc chắn xung đột, và hay nhận trùng số phiên bản hoặc trùng số mục. Phiếu thì mỗi nhánh một tệp riêng nên không bao giờ đụng nhau. Số phiên bản do phiên merge đóng ngay trước khi merge, lúc đó mới biết chắc số kế tiếp là số nào.

Luật đầy đủ ở `CLAUDE.md`, mục "Làm song song nhiều phiên".

## Cách viết

Tên tệp: `changes/<tên-nhánh>.md` (bỏ phần `claude/`), ví dụ `changes/zen-rubin-isc11b.md`.

```markdown
---
bump: minor
---

Một hai câu tóm tắt: làm gì, theo yêu cầu của ai, có migration không.

### Thêm

- **Tên tính năng.** Mô tả cho người dùng đọc hiểu.

### Sửa

- **Lỗi gì.** Trước thế nào, nay thế nào.

## Quyết định

**Tiêu đề quyết định** ({version}, chủ dự án yêu cầu ngày 21/11/2026). Lý do và cách đã chọn.
```

- `bump` là mức tăng: `patch` (sửa lỗi, chỉnh nhỏ: 1.36.2 lên 1.36.3), `minor` (thêm tính năng: lên 1.37.0), `major` (đổi lớn, phá tương thích: lên 2.0.0).
- Phần thân viết đúng như một mục trong `CHANGELOG.md`, nhưng **không** có dòng `## <số> - <ngày>`. Chỉ dùng tiêu đề cấp 3 (`### Thêm`, `### Sửa`, `### Thay đổi`).
- Phần `## Quyết định` không bắt buộc. Có thì mỗi quyết định mở bằng một tiêu đề in đậm ở đầu dòng. Không tự đánh số.
- `{version}` được thay bằng số phiên bản lúc đóng số. `{muc}` được thay bằng số mục của quyết định đầu tiên trong phiếu (dùng khi phần thân muốn nhắc "xem mục {muc} của DECISIONS").

## Kiểm và đóng số

```bash
pnpm check:parallel
```

Kiểm nhánh có đúng luật không. CI chạy lệnh này ở mọi PR.

```bash
pnpm version:stamp --dry-run
```

Xem trước số phiên bản và mục CHANGELOG sẽ sinh ra, không ghi gì.

```bash
pnpm version:stamp
```

Đóng số: gom các phiếu vào bốn tệp chung, xóa phiếu, commit riêng một commit "Đóng số phiên bản X.Y.Z". **Chỉ phiên merge chạy lệnh này**, sau khi nhánh đã kéo `main` mới nhất về và ngay trước khi merge. Phiên làm việc thường không chạy.
