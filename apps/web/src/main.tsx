// Điểm vào web: giao diện sáng/tối, React Query, Auth, Router, tự lên bản mới khi chuyển trang.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTheme, readTheme } from '@hoiminh/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import './index.css';
import { AuthProvider } from './lib/auth';
import { registerServiceWorker } from './lib/pwa';
import { useAutoUpdate } from './lib/version';

// Service worker (thông báo đẩy) và sự kiện cài một lần bấm của Android phải được lắng nghe ngay từ đầu.
registerServiceWorker();

// Gắn giao diện trước khi render để không nháy nền sáng rồi mới tối.
applyTheme(readTheme());

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } });

function AutoUpdate() {
  useAutoUpdate(router);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
        <AutoUpdate />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
