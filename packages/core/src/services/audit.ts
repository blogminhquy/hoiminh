// Nhật ký kiểm toán cho mọi hành động quản trị và tiền (mục 38, 82).
import { auditLogs } from '@hoiminh/db';
import { actorUserId, type Ctx } from '../context';

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  workspaceId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Ghi một dòng audit. Không ném lỗi ra ngoài để không chặn nghiệp vụ chính. */
export async function audit(ctx: Ctx, input: AuditInput): Promise<void> {
  try {
    await ctx.db.insert(auditLogs).values({
      workspaceId: input.workspaceId ?? null,
      communityId: input.communityId ?? null,
      actorUserId: actorUserId(ctx),
      actorType: ctx.actor.type === 'api_key' ? 'api_key' : ctx.actor.type === 'system' ? 'system' : 'user',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      requestId: ctx.requestId,
      ipHash: ctx.ipHash ?? null,
    });
  } catch (err) {
    ctx.log.error('audit.failed', { action: input.action, err: String(err) });
  }
}
