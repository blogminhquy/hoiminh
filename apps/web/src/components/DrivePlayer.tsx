// Khung phát tệp Google Drive trong bài học (video, PDF...), nhúng khung xem trước `/preview` của Drive.
// Chặn người học mở sang Google Drive, nơi có link gốc và nút tải về:
//   1. `sandbox` không có `allow-popups`: nút "Mở trong cửa sổ mới" ở góc khung của Drive bấm không ra gì.
//   2. Một lớp trong suốt đè lên góc trên bên phải, đúng chỗ nút đó, để nó không nhận được cú bấm nào.
//   3. `referrerPolicy="no-referrer"`: Google không thấy địa chỉ trang bài học.
// Giới hạn: trình duyệt tải thẳng từ Google nên người rành kỹ thuật vẫn đọc được địa chỉ khung trong công cụ nhà phát triển.
// Muốn chặn tải kể cả khi lộ link, chủ khóa tắt "Người xem có thể tải xuống" trong cài đặt chia sẻ của tệp trên Drive.
export function DrivePlayer({ src, title }: { src: string; title: string }) {
  return (
    <div className="drive-player" onContextMenu={(e) => e.preventDefault()}>
      <iframe src={src} title={title} sandbox="allow-scripts allow-same-origin" allow="autoplay; encrypted-media; fullscreen" allowFullScreen referrerPolicy="no-referrer" />
      <div className="drive-player-guard" aria-hidden="true" />
    </div>
  );
}
