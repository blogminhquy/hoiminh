// Mảnh của trang chứng nhận: tấm chứng chỉ vẽ bằng SVG, các nút tải ảnh, chia sẻ, in, ô link kiểm tra và khối chúc mừng.
// Tấm trên màn hình và ảnh PNG tải về cùng dựng từ một cảnh (lib/certificate-scene) nên giống nhau.
import { T } from '@hoiminh/ui';
import { BadgeCheck, Check, Copy, Download, Link2, PartyPopper, Printer, Share2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourseStats } from '@/components/Celebration';
import { copyText } from '@/lib/affiliate-link';
import { certificateFileName, fmtCertificateDate, formatCertificateCode, shortUrl, type Measure, type TextStyle } from '@/lib/certificate';
import { CERT_FONT, canvasMeasure, loadCertificateFonts, loadLogo, renderCertificatePng, type LoadedLogo } from '@/lib/certificate-canvas';
import { buildCertificateScene, type CertificateData, type Scene, type SceneNode } from '@/lib/certificate-scene';
import { saveBlob } from '@/lib/download';

export interface CertificateDto {
  code: string;
  learner: { id: string; name: string; handle: string };
  course: { id: string; title: string; lessonCount: number; totalDurationSeconds: number };
  owner: string | null;
  community: { name: string; slug: string; logoMark: string; logoColor: string; logoUrl?: string | null } | null;
  completedAt: string;
  verifyUrl: string;
}

export const toCertificateData = (c: CertificateDto): CertificateData => ({
  code: c.code, learnerName: c.learner.name, courseTitle: c.course.title, lessonCount: c.course.lessonCount, totalDurationSeconds: c.course.totalDurationSeconds,
  instructor: c.owner, community: c.community, completedAt: c.completedAt, verifyUrl: c.verifyUrl,
});

export interface CertificateArt {
  scene: Scene;
  /** Phông đã tải xong (hoặc đã hết thời gian chờ): cỡ chữ trong cảnh là cỡ cuối cùng. */
  ready: boolean;
  /** Logo hội đã tải được qua CORS; null là không có hoặc không tải được, khi đó dùng dấu chữ viết tắt. */
  logo: LoadedLogo | null;
  /** Ảnh PNG của tấm chứng chỉ; dựng sẵn ngay khi tấm hiện xong để bấm Chia sẻ không phải chờ. */
  png: () => Promise<File>;
}

/** Dựng cảnh chứng chỉ: chờ phông, tải logo, đo chữ bằng canvas, và chuẩn bị sẵn ảnh PNG. */
export function useCertificateArt(data: CertificateData): CertificateArt {
  const [fontsReady, setFontsReady] = useState(false);
  // Hàm đo đổi danh tính khi phông tải xong: bề ngang chữ lúc đó khác, cảnh phải đo và xếp lại.
  const [measure, setMeasure] = useState<Measure>(() => canvasMeasure);
  const [logo, setLogo] = useState<{ settled: boolean; value: LoadedLogo | null }>({ settled: !data.community?.logoUrl, value: null });
  const logoUrl = data.community?.logoUrl ?? null;
  const sample = `${data.learnerName} ${data.courseTitle} ${data.community?.name ?? ''} ${data.instructor ?? ''} CHỨNG NHẬN HOÀN THÀNH Đã Trân trọng trao cho tháng bài học giờ phút Mã kiểm tra NGÀY GIẢNG VIÊN ĐƠN VỊ CẤP HỘI MÌNH 0123456789`;

  useEffect(() => {
    let alive = true;
    void loadCertificateFonts(sample).then(() => {
      if (!alive) return;
      setMeasure(() => (text: string, style: TextStyle) => canvasMeasure(text, style));
      setFontsReady(true);
    });
    return () => { alive = false; };
  }, [sample]);

  useEffect(() => {
    if (!logoUrl) { setLogo({ settled: true, value: null }); return; }
    let alive = true;
    let loaded: LoadedLogo | null = null;
    void loadLogo(logoUrl).then((l) => {
      loaded = l;
      if (alive) setLogo({ settled: true, value: l });
      else if (l) URL.revokeObjectURL(l.objectUrl);
    });
    return () => { alive = false; if (loaded) URL.revokeObjectURL(loaded.objectUrl); };
  }, [logoUrl]);

  const scene = useMemo(() => buildCertificateScene(data, measure), [data, measure]);
  const ready = fontsReady && logo.settled;

  const cache = useRef<{ key: unknown; file: Promise<File> } | null>(null);
  const render = useRef<() => Promise<File>>(() => Promise.reject(new Error('chưa sẵn sàng')));
  render.current = () => {
    if (cache.current?.key === scene && ready) return cache.current.file;
    const file = renderCertificatePng(scene, logo.value?.image ?? null).then((blob) => new File([blob], certificateFileName(data.learnerName), { type: 'image/png' }));
    if (ready) cache.current = { key: scene, file };
    // Lượt dựng hỏng thì bỏ khỏi bộ nhớ để lần bấm sau dựng lại, không trả mãi một lỗi cũ.
    file.catch(() => { if (cache.current?.file === file) cache.current = null; });
    return file;
  };
  useEffect(() => {
    if (ready) void render.current().catch(() => undefined);
  }, [ready, scene]);

  return { scene, ready, logo: logo.value, png: () => render.current() };
}

