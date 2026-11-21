// Ăn mừng khi học xong một khóa: hoa giấy rơi vài giây, dòng số liệu ngắn, và bảng chúc mừng cho khóa không cấp chứng nhận.
// Hoa giấy tự vẽ bằng CSS (celebration.css), không dùng thư viện; người dùng đặt "giảm chuyển động" thì không hiện.
import { HEX, Modal, T } from '@hoiminh/ui';
import { BookOpenCheck, Clock3, PartyPopper } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtDuration } from '@/lib/format';
import './celebration.css';

const COLORS = [HEX.gold, HEX.primary, HEX.accent, HEX.side, HEX.goldSoft, HEX.primarySoft];

interface Piece { left: number; delay: number; time: number; dx: number; rot: number; w: number; h: number; color: string; round: boolean }

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const size = 7 + Math.random() * 8;
    const round = i % 5 === 0;
    return { left: Math.random() * 100, delay: Math.random() * 1.4, time: 2.6 + Math.random() * 2.2, dx: (Math.random() - 0.5) * 220, rot: (Math.random() - 0.5) * 1440, w: size, h: round ? size : size * (0.4 + Math.random() * 0.5), color: COLORS[i % COLORS.length]!, round };
  });
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Hoa giấy rơi một lượt rồi tự gỡ khỏi trang. Không chặn thao tác (pointer-events: none). */
export function Confetti({ count = 90 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>(() => (reducedMotion() ? [] : makePieces(count)));
  useEffect(() => {
    if (!pieces.length) return;
    const longest = Math.max(...pieces.map((p) => p.delay + p.time));
    const timer = setTimeout(() => setPieces([]), longest * 1000 + 200);
    return () => clearTimeout(timer);
  }, [pieces]);
  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden="true" data-testid="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color, borderRadius: p.round ? '50%' : 2, '--t': `${p.time}s`, '--delay': `${p.delay}s`, '--dx': `${p.dx}px`, '--rot': `${p.rot}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

/** Số liệu ngắn của khóa vừa xong: số bài, và tổng thời lượng nếu khóa có ghi. */
export function CourseStats({ lessonCount, durationSeconds, center = true }: { lessonCount: number; durationSeconds?: number | null; center?: boolean }) {
  const duration = fmtDuration(durationSeconds ?? 0, true);
  const item = (icon: ReactNode, text: string) => (
    <span className="inline-flex items-center gap-2 px-3.5 rounded-full text-[15px] font-semibold" style={{ minHeight: 40, background: T.surface, border: `1px solid ${T.line2}`, color: T.ink }}>{icon}{text}</span>
  );
  return (
    <div className={`flex gap-2.5 flex-wrap ${center ? 'justify-center' : ''}`}>
      {item(<BookOpenCheck size={18} style={{ color: T.teal }} />, `${lessonCount} bài đã học xong`)}
      {duration && item(<Clock3 size={18} style={{ color: T.teal }} />, duration)}
    </div>
  );
}

/** Bảng chúc mừng cho khóa không cấp chứng nhận: lời chúc, số liệu, lối về. Không nhắc tới chứng chỉ. */
export function CourseDoneModal({ open, onClose, courseTitle, lessonCount, durationSeconds, backTo, backLabel }: { open: boolean; onClose: () => void; courseTitle: string; lessonCount: number; durationSeconds?: number | null; backTo: string; backLabel: string }) {
  if (!open) return null;
  return (
    <>
      <Confetti />
      <Modal open onClose={onClose} width={520}>
        <div className="celebrate-pop flex flex-col items-center text-center gap-4 px-6 py-8" data-testid="course-done">
          <span className="w-16 h-16 rounded-full inline-flex items-center justify-center" style={{ background: T.goldSoft, color: T.goldText }}><PartyPopper size={32} /></span>
          <h2 className="serif m-0 text-[26px] font-extrabold leading-[1.2]" style={{ color: T.ink }}>Chúc mừng, bạn đã học xong!</h2>
          <p className="m-0 text-[16px] leading-[1.6]" style={{ color: T.ink2 }}>Bạn đã hoàn thành toàn bộ khóa học <strong style={{ color: T.ink }}>{courseTitle}</strong>. Một chặng đường đáng tự hào.</p>
          <CourseStats lessonCount={lessonCount} durationSeconds={durationSeconds} />
          <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
            <Link to={backTo} className="btn btn-primary btn-lg flex-1">{backLabel}</Link>
            <button type="button" className="btn btn-ghost btn-lg flex-1" onClick={onClose}>Ở lại bài học</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
