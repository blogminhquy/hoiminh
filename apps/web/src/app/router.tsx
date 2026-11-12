// Bảng route: công khai, chủ hội (/admin), hội (/:slug/..., gồm Tiền, Cộng sự và Cài đặt 4 nhóm của người quản lý), Khu học tập người mua lẻ (/hoc), tài khoản, quản trị hệ thống (/he-thong).
import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams, type RouteObject } from 'react-router-dom';
import { InstallGate } from '@/components/InstallGate';
import { FeatureGate } from '@/components/PlanGate';
import { LoadingBlock } from '@/components/QueryState';
import { AdminShell } from '@/layouts/AdminShell';
import { AppShell } from '@/layouts/AppShell';
import { AccountShell, LearnerShell } from '@/layouts/LearnerShell';
import { WorkspaceShell } from '@/layouts/WorkspaceShell';

// InstallGate bọc mọi khu vực của người đã đăng nhập (trừ Quản trị hệ thống): trên điện thoại, từ lần vào thứ hai,
// phải thêm Hội Mình ra màn hình chính. Các trang công khai (trang chủ, đăng nhập, thanh toán) không đi qua cổng này.
const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(loader);
  return (
    <Suspense fallback={<div className="p-6"><LoadingBlock /></div>}>
      <C />
    </Suspense>
  );
};

/** Đường dẫn cũ trong hội (link đã lưu, thông báo đã gửi) chuyển sang trang mới cùng hội. */
function SlugRedirect({ to }: { to: string }) {
  const { slug } = useParams();
  return <Navigate to={`/${slug}/${to}`} replace />;
}

const publicRoutes: RouteObject[] = [
  { path: '/', element: page(() => import('@/pages/public/Home')) },
  { path: '/kham-pha', element: page(() => import('@/pages/public/Discovery')) },
  { path: '/dang-nhap', element: page(() => import('@/pages/public/Login')) },
  { path: '/dang-ky', element: page(() => import('@/pages/public/Register')) },
  { path: '/quen-mat-khau', element: page(() => import('@/pages/public/ForgotPassword')) },
  { path: '/quen-mat-khau/da-gui', element: page(() => import('@/pages/public/ForgotSent')) },
  { path: '/dat-lai-mat-khau', element: page(() => import('@/pages/public/ResetPassword')) },
  { path: '/xac-minh-email', element: page(() => import('@/pages/public/VerifyEmail')) },
  { path: '/kich-hoat', element: page(() => import('@/pages/public/Activate')) },
  { path: '/vao', element: page(() => import('@/pages/public/LoginLink')) },
  { path: '/auth/callback', element: page(() => import('@/pages/public/AuthCallback')) },
  { path: '/tao-hoi', element: page(() => import('@/pages/public/SignupLanding')) },
  { path: '/tao-hoi/goi', element: page(() => import('@/pages/public/SignupPlan')) },
  { path: '/thanh-toan/:orderId', element: page(() => import('@/pages/community/Checkout')) },
  { path: '/chung-nhan/:courseId/:userId', element: page(() => import('@/pages/public/Certificate')) },
];

const ownerRoutes: RouteObject = {
  element: <InstallGate><WorkspaceShell /></InstallGate>,
  children: [
    { path: '/admin', element: page(() => import('@/pages/owner/WorkspaceHome')) },
    { path: '/admin/tao-hoi', element: page(() => import('@/pages/owner/WorkspaceCreate')) },
    { path: '/admin/goi', element: page(() => import('@/pages/owner/WorkspacePlan')) },
    { path: '/admin/nha-phat-trien', element: page(() => import('@/pages/owner/Developer')) },
  ],
};

// Khu học tập của người mua lẻ (V2, mục 153): chạy ngoài khung hội, dùng được khi người dùng không thuộc hội nào.
const learnerRoutes: RouteObject = {
  element: <InstallGate><LearnerShell /></InstallGate>,
  children: [
    { path: '/hoc', element: page(() => import('@/pages/learner/Library')) },
    { path: '/hoc/bai/:lessonId', element: page(() => import('@/pages/community/Classroom')) },
  ],
};

const accountRoutes: RouteObject = {
  element: <InstallGate><AccountShell /></InstallGate>,
  children: [
    { path: '/tin-nhan', element: page(() => import('@/pages/account/Messages')) },
    { path: '/thong-bao', element: page(() => import('@/pages/account/Notifications')) },
    { path: '/u/:handle', element: page(() => import('@/pages/account/Profile')) },
    {
      element: page(() => import('@/pages/account/AccountLayout')),
      children: [
        { path: '/tai-khoan', element: page(() => import('@/pages/account/AccountHome')) },
        { path: '/tai-khoan/ho-so', element: page(() => import('@/pages/account/ProfileEdit')) },
        { path: '/tai-khoan/goi', element: page(() => import('@/pages/account/AccountBilling')) },
        { path: '/tai-khoan/cong-su', element: page(() => import('@/pages/account/AffiliateWallet')) },
        { path: '/tai-khoan/cong-su/:programId', element: page(() => import('@/pages/account/AffiliateWallet')) },
      ],
    },
  ],
};

