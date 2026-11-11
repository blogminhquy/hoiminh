// Nút thu gọn và mở rộng thanh menu bên trái. Kiểu dáng thanh khi thu gọn nằm ở packages/ui/src/styles.css (.app-sidebar[data-collapsed]).
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? 'Mở rộng menu' : 'Thu gọn menu';
  return (
    <button type="button" className="side-toggle" aria-label={label} title={label} aria-expanded={!collapsed} onClick={onToggle}>
      {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
    </button>
  );
}