function Node({ n, clipId, logoSrc }: { n: SceneNode; clipId: string; logoSrc: string | null }) {
  const [failed, setFailed] = useState(false);
  if (n.t === 'rect') return <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.r} fill={n.fill ?? 'none'} stroke={n.stroke} strokeWidth={n.sw} opacity={n.opacity} />;
  if (n.t === 'circle') return <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill ?? 'none'} stroke={n.stroke} strokeWidth={n.sw} opacity={n.opacity} />;
  if (n.t === 'path') return <path d={n.d} fill={n.fill ?? 'none'} stroke={n.stroke} strokeWidth={n.sw} opacity={n.opacity} strokeLinecap={n.round ? 'round' : undefined} strokeLinejoin={n.round ? 'round' : undefined} />;
  if (n.t === 'text') {
    return (
      <text x={n.x} y={n.y} fontSize={n.size} fontWeight={n.weight} fontStyle={n.italic ? 'italic' : undefined} fill={n.fill} textAnchor={n.anchor} opacity={n.opacity}
        letterSpacing={n.tracking ? n.tracking * n.size : undefined} transform={n.rotate ? `rotate(${n.rotate} ${n.x} ${n.y})` : undefined}>{n.text}</text>
    );
  }
  const src = failed ? null : logoSrc ?? n.url;
  return (
    <g>
      <clipPath id={clipId}><rect x={n.x} y={n.y} width={n.size} height={n.size} rx={n.r} /></clipPath>
      {src ? (
        <g clipPath={`url(#${clipId})`}>
          <rect x={n.x} y={n.y} width={n.size} height={n.size} fill="#FFFFFF" />
          <image href={src} x={n.x} y={n.y} width={n.size} height={n.size} preserveAspectRatio="xMidYMid slice" onError={() => setFailed(true)} />
        </g>
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <rect x={n.x} y={n.y} width={n.size} height={n.size} fill={n.color} />
          <text x={n.x + n.size / 2} y={n.y + n.size / 2 + n.size * 0.15} fontSize={Math.round(n.size * 0.42)} fontWeight={800} fill="#FFFFFF" textAnchor="middle">{n.mark}</text>
        </g>
      )}
    </g>
  );
}

/** Tấm chứng chỉ khổ A4 ngang, co giãn theo bề ngang chỗ chứa mà không vỡ bố cục (SVG có viewBox). */
export function CertificateSheet({ art }: { art: CertificateArt }) {
  const clipId = useId().replace(/:/g, '');
  const { scene } = art;
  return (
    <div className="cert-frame" data-testid="certificate" data-ready={art.ready ? 'true' : 'false'}>
      <svg viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={scene.alt} style={{ display: 'block', width: '100%', height: 'auto', fontFamily: CERT_FONT, opacity: art.ready ? 1 : 0, transition: 'opacity .25s' }}>
        {scene.nodes.map((n, i) => <Node key={i} n={n} clipId={`${clipId}-${i}`} logoSrc={art.logo?.objectUrl ?? null} />)}
      </svg>
    </div>
  );
}

