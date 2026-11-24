// Chứng nhận hoàn thành khóa học: trang công khai, ai có link cũng kiểm tra được. Tấm chứng chỉ khổ A4 ngang
// tải được thành ảnh, chia sẻ được, in được. Vừa học xong bài cuối thì trang mở ở chế độ chúc mừng (?chuc-mung=1).
// Dưới chứng chỉ: chính người học thấy khối giới thiệu khóa học (link chứng nhận họ chia sẻ cũng kèm mã của họ), người
// khác thấy lời mời học khóa (CertificateShare.tsx).
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Confetti } from '@/components/Celebration';
import { LoadingBlock, QueryState } from '@/components/QueryState';
import { PublicHeader } from '@/layouts/PublicHeader';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { wantsCelebration } from '@/lib/certificate';
import { CelebrationHero, CertificateActions, CertificateSheet, VerifiedBanner, VerifyBox, toCertificateData, useCertificateArt, type CertificateDto } from './CertificateParts';
import { CertificateInvite, CertificateReferralBlock, useCertificateReferral } from './CertificateShare';
import './certificate.css';

// Bản in: đúng một trang A4 ngang, không lề, để tấm chứng chỉ phủ kín trang.
const PRINT_PAGE = '@media print { @page { size: A4 landscape; margin: 0; } }';
/** Số lần tự thử lại khi vừa học xong mà chứng nhận chưa đọc được (máy chủ ghi tiến độ chậm hơn lượt chuyển trang). */
const CELEBRATE_RETRIES = 5;

/** `viewerKnown`: đã biết ai đang xem (đăng nhập xong), để người học không thấy lời mời dành cho người khác chớp lên trước. */
function View({ c, celebrate, isLearner, viewerKnown }: { c: CertificateDto; celebrate: boolean; isLearner: boolean; viewerKnown: boolean }) {
  const data = useMemo(() => toCertificateData(c), [c]);
  const art = useCertificateArt(data);
  const referral = useCertificateReferral(c, isLearner);
  return (
    <>
      {celebrate && <Confetti />}
      {celebrate ? <CelebrationHero c={c} /> : <VerifiedBanner c={c} />}
      <CertificateSheet art={art} />
      <CertificateActions c={c} art={art} celebrate={celebrate} url={referral.shareUrl} />
      {isLearner ? <CertificateReferralBlock c={c} r={referral} /> : viewerKnown && <CertificateInvite c={c} />}
      <VerifyBox c={c} url={referral.shareUrl} />
    </>
  );
}

export default function Page() {
  const { courseId = '', userId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // Đọc tham số chúc mừng đúng một lần lúc mở trang, rồi gỡ khỏi địa chỉ: tải lại trang hay chép link đi nơi khác
  // thì không chạy lại hiệu ứng.
  const [asked] = useState(() => wantsCelebration(location.search));
  useEffect(() => {
    if (wantsCelebration(location.search)) navigate({ pathname: location.pathname }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  // Lời chúc chỉ dành cho chính người học; người khác mở link có tham số vẫn chỉ thấy trang kiểm tra.
  const celebrate = asked && !loading && user?.id === userId;

  const q = useQuery({
    queryKey: ['certificate', courseId, userId],
    queryFn: () => api.get<CertificateDto>(`/v1/courses/${courseId}/certificate/${userId}`),
    // Bình thường không thử lại (chưa hoàn thành, khóa tắt chứng nhận là câu trả lời thật). Riêng lúc vừa học xong
    // thì chờ và thử lại vài lần thay vì báo "chưa hoàn thành".
    retry: (count, err) => asked && count < CELEBRATE_RETRIES && err instanceof ApiError && err.status === 404,
    retryDelay: (attempt) => Math.min(600 * (attempt + 1), 2500),
  });

  return (
    <div className="cert-page min-h-screen" style={{ background: T.bg }}>
      <style>{PRINT_PAGE}</style>
      <div className="cert-noprint"><PublicHeader /></div>
      <main className="cert-main mx-auto px-4 py-6 md:py-9 flex flex-col gap-5 md:gap-6" style={{ maxWidth: 1040 }}>
        {asked && q.isLoading ? (
          <div className="flex flex-col gap-4" data-testid="certificate-preparing">
            <p className="m-0 text-center text-[17px] font-semibold" style={{ color: T.ink }}>Đang chuẩn bị chứng chỉ của bạn…</p>
            <LoadingBlock rows={3} />
          </div>
        ) : (
          <QueryState q={q} rows={4}>{(c) => <View c={c} celebrate={celebrate} isLearner={!loading && user?.id === c.learner.id} viewerKnown={!loading} />}</QueryState>
        )}
      </main>
    </div>
  );
}
