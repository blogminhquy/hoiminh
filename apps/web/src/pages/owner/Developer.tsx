// Hội của tôi · Nhà phát triển (kiến trúc mục 13): API key, webhook gửi đi, hướng dẫn nối MCP.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { ApiKeysCard, McpCard, WebhooksCard } from './DeveloperParts';
import { WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';

export default function Page() {
  const q = useQuery({ queryKey: WS_HOME_KEY, queryFn: () => api.get<WorkspaceHome>('/v1/me/workspace') });
  return (
    <>
      <div>
        <h1 className="serif m-0 text-[32px] font-extrabold">Nhà phát triển</h1>
        <div className="muted">Nối Hội Mình với công cụ của bạn: API key để gọi REST, webhook để nhận sự kiện, MCP để trợ lý AI thao tác hộ.</div>
      </div>
      <QueryState q={q} rows={3}>
        {(d) =>
          d.workspace ? (
            <>
              <ApiKeysCard workspaceId={d.workspace.id} />
              <WebhooksCard workspaceId={d.workspace.id} />
              <McpCard />
            </>
          ) : (
            <div className="card p-8 text-center">
              <div className="font-semibold">Chưa có hội nào</div>
              <div className="muted text-[13px] mt-1" style={{ color: T.ink2 }}>Tạo hội trước rồi quay lại đây để lấy API key.</div>
            </div>
          )
        }
      </QueryState>
    </>
  );
}
