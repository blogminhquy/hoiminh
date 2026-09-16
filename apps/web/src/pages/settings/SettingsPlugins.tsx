// Cài đặt · Tiện ích (pluginsMain): danh sách tiện ích bật/tắt; Tin nhắn chào có khung cấu hình mẫu + độ trễ; mục "Sắp ra mắt".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Select, T, Textarea, Toggle } from '@hoiminh/ui';
import { Check, ExternalLink, Globe, Link as LinkIcon, MessageCircle, Sparkles, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useShell } from '@/lib/community';

interface Plugin { pluginKey: string; enabled: boolean; config: Record<string, unknown> }
type Key = 'welcome_dm' | 'instant_approval' | 'links' | 'webhook' | 'meta_pixel';
const DEFS: Array<{ key: Key; icon: ReactNode; bg: string; name: string; desc: string }> = [
  { key: 'welcome_dm', icon: <MessageCircle size={20} />, bg: T.accent, name: 'Tin nhắn chào tự động', desc: 'Nhắn riêng cho người vừa tham gia, thay mặt bạn' },
  { key: 'instant_approval', icon: <Check size={20} />, bg: T.teal, name: 'Tự duyệt tham gia', desc: 'Người xin vào được duyệt ngay, không cần bạn bấm' },
  { key: 'links', icon: <LinkIcon size={20} />, bg: '#7A5C3E', name: 'Liên kết', desc: 'Khối link trong ô giới thiệu: Fanpage, YouTube, Zalo' },
  { key: 'webhook', icon: <ExternalLink size={20} />, bg: T.ink3, name: 'Webhook', desc: 'Thêm thành viên từ hệ thống khác qua một địa chỉ nhận' },
  { key: 'meta_pixel', icon: <Globe size={20} />, bg: '#3E5C7A', name: 'Pixel Facebook', desc: 'Đo đăng ký và thanh toán để chạy quảng cáo' },
];
const SOON = [{ icon: <Video size={20} />, bg: '#5C3E7A', name: 'Video chào', desc: 'Phát một video ở lần đầu thành viên vào' }, { icon: <Sparkles size={20} />, bg: '#5C7A3E', name: 'Zapier và Make', desc: 'Nối với 5.000 ứng dụng khác' }];
const DEFAULT_TEMPLATE = 'Chào {{tên}}, chào mừng bạn đến với {{cộng đồng}}. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.';

function WelcomeConfig({ p, onSave, saving }: { p: Plugin; onSave: (config: Record<string, unknown>) => void; saving: boolean }) {
  const { user } = useAuth();
  const cfg = p.config as { template?: string; delayMinutes?: number };
  const [template, setTemplate] = useState(cfg.template ?? DEFAULT_TEMPLATE);
  const [delay, setDelay] = useState(cfg.delayMinutes ?? 2);
  return (
    <div className="px-4 py-3.5 rounded-[10px] flex flex-col gap-2.5" style={{ background: T.bg }}>
      <div className="flex gap-3 items-center text-[13px] flex-wrap"><span className="muted">Người gửi</span><span className="inline-flex items-center gap-1.5"><Avatar name={user?.name} src={user?.avatarUrl} size={22} />{user?.name}</span><span className="muted md:ml-3">Gửi sau</span><Select value={delay} onChange={(e) => setDelay(Number(e.target.value))} style={{ height: 26, fontSize: 12, width: 110 }}>{[0, 2, 5, 15, 60].map((m) => <option key={m} value={m}>{m === 0 ? 'Ngay' : `${m} phút`}</option>)}</Select></div>
      <Textarea rows={3} value={template} maxLength={1000} onChange={(e) => setTemplate(e.target.value)} style={{ background: T.surface }} />
      <div className="flex items-center gap-2 flex-wrap"><span className="muted text-[12px] flex-grow">Biến có thể dùng: {'{{tên}}'} · {'{{cộng đồng}}'} · {'{{link bắt đầu}}'}</span><Button size="sm" variant="dark" loading={saving} onClick={() => onSave({ template, delayMinutes: delay, includeStartLink: true, senderUserId: user?.id })}>Lưu mẫu</Button></div>
    </div>
  );
}

function PixelConfig({ p, onSave, saving }: { p: Plugin; onSave: (config: Record<string, unknown>) => void; saving: boolean }) {
  const [pixelId, setPixelId] = useState(String((p.config as { pixelId?: string }).pixelId ?? ''));
  return <div className="flex gap-2 items-center"><div className="input flex-grow" style={{ height: 38 }}><input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Pixel ID" className="flex-grow min-w-0" /></div><Button size="sm" variant="dark" loading={saving} onClick={() => onSave({ pixelId })}>Lưu</Button></div>;
}

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['plugins', shell.community.id], queryFn: () => api.get<Plugin[]>(`/v1/communities/${shell.community.id}/plugins`) });
  const m = useMutation({ mutationFn: (p: { key: Key; enabled: boolean; config: Record<string, unknown> }) => api.put(`/v1/communities/${shell.community.id}/plugins/${p.key}`, { enabled: p.enabled, config: p.config }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['plugins'] }) });
  const find = (k: Key): Plugin => q.data?.find((p) => p.pluginKey === k) ?? { pluginKey: k, enabled: false, config: {} };
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Tiện ích</h1><div className="muted text-[13px]">Bật những gì cần, không cần code</div></div>
      {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
      {DEFS.map((d) => {
        const p = find(d.key);
        return (
          <div key={d.key} className="card flex flex-col gap-3.5" style={{ padding: '16px 20px' }}>
            <div className="flex items-center gap-3.5">
              <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: d.bg, color: T.invertInk }}>{d.icon}</span>
              <div className="flex-grow min-w-0"><div className="flex items-center gap-2"><span className="font-semibold">{d.name}</span><span className="text-[12px] font-semibold" style={{ color: p.enabled ? T.teal : T.ink3 }}>{p.enabled ? 'Đang bật' : 'Đang tắt'}</span></div><div className="muted text-[13px]">{d.desc}</div></div>
              <Toggle on={p.enabled} disabled={m.isPending} onChange={(enabled) => m.mutate({ key: d.key, enabled, config: p.config })} />
            </div>
            {d.key === 'welcome_dm' && p.enabled && <WelcomeConfig p={p} saving={m.isPending} onSave={(config) => m.mutate({ key: d.key, enabled: true, config })} />}
            {d.key === 'meta_pixel' && p.enabled && <PixelConfig p={p} saving={m.isPending} onSave={(config) => m.mutate({ key: d.key, enabled: true, config })} />}
            {d.key === 'webhook' && p.enabled && <div className="muted text-[12px]">Tạo địa chỉ nhận và khóa API trong Hội của tôi · Tài khoản · API. Tài liệu: <code>POST /v1/communities/{shell.community.id}/invites</code>.</div>}
          </div>
        );
      })}
      {SOON.map((s) => (
        <div key={s.name} className="card flex items-center gap-3.5" style={{ padding: '16px 20px', opacity: 0.75 }}>
          <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: s.bg, color: T.invertInk }}>{s.icon}</span>
          <div className="flex-grow"><div className="flex items-center gap-2"><span className="font-semibold">{s.name}</span><span className="tag" style={{ background: T.bg, color: T.ink3 }}>Sắp ra mắt</span></div><div className="muted text-[13px]">{s.desc}</div></div>
        </div>
      ))}
    </>
  );
}