/** Khối chúc mừng phía trên tấm chứng chỉ, chỉ hiện cho chính người học ở đúng lần vừa học xong. */
export function CelebrationHero({ c }: { c: CertificateDto }) {
  return (
    <section className="celebrate-pop cert-noprint flex flex-col items-center text-center gap-3.5 pt-2" data-testid="celebration">
      <span className="inline-flex items-center gap-2 px-4 rounded-full text-[15px] font-bold" style={{ minHeight: 40, background: T.goldSoft, color: T.goldText }}><PartyPopper size={20} />Bạn đã về đích</span>
      <h1 className="serif m-0 text-[28px] md:text-[40px] font-extrabold leading-[1.15]" style={{ color: T.ink, maxWidth: 820 }}>Chúc mừng {c.learner.name.trim()}, bạn đã hoàn thành khóa học!</h1>
      <p className="m-0 text-[17px] md:text-[19px] leading-[1.55]" style={{ color: T.ink2, maxWidth: 720 }}>Bạn vừa học xong toàn bộ <strong style={{ color: T.ink }}>{c.course.title}</strong>{c.community ? <> của {c.community.name}</> : null}. Tấm chứng chỉ dưới đây mang tên bạn.</p>
      <CourseStats lessonCount={c.course.lessonCount} durationSeconds={c.course.totalDurationSeconds} />
    </section>
  );
}

/** Dòng xác thực cho người mở link để kiểm tra: ai, khóa nào, ngày nào. */
export function VerifiedBanner({ c }: { c: CertificateDto }) {
  return (
    <section className="cert-noprint card flex items-start gap-3.5 px-4 py-4 md:px-5" data-testid="verified">
      <span className="w-11 h-11 rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ background: T.tealSoft, color: T.tealText }}><BadgeCheck size={24} /></span>
      <div className="min-w-0">
        <h1 className="m-0 text-[18px] font-bold leading-[1.3]" style={{ color: T.ink }}>Chứng nhận hợp lệ</h1>
        <p className="m-0 mt-1 text-[15px] leading-[1.55]" style={{ color: T.ink2 }}>
          {c.community?.name ?? 'Hội Mình'} xác nhận <strong style={{ color: T.ink }}>{c.learner.name}</strong> đã hoàn thành toàn bộ {c.course.lessonCount} bài của khóa học <strong style={{ color: T.ink }}>{c.course.title}</strong> ngày {fmtCertificateDate(c.completedAt)}.
        </p>
      </div>
    </section>
  );
}

type Notice = { tone: 'ok' | 'error'; text: string } | null;

