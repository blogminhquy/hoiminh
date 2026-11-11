// Thanh menu bên trái (máy tính) thu gọn được: chỉ còn một dải biểu tượng sát mép trái, nội dung trang rộng thêm 192px.
// Lựa chọn được nhớ ở máy (localStorage) và dùng chung cho thanh bên của hội lẫn của khu quản trị hệ thống.
import { useCallback, useState } from 'react';

const KEY = 'hm_side_collapsed';

function read(): boolean {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** [đang thu gọn, đổi trạng thái]. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* chế độ riêng tư không cho lưu: vẫn thu gọn được trong lượt này */ }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}
