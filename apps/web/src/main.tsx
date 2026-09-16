// Điểm vào web: giao diện sáng/tối, React Query, Auth, Router, nhãn phiên bản.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTheme, readTheme } from '@hoiminh/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { VersionBadge } from './components/VersionBadge';
import './index.css';
import { AuthProvider } from './lib/auth';

// Gắn giao diện trước khi render để không nháy nền sáng rồi mới tối.
applyTheme(readTheme());

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
        <VersionBadge />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
