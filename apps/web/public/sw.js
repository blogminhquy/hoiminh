// Service worker của Hội Mình: chỉ lo thông báo đẩy. Cố ý KHÔNG lưu bản sao trang hay tệp nào, để bản mới của ứng dụng
// luôn tới thẳng từ máy chủ (nhãn phiên bản và cơ chế tự cập nhật của web đã lo việc đó).
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// Chrome chỉ cho cài ra màn hình chính khi service worker có trình xử lý fetch. Trình xử lý này để trống:
// không gọi respondWith thì trình duyệt tự tải như bình thường.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Hội Mình', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Hội Mình';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    data: { link: data.link || '/thong-bao' },
  }));
});

// Bấm vào thông báo: mở đúng trang của thông báo. Nếu Hội Mình đang mở sẵn thì dùng lại cửa sổ đó.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/thong-bao';
  const url = new URL(link, self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) { try { await client.navigate(url); } catch { /* cửa sổ không cho điều hướng thì mở mới bên dưới */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
