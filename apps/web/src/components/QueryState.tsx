// Trạng thái tải / lỗi / rỗng chuẩn cho mọi màn hình.
import type { UseQueryResult } from '@tanstack/react-query';
import { Empty, ErrorBox, Skeleton } from '@hoiminh/ui';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card p-5 flex flex-col gap-3">
          <Skeleton h={14} w="40%" />
          <Skeleton h={20} w="80%" />
          <Skeleton h={14} />
        </div>
      ))}
    </div>
  );
}

/** Bao một query: loading → skeleton, error → ErrorBox có Thử lại, rỗng → Empty, có dữ liệu → children(data). */
export function QueryState<T>({ q, children, empty, isEmpty, rows }: { q: UseQueryResult<T>; children: (data: T) => ReactNode; empty?: { title?: string; hint?: string; action?: ReactNode }; isEmpty?: (data: T) => boolean; rows?: number }) {
  if (q.isLoading) return <LoadingBlock rows={rows} />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => void q.refetch()} />;
  if (q.data === undefined) return null;
  if (isEmpty?.(q.data)) return <Empty {...(empty ?? {})} />;
  return <>{children(q.data)}</>;
}
