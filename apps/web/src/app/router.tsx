// Bảng route: công khai, chủ hội (/admin), hội (/:slug/...), Khu học tập người mua lẻ (/hoc), tài khoản, quản trị hệ thống (/he-thong).
import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { AdminShell } from '@/layouts/AdminShell';
import { AppShell } from '@/layouts/AppShell';
import { AccountShell, LearnerShell } from '@/layouts/LearnerShell';
import { WorkspaceShell } from '@/layouts/WorkspaceShell';

const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(loader);
  return (
    <Suspense fallback={<div className="p-6"><LoadingBlock /></div>}>
      <C />
    </Suspense>
  );
};

const publicRoutes: RouteObject[] = [
  { path: '/', element: page(() => import('@/pages/public/Home')) },
  { path: '/kham-pha', element: page(() => import('@/pages/public/Discovery')) },
  { path: '/dang-nhap', element: page(() => import('@/pages/public/Login')) },
  { path: '/dang-ky', element: page(() => import('@/pages/public/Register')) },
  { path: '/quen-mat-khau', element: page(() => import('@/pages/public/ForgotPassword')) },
  { path: '/quen-mat-khau/da-gui', element: page(() => import('@/pages/public/ForgotSent')) },
  { path: '/dat-lai-mat-khau', element: page(() => import('@/pages/public/ResetPassword')) },
  { path: '/xac-minh-email', element: page(() => import('@/pages/public/VerifyEmail')) },
  { path: '/auth/callback', element: page(() => import('@/pages/public/AuthCallback')) },
  { path: '/tao-hoi', element: page(() => import('@/pages/public/SignupLanding')) },
  { path: '/tao-hoi/goi', element: page(() => import('@/pages/public/SignupPlan')) },
  { path: '/thanh-toan/:orderId', element: page(() => import('@/pages/community/Checkout')) },
];

const ownerRoutes: RouteObject = {
  element: <WorkspaceShell />,
  children: [
    { path: '/admin', element: page(() => import('@/pages/owner/WorkspaceHome')) },
    { path: '/admin/tao-hoi', element: page(() => import('@/pages/owner/WorkspaceCreate')) },
    { path: '/admin/goi', element: page(() => import('@/pages/owner/WorkspaceHome')) },
  ],
};

// Khu học tập của người mua lẻ (V2, mục 153): chạy ngoài khung hội, dùng được khi người dùng không thuộc hội nào.
const learnerRoutes: RouteObject = {
  element: <LearnerShell />,
  children: [
    { path: '/hoc', element: page(() => import('@/pages/learner/Library')) },
    { path: '/hoc/bai/:lessonId', element: page(() => import('@/pages/community/Classroom')) },
  ],
};

const accountRoutes: RouteObject = {
  element: <AccountShell />,
  children: [
    { path: '/tin-nhan', element: page(() => import('@/pages/account/Messages')) },
    { path: '/thong-bao', element: page(() => import('@/pages/account/Notifications')) },
    { path: '/u/:handle', element: page(() => import('@/pages/account/Profile')) },
    {
      element: page(() => import('@/pages/account/AccountLayout')),
      children: [
        { path: '/tai-khoan', element: <Navigate to="/tai-khoan/goi" replace /> },
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
      element: <AppShell />,
      children: [
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
        { path: 'cua-hang/:productSlug', element: page(() => import('@/pages/community/ProductDetail')) },
        { path: 'su-kien', element: page(() => import('@/pages/community/Events')) },
        { path: 'su-kien/moi', element: page(() => import('@/pages/community/EventCreate')) },
        { path: 'su-kien/:eventId', element: page(() => import('@/pages/community/EventDetail')) },
        { path: 'su-kien/:eventId/sua', element: page(() => import('@/pages/community/EventCreate')) },
        { path: 'xep-hang', element: page(() => import('@/pages/community/Leaderboard')) },
        { path: 'thanh-vien', element: page(() => import('@/pages/community/Members')) },
        { path: 'doanh-thu', element: page(() => import('@/pages/community/Revenue')) },
        {
          path: 'cai-dat',
          element: page(() => import('@/pages/settings/SettingsLayout')),
          children: [
            { index: true, element: page(() => import('@/pages/settings/SettingsOverview')) },
            { path: 'chung', element: page(() => import('@/pages/settings/SettingsGeneral')) },
            { path: 'gia', element: page(() => import('@/pages/settings/SettingsPricing')) },
            { path: 'cong-su', element: page(() => import('@/pages/settings/SettingsAffiliate')) },
            { path: 'cong-su/rut-tien', element: page(() => import('@/pages/settings/SettingsAffiliatePayouts')) },
            { path: 'tien-ich', element: page(() => import('@/pages/settings/SettingsPlugins')) },
            { path: 'bang-tin', element: page(() => import('@/pages/settings/SettingsFeed')) },
            { path: 'thanh-toan', element: page(() => import('@/pages/settings/SettingsPayout')) },
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
    { path: 'nhat-ky', element: page(() => import('@/pages/admin/AdminLogs')) },
    { path: 'ho-tro', element: page(() => import('@/pages/admin/AdminCommunities')) },
  ],
};

export const router = createBrowserRouter([
  { element: <Outlet />, children: [...publicRoutes, ownerRoutes, learnerRoutes, accountRoutes, adminRoutes, communityRoutes] },
]);
