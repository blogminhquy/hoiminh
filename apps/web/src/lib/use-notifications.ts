// Truy vấn thông báo dùng chung cho bảng nổi ở nút chuông và trang /thong-bao. Hai nơi dùng chung một khóa bộ nhớ đệm
// (['notifications', bộ lọc]) nên đọc ở nơi này thì nơi kia cũng đổi theo, và tín hiệu thời gian thực làm mới cả hai.
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api } from './api';
import { applyRead, unreadAfterRead, type NotifFilter, type NotifList } from './notifications';

interface Badges { unreadNotifications: number; unreadMessages: number }

/** Danh sách thông báo theo bộ lọc, phân trang cursor. `enabled` để bảng nổi chỉ tải khi đang mở. */
export function useNotificationPages(filter: NotifFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['notifications', filter],
    queryFn: ({ pageParam }) => api.get<NotifList>(`/v1/me/notifications?filter=${filter}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

/**
 * Đánh dấu đã đọc: truyền id là một thông báo (chỉ gọi cho cái đang chưa đọc), không truyền là tất cả.
 * Số trên chuông và mọi danh sách đang có trong bộ nhớ đệm đổi ngay lúc bấm, rồi tải lại từ máy chủ để khớp số thật
 * (kể cả khi yêu cầu lỗi: tải lại sẽ trả danh sách về đúng trạng thái).
 */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => api.post('/v1/me/notifications/read', id ? { id } : {}),
    onMutate: async (id) => {
      // Dừng các lượt tải đang dở, kẻo kết quả cũ về sau lại ghi đè lên trạng thái vừa đổi.
      await Promise.all([qc.cancelQueries({ queryKey: ['notifications'] }), qc.cancelQueries({ queryKey: ['badges'] })]);
      const at = new Date().toISOString();
      for (const [key, data] of qc.getQueriesData<InfiniteData<NotifList>>({ queryKey: ['notifications'] })) {
        qc.setQueryData(key, applyRead(data, key[1] as NotifFilter, id, at));
      }
      qc.setQueryData<Badges>(['badges'], (b) => (b ? { ...b, unreadNotifications: unreadAfterRead(b.unreadNotifications, id) } : b));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}