const communityRoutes: RouteObject = {
  path: '/:slug',
  children: [
    { index: true, element: page(() => import('@/pages/public/CommunityAbout')) },
    { path: 'thanh-toan', element: page(() => import('@/pages/community/Checkout')) },
    {
      element: <InstallGate><AppShell /></InstallGate>,
      children: [
        { path: 'hom-nay', element: page(() => import('@/pages/community/Today')) },
        { path: 'bang-tin', element: page(() => import('@/pages/community/Feed')) },
        { path: 'bang-tin/moi', element: page(() => import('@/pages/community/Feed')) },
        { path: 'bai-viet/:postId', element: page(() => import('@/pages/community/PostDetail')) },
        { path: 'khoa-hoc', element: page(() => import('@/pages/community/Courses')) },
        { path: 'khoa-hoc/moi', element: page(() => import('@/pages/community/CourseCreate')) },
        { path: 'khoa-hoc/:courseId', element: page(() => import('@/pages/community/CourseOverview')) },
        { path: 'khoa-hoc/:courseId/sua', element: page(() => import('@/pages/community/CourseCreate')) },
        { path: 'khoa-hoc/:courseId/soan', element: page(() => import('@/pages/community/CourseBuilder')) },
        { path: 'bai/:lessonId', element: page(() => import('@/pages/community/Classroom')) },
        { path: 'cua-hang', element: page(() => import('@/pages/community/Store')) },
        { path: 'cua-hang/moi', element: page(() => import('@/pages/community/ProductCreate')) },
        { path: 'cua-hang/:productSlug/sua', element: page(() => import('@/pages/community/ProductCreate')) },
        { path: 'cua-hang/:productSlug', element: page(() => import('@/pages/community/ProductDetail')) },
        { path: 'su-kien', element: page(() => import('@/pages/community/Events')) },
        { path: 'su-kien/moi', element: page(() => import('@/pages/community/EventCreate')) },
        { path: 'su-kien/:eventId', element: page(() => import('@/pages/community/EventDetail')) },
        { path: 'su-kien/:eventId/sua', element: page(() => import('@/pages/community/EventCreate')) },
        { path: 'xep-hang', element: page(() => import('@/pages/community/Leaderboard')) },
        { path: 'thanh-vien', element: page(() => import('@/pages/community/Members')) },
        { path: 'tien', element: page(() => import('@/pages/community/Money')) },
        { path: 'cong-su', element: page(() => import('@/pages/community/Partners')) },
        { path: 'doanh-thu', element: <SlugRedirect to="tien" /> },
        { path: 'cai-dat/thanh-toan', element: <SlugRedirect to="tien" /> },
        { path: 'cai-dat/cong-su/rut-tien', element: <SlugRedirect to="cong-su" /> },
        {
          path: 'cai-dat',
          element: page(() => import('@/pages/settings/SettingsLayout')),
          children: [
            { index: true, element: page(() => import('@/pages/settings/SettingsHome')) },
            { path: 'chung', element: page(() => import('@/pages/settings/SettingsGeneral')) },
            { path: 'bang-tin', element: page(() => import('@/pages/settings/SettingsFeed')) },
            { path: 'gia', element: page(() => import('@/pages/settings/SettingsPricing')) },
            { path: 'nhan-tien', element: page(() => import('@/pages/settings/SettingsPayout')) },
            { path: 'cong-su', element: <FeatureGate feature="affiliate">{page(() => import('@/pages/settings/SettingsAffiliate'))}</FeatureGate> },
            { path: 'tien-ich', element: page(() => import('@/pages/settings/SettingsPlugins')) },
            { path: 'nguon-dong-bo', element: <FeatureGate feature="automation">{page(() => import('@/pages/settings/SettingsSources'))}</FeatureGate> },
            { path: 'quy-tac', element: <FeatureGate feature="automation">{page(() => import('@/pages/settings/SettingsRules'))}</FeatureGate> },
            { path: 'lien-he', element: <FeatureGate feature="automation">{page(() => import('@/pages/settings/SettingsContacts'))}</FeatureGate> },
            { path: 'nha-phat-trien', element: <FeatureGate feature="api">{page(() => import('@/pages/owner/Developer'))}</FeatureGate> },
          ],
        },
      ],
    },
  ],
};

const adminRoutes: RouteObject = {
  path: '/he-thong',
  element: <AdminShell />,
  children: [
    { index: true, element: page(() => import('@/pages/admin/AdminOverview')) },
    { path: 'hoi', element: page(() => import('@/pages/admin/AdminCommunities')) },
    { path: 'nguoi-dung', element: page(() => import('@/pages/admin/AdminUsers')) },
    { path: 'thanh-toan', element: page(() => import('@/pages/admin/AdminPayments')) },
    { path: 'goi', element: page(() => import('@/pages/admin/AdminPlans')) },
    { path: 'cong-su', element: page(() => import('@/pages/admin/AdminAffiliate')) },
    { path: 'tinh-nang', element: page(() => import('@/pages/admin/AdminPlans')) },
    { path: 'phien-ban', element: page(() => import('@/pages/admin/AdminVersions')) },
    { path: 'ha-tang', element: page(() => import('@/pages/admin/AdminInfra')) },
    { path: 'nhat-ky', element: page(() => import('@/pages/admin/AdminLogs')) },
    { path: 'ho-tro', element: page(() => import('@/pages/admin/AdminCommunities')) },
    { path: 'bao-cao', element: page(() => import('@/pages/admin/AdminUserReports')) },
  ],
};

export const router = createBrowserRouter([
  { element: <Outlet />, children: [...publicRoutes, ownerRoutes, learnerRoutes, accountRoutes, adminRoutes, communityRoutes] },
]);
