const CACHE = 'bp-diary-v1';
const ASSETS = ['./login.html','./blood-pressure-tracker.html','./admin.html','./manifest.json','./icon-192.png','./icon-512.png'];

/* ── 설치 ── */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

/* ── 활성화 ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── 네트워크 우선, 캐시 폴백 ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

/* ── 알람 메시지 수신 ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARMS') {
    scheduleAlarms(e.data.medications);
  }
});

/* ── 알람 스케줄링 ── */
const TIMING_MAP = { '아침':'08:00', '점심':'12:00', '저녁':'19:00' };
const alarmTimeouts = [];

function scheduleAlarms(medications) {
  // 기존 타이머 취소
  alarmTimeouts.forEach(t => clearTimeout(t));
  alarmTimeouts.length = 0;

  if (!medications || !medications.length) return;

  const now = new Date();

  medications.forEach(med => {
    const timings = med.timings.split(',').map(t => t.trim());
    timings.forEach(timing => {
      const timeStr = TIMING_MAP[timing];
      if (!timeStr) return;

      const [hh, mm] = timeStr.split(':').map(Number);
      const alarmTime = new Date();
      alarmTime.setHours(hh, mm, 0, 0);

      // 이미 지난 시간이면 스킵
      if (alarmTime <= now) return;

      const delay = alarmTime - now;
      const t = setTimeout(() => {
        self.registration.showNotification('💊 약 복용 시간이에요!', {
          body: `${timing} 약을 드실 시간입니다: ${med.name}`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: `med-${med.id}-${timing}`,
          renotify: true,
          requireInteraction: true,
          actions: [
            { action: 'open', title: '앱 열기' },
            { action: 'dismiss', title: '확인' }
          ]
        });
      }, delay);
      alarmTimeouts.push(t);
    });
  });
}

/* ── 알림 클릭 ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      const existing = list.find(c => c.url.includes('blood-pressure-tracker'));
      if (existing) return existing.focus();
      return clients.openWindow('./blood-pressure-tracker.html');
    })
  );
});
