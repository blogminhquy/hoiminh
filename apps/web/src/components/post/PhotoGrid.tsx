// Lưới ảnh kiểu Facebook: 1 ảnh lớn + hàng nhỏ, thừa thì +N (fbGrid trong design/build.mjs).
import { useState } from 'react';
import { T } from '@hoiminh/ui';

export interface GridImage {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

function Photo({ img, h, onClick, overlay }: { img: GridImage; h: number; onClick?: () => void; overlay?: string }) {
  return (
    <button type="button" onClick={onClick} className="relative overflow-hidden rounded-[10px] block w-full" style={{ height: h, background: T.line }} aria-label="Xem ảnh">
      <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center serif font-extrabold text-[26px]" style={{ background: 'rgba(31,27,23,0.55)', color: T.invertInk }}>
          {overlay}
        </span>
      )}
    </button>
  );
}

export function PhotoGrid({ images, compact }: { images: GridImage[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = images.length;
  if (!n) return null;
  const k = compact ? 0.6 : 1;
  const view = (i: number) => () => setOpen(i);
  let body;
  if (n === 1) body = <Photo img={images[0]!} h={360 * k} onClick={view(0)} />;
  else if (n === 2) body = <div className="grid grid-cols-2 gap-1.5">{images.map((im, i) => <Photo key={im.id} img={im} h={260 * k} onClick={view(i)} />)}</div>;
  else if (n === 3)
    body = (
      <div className="flex flex-col gap-1.5">
        <Photo img={images[0]!} h={300 * k} onClick={view(0)} />
        <div className="grid grid-cols-2 gap-1.5">{images.slice(1).map((im, i) => <Photo key={im.id} img={im} h={160 * k} onClick={view(i + 1)} />)}</div>
      </div>
    );
  else {
    const rest = n - 4;
    body = (
      <div className="flex flex-col gap-1.5">
        <Photo img={images[0]!} h={320 * k} onClick={view(0)} />
        <div className="grid grid-cols-3 gap-1.5">
          {images.slice(1, 4).map((im, i) => <Photo key={im.id} img={im} h={140 * k} onClick={view(i + 1)} overlay={i === 2 && rest > 0 ? `+${rest}` : undefined} />)}
        </div>
      </div>
    );
  }
  return (
    <>
      {body}
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(23,19,16,0.92)' }} onClick={() => setOpen(null)} role="dialog">
          <img src={images[open]!.url} alt="" className="max-w-full max-h-full rounded-xl" />
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            {images.map((im, i) => <button key={im.id} type="button" onClick={() => setOpen(i)} className="w-2.5 h-2.5 rounded-full" style={{ background: i === open ? T.surface : 'rgba(255,253,249,0.4)' }} aria-label={`Ảnh ${i + 1}`} />)}
          </div>
        </div>
      )}
    </>
  );
}
