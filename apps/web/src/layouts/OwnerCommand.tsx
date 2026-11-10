// Ô lệnh của người quản lý một hội: lệnh theo quyền (lib/commands.ts), cộng hai dòng tìm theo chữ đang gõ
// (tìm thành viên, tìm trong bảng tin) dẫn tới danh sách đã lọc sẵn.
import { Search } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { CommandPalette, type PaletteItem } from '@/components/CommandPalette';
import { ownerCommands } from '@/lib/commands';
import type { Shell } from '@/lib/community';

export function OwnerCommandPalette({ shell, open, onClose }: { shell: Shell; open: boolean; onClose: () => void }) {
  const { slug, tabs } = shell.community;
  const { role, permissions } = shell.viewer;
  const commands = useMemo(() => ownerCommands({ slug, role, permissions, tabs }), [slug, role, permissions, tabs]);
  const canMembers = permissions.includes('member.manage');
  const hasFeed = tabs.feed !== false;
  const extra = useCallback((q: string): PaletteItem[] => {
    if (q.length < 2) return [];
    const term = encodeURIComponent(q);
    const out: PaletteItem[] = [];
    if (canMembers) out.push({ id: 'find-member', group: 'Tìm', label: `Tìm thành viên "${q}"`, hint: 'Theo tên, email hoặc @tên', to: `/${slug}/thanh-vien?q=${term}`, icon: <Search size={18} /> });
    if (hasFeed) out.push({ id: 'find-post', group: 'Tìm', label: `Tìm "${q}" trong bảng tin`, to: `/${slug}/bang-tin?q=${term}`, icon: <Search size={18} /> });
    return out;
  }, [slug, canMembers, hasFeed]);
  return <CommandPalette open={open} onClose={onClose} commands={commands} extra={extra} />;
}
