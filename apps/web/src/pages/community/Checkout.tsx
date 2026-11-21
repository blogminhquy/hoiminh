// Thanh toán: /:slug/thanh-toan (chọn gói, cách thanh toán: CheckoutConfigure) và /thanh-toan/:orderId (mã QR hoặc mở cổng,
// chờ xác nhận, thành công: CheckoutOrder). Cả hai đều một cột, xếp từ trên xuống.
import { ErrorBox } from '@hoiminh/ui';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useShellQuery } from '@/lib/community';
import { movedSlugPath } from '@/lib/referral';
import { CheckoutConfigure } from './CheckoutConfigure';
import { OrderView } from './CheckoutOrder';
import { CheckoutFrame } from './CheckoutParts';

export default function Page() {
  const { orderId, slug } = useParams<{ orderId?: string; slug?: string }>();
  const [sp] = useSearchParams();
  const { user, loading } = useAuth();
  const location = useLocation();
  const shell = useShellQuery(orderId ? null : slug);
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (loading) return <CheckoutFrame backTo="/"><LoadingBlock /></CheckoutFrame>;
  if (orderId) return <OrderView orderId={orderId} />;
  if (shell.isLoading) return <CheckoutFrame backTo="/"><LoadingBlock /></CheckoutFrame>;
  if (shell.isError || !shell.data) return <CheckoutFrame backTo="/"><ErrorBox message={errorMessage(shell.error)} /></CheckoutFrame>;
  const moved = movedSlugPath(location, slug, shell.data.community.slug);
  if (moved) return <Navigate to={moved} replace />;
  return <CheckoutConfigure shell={shell.data} tierKey={sp.get('tier')} productId={sp.get('product')} initialCycle={sp.get('cycle')} initialMonths={sp.get('months')} ref={sp.get('ref')} />;
}
