// 앱 셸 캐시: 한 번 열어 두면 오프라인에서도 실행됩니다. (시험지 데이터는 IndexedDB에 저장)
const CACHE = 'exam-app-v2';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
);
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req)
        .then((r) => {
          if (r.ok) c.put(req, r.clone());
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