/** Các nút dưới tấm chứng chỉ. Nút nào cũng chạy thật: tải PNG, chia sẻ (kèm ảnh nếu máy cho phép), in, về khóa học. */
export function CertificateActions({ c, art, celebrate }: { c: CertificateDto; art: CertificateArt; celebrate: boolean }) {
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const say = (n: Notice) => { setNotice(n); if (n) window.setTimeout(() => setNotice((cur) => (cur === n ? null : cur)), 4000); };

  const download = async () => {
    setBusy('download');
    try {
      const file = await art.png();
      saveBlob(file, file.name);
      say({ tone: 'ok', text: 'Đã tải ảnh chứng chỉ về máy.' });
    } catch {
      say({ tone: 'error', text: 'Chưa tạo được ảnh. Bạn thử lại, hoặc dùng nút In hoặc lưu PDF.' });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    const ok = await copyText(c.verifyUrl);
    say(ok ? { tone: 'ok', text: 'Đã sao chép link chứng nhận.' } : { tone: 'error', text: 'Không sao chép được. Bạn bôi đen link ở ô bên dưới để chép.' });
  };

  const share = async () => {
    if (!canShare) return copyLink();
    setBusy('share');
    const title = `Chứng nhận hoàn thành: ${c.course.title}`;
    const text = celebrate ? `Mình vừa hoàn thành khóa học "${c.course.title}"${c.community ? ` tại ${c.community.name}` : ''}.` : `${c.learner.name} đã hoàn thành khóa học "${c.course.title}".`;
    try {
      // Ảnh đã dựng sẵn nên gọi share ngay trong lượt bấm; trình duyệt chặn share nếu chờ quá lâu sau cú bấm.
      const file = await Promise.race([art.png().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title, text: `${text} ${c.verifyUrl}` });
      else await navigator.share({ title, text, url: c.verifyUrl });
    } catch (e) {
      // Người dùng tự đóng bảng chia sẻ thì thôi; lỗi khác thì chép link thay thế.
      if (!(e instanceof DOMException && e.name === 'AbortError')) await copyLink();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cert-noprint flex flex-col items-center gap-3">
      {celebrate && <p className="m-0 text-[16px] md:text-[17px] font-semibold text-center" style={{ color: T.ink }}>Khoe thành quả của bạn: tải ảnh về rồi đăng lên Facebook, Zalo hay LinkedIn.</p>}
      <div className="cert-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => void download()} disabled={busy === 'download'} data-testid="cert-download">
          {busy === 'download' ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Download size={20} />}Tải ảnh
        </button>
        <button type="button" className="btn btn-gold btn-lg" onClick={() => void share()} disabled={busy === 'share'} data-testid="cert-share">
          {canShare ? <Share2 size={20} /> : <Link2 size={20} />}{canShare ? 'Chia sẻ' : 'Sao chép link'}
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => window.print()} data-testid="cert-print"><Printer size={20} />In hoặc lưu PDF</button>
        {c.community && <Link to={`/${c.community.slug}/khoa-hoc/${c.course.id}`} className="btn btn-ghost btn-lg">{celebrate ? 'Về khóa học' : 'Xem khóa học'}</Link>}
      </div>
      <div role="status" aria-live="polite" className="text-[15px] font-semibold" style={{ minHeight: 22, color: notice?.tone === 'error' ? T.accentText : T.tealText }}>{notice?.text ?? ''}</div>
    </section>
  );
}

/** Ô link kiểm tra có nút sao chép, thay cho dòng link dài chạy tràn trang. */
export function VerifyBox({ c }: { c: CertificateDto }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    const ok = await copyText(c.verifyUrl);
    setCopied(ok);
    setFailed(!ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section className="cert-noprint card flex flex-col gap-3 px-4 py-4 md:px-5">
      <div className="flex items-center gap-2 flex-wrap text-[15px]" style={{ color: T.ink2 }}>
        <BadgeCheck size={20} style={{ color: T.teal }} />
        <span>Mã kiểm tra</span>
        <strong className="text-[17px] tracking-[0.04em]" style={{ color: T.ink }}>{formatCertificateCode(c.code)}</strong>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <div className="flex-grow min-w-0 flex items-center px-3.5 rounded-[10px] text-[15px]" style={{ minHeight: 46, background: T.bg, border: `1px solid ${T.line2}`, color: T.ink }}>
          <span className={failed ? 'break-all py-2 select-all' : 'truncate'} title={c.verifyUrl} data-testid="cert-link">{shortUrl(c.verifyUrl)}</span>
        </div>
        <button type="button" className="btn btn-ghost flex-shrink-0" style={{ height: 46 }} onClick={() => void copy()} aria-label="Sao chép link kiểm tra">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Đã chép' : 'Sao chép'}</button>
      </div>
      <p className="m-0 text-[15px] leading-[1.5]" style={{ color: T.ink3 }}>Ai có link này cũng mở được tấm chứng chỉ để kiểm tra. Nội dung lấy thẳng từ tiến độ học trên Hội Mình nên không sửa được bằng cách đổi link.</p>
    </section>
  );
}
