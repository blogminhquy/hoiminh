// Dải gợi ý nhãn ngay trên ô soạn khi chữ đang gõ trùng từ khóa của nhãn (gõ "cảm ơn" là hiện nhãn cảm ơn), như Zalo.
// Chạm một nhãn là gửi nhãn đó thay cho chữ vừa gõ. Bấm X thì ẩn cho tới khi chữ đổi.
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { pushRecent } from './recent';
import { suggestStickers, useStickers } from './stickers';
import type { Sticker } from './types';

export function StickerSuggest({ text, onPick }: { text: string; onPick: (s: Sticker) => void }) {
  const q = useStickers();
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const all = useMemo(() => (q.data?.packs ?? []).flatMap((p) => p.stickers), [q.data]);
  const list = useMemo(() => suggestStickers(text, all), [text, all]);
  if (!list.length || hiddenFor === text) return null;
  return (
    <div className="sticker-suggest" role="group" aria-label="Nhãn dán gợi ý">
      {list.map((s) => (
        <button key={s.id} type="button" aria-label={`Gửi nhãn ${s.keywords[0] ?? ''}`} onClick={() => { pushRecent('sticker', s); onPick(s); }}>
          <img src={s.url} alt="" draggable={false} />
        </button>
      ))}
      <button type="button" className="sticker-suggest-close" aria-label="Ẩn gợi ý nhãn" onClick={() => setHiddenFor(text)}><X size={16} /></button>
    </div>
  );
}
