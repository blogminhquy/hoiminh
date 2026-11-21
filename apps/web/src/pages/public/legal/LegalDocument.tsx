// Khung dựng một trang pháp lý từ dữ liệu (`terms.ts`, `privacy.ts`): tiêu đề, ngày cập nhật, mục lục bấm nhảy tới
// từng phần, các phần đánh số, và hai link chéo ở cuối trang. Trang công khai, không cần đăng nhập.
// Chữ thân bài 17px, giãn dòng 1.7, bề ngang phần chữ tối đa 720px (752px gồm lề hai bên) để dễ đọc trên điện thoại.
import { T } from '@hoiminh/ui';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PublicHeader } from '@/layouts/PublicHeader';
import { legalContact } from './contact';
import { parseInline } from './inline';
import type { LegalBlock, LegalDoc } from './types';

const LINK = 'font-semibold underline underline-offset-[3px]';
const BODY = 'm-0 text-[17px] leading-[1.7]';

/** Chữ có `**đậm**` và `[link](đường dẫn)`: link trong Hội Mình đi bằng router, link ngoài mở thẻ mới. */
function Inline({ text }: { text: string }): ReactNode {
  return parseInline(text).map((part, i) => {
    if (part.kind === 'text') return part.text;
    if (part.kind === 'bold') return <strong key={i} className="font-bold">{part.text}</strong>;
    if (part.href.startsWith('/')) return <Link key={i} to={part.href} className={LINK}>{part.text}</Link>;
    if (part.href.startsWith('mailto:')) return <a key={i} href={part.href} className={LINK}>{part.text}</a>;
    return <a key={i} href={part.href} target="_blank" rel="noreferrer" className={LINK}>{part.text}</a>;
  });
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="m-0 pl-[22px] flex flex-col gap-2 text-[17px] leading-[1.7]" style={{ listStyle: 'disc' }}>
      {items.map((item, i) => <li key={i} className="pl-0.5"><Inline text={item} /></li>)}
    </ul>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'p') return <p className={BODY}><Inline text={block.text} /></p>;
  if (block.type === 'h') return <h3 className="m-0 mt-2 text-[18px] leading-[1.4] font-bold"><Inline text={block.text} /></h3>;
  if (block.type === 'list') return <List items={block.items} />;
  if (block.type === 'note') {
    return (
      <p className={`${BODY} rounded-[12px] px-4 py-3.5`} style={{ background: T.primarySoft, borderLeft: `3px solid ${T.primary}` }}>
        <Inline text={block.text} />
      </p>
    );
  }
  const contact = legalContact();
  return (
    <>
      <p className={BODY}><Inline text={contact.lead} /></p>
      <List items={contact.items} />
    </>
  );
}

const DOCS = [
  { path: '/dieu-khoan', label: 'Điều khoản sử dụng' },
  { path: '/quyen-rieng-tu', label: 'Chính sách quyền riêng tư' },
] as const;

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const { hash } = useLocation();

  useEffect(() => {
    const before = document.title;
    document.title = `${doc.title} · Hội Mình`;
    return () => { document.title = before; };
  }, [doc.title]);

  // Trang tải theo kiểu lazy nên lúc trình duyệt tìm neo thì phần đó chưa có: tự cuộn tới neo sau khi dựng xong.
  // Chuyển qua lại giữa hai trang (không có neo) thì về đầu trang.
  useEffect(() => {
    let id = '';
    try { id = decodeURIComponent(hash.slice(1)); } catch { /* neo hỏng: coi như không có */ }
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [doc.path, hash]);

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <PublicHeader />
      <main className="mx-auto px-4 pt-8 pb-16 md:pt-12 flex flex-col gap-6" style={{ maxWidth: 752, color: T.ink, overflowWrap: 'anywhere' }}>
        <header className="flex flex-col gap-2">
          <h1 className="serif m-0 text-[30px] md:text-[38px] leading-[1.2] font-extrabold">{doc.title}</h1>
          <div className="text-[15px]" style={{ color: T.ink3 }}>Cập nhật lần cuối: {doc.updatedAt}</div>
        </header>

        <div className="flex flex-col gap-3">
          {doc.intro.map((text, i) => <p key={i} className={BODY}><Inline text={text} /></p>)}
        </div>

        <nav id="muc-luc" aria-label="Mục lục" className="card px-5 py-4 flex flex-col gap-2" style={{ scrollMarginTop: 16 }}>
          <div className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>Mục lục</div>
          <ol className="m-0 p-0 sm:columns-2 sm:gap-x-6" style={{ listStyle: 'none' }}>
            {doc.sections.map((s, i) => (
              <li key={s.id} className="break-inside-avoid">
                <a href={`#${s.id}`} className="flex gap-2 py-1.5 text-[16px] leading-[1.45] font-medium">
                  <span className="flex-shrink-0 text-right" style={{ width: 24, color: T.ink3 }}>{i + 1}.</span>
                  <span>{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-tieu-de`} className="flex flex-col gap-3.5 pt-4" style={{ scrollMarginTop: 8 }}>
            <h2 id={`${s.id}-tieu-de`} className="serif m-0 text-[22px] md:text-[25px] leading-[1.3] font-extrabold">{i + 1}. {s.title}</h2>
            {s.blocks.map((block, j) => <Block key={j} block={block} />)}
          </section>
        ))}

        <footer className="mt-6 pt-6 flex flex-col gap-3 text-[16px]" style={{ borderTop: `1px solid ${T.line}` }}>
          <nav aria-label="Trang liên quan" className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2.5">
            {DOCS.map((d) => <Link key={d.path} to={d.path} aria-current={d.path === doc.path ? 'page' : undefined} className={LINK}>{d.label}</Link>)}
            <a href="#muc-luc" className={LINK}>Về mục lục</a>
            <Link to="/" className={LINK}>Trang chủ Hội Mình</Link>
          </nav>
          <div className="text-[14px]" style={{ color: T.ink3 }}>© 2026 Hội Mình</div>
        </footer>
      </main>
    </div>
  );
}
